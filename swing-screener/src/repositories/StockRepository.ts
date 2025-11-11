// src/repositories/StockRepository.ts - Stock data repository

import { Pool } from 'pg';
import { BaseRepository } from './BaseRepository';
import { 
  ScanRecord, 
  StockRecord
} from '../types/database';
import { StockData, AnalysisOutput } from '../types';

export class StockRepository extends BaseRepository {
  constructor(pool: Pool) {
    super(pool, 'StockRepository');
  }

  async createScan(
    totalStocksScraped: number,
    stocksAnalyzed: number,
    stocksPassed: number,
    scanDurationSeconds: number
  ): Promise<ScanRecord> {
    const { text, values } = this.buildInsertQuery(
      'scans',
      {
        total_stocks_scraped: totalStocksScraped,
        stocks_analyzed: stocksAnalyzed,
        stocks_passed: stocksPassed,
        scan_duration_seconds: scanDurationSeconds
      },
      ['id', 'scan_date']
    );

    const result = await this.query<ScanRecord>(text, values);
    this.logger.info(`Created scan record: ${result.rows[0].id}`);
    return result.rows[0];
  }

  async insertStocks(scanId: string, stocks: StockData[]): Promise<StockRecord[]> {
    if (stocks.length === 0) {
      this.logger.warn('No stocks to insert');
      return [];
    }

    return this.transaction(async (client) => {
      const results: StockRecord[] = [];
      
      for (const stock of stocks) {
        const { text, values } = this.buildInsertQuery(
          'stocks',
          {
            scan_id: scanId,
            symbol: stock.symbol,
            name: stock.name
          },
          ['id', 'symbol', 'name']
        );

        const result = await client.query<StockRecord>(text, values);
        results.push(result.rows[0]);
      }

      this.logger.info(`Inserted ${results.length} stocks for scan ${scanId}`);
      return results;
    });
  }

  async insertStockAnalysis(
    stockId: string,
    scanId: string,
    analysisResult: AnalysisOutput
  ): Promise<void> {
    const { text, values } = this.buildInsertQuery(
      'stock_analysis',
      {
        stock_id: stockId,
        scan_id: scanId,
        qualified: analysisResult.qualified,
        fail_step: analysisResult.failedAt,
        fail_reason: analysisResult.reason,
        current_price: analysisResult.currentPrice,
        ema10: analysisResult.ema10,
        ema20: analysisResult.ema20,
        strategy_details: JSON.stringify(analysisResult.details),
        analysis_duration_ms: analysisResult.analysisDurationMs,
        data_points_daily: analysisResult.dataPointsDaily,
        data_points_intraday: analysisResult.dataPointsIntraday
      }
    );

    await this.query(text, values);
    this.logger.debug(`Inserted analysis for stock ${stockId}`);
  }

  async insertSelectedStock(
    stockId: string,
    scanId: string,
    selectedStockData: {
      entryPrice: number;
      stopLoss: number;
      target1: number;
      target2: number;
      target3: number;
      positionSize: number;
      positionValue: number;
    }
  ): Promise<void> {
    const { text, values } = this.buildInsertQuery(
      'selected_stocks',
      {
        stock_id: stockId,
        scan_id: scanId,
        entry_price: selectedStockData.entryPrice,
        stop_loss: selectedStockData.stopLoss,
        target_1: selectedStockData.target1,
        target_2: selectedStockData.target2,
        target_3: selectedStockData.target3,
        position_size: selectedStockData.positionSize,
        position_value: selectedStockData.positionValue
      }
    );

    await this.query(text, values);
    this.logger.info(`Inserted selected stock ${stockId} for scan ${scanId}`);
  }

  async getLatestScanResults(): Promise<ScanRecord | null> {
    const text = `
      SELECT 
        s.id, s.scan_date, s.total_stocks_scraped, s.stocks_analyzed, s.stocks_passed,
        s.scan_duration_seconds,
        COUNT(sa.id) as total_analysis,
        COUNT(CASE WHEN sa.qualified = true THEN 1 END) as qualified_count
      FROM scans s
      LEFT JOIN stock_analysis sa ON s.id = sa.scan_id
      GROUP BY s.id, s.scan_date, s.total_stocks_scraped, s.stocks_analyzed, s.stocks_passed, s.scan_duration_seconds
      ORDER BY s.scan_date DESC
      LIMIT 1
    `;

    const result = await this.query<ScanRecord>(text);
    return result.rows[0] || null;
  }

  async getStocksFromLatestScan(): Promise<any[]> {
    const text = `
      SELECT 
        st.id, st.symbol, st.name,
        sa.qualified, sa.fail_step, sa.fail_reason, sa.current_price,
        sa.ema10, sa.ema20, sa.strategy_details,
        sa.analysis_duration_ms, sa.data_points_daily, sa.data_points_intraday,
        s.scan_date
      FROM stocks st
      JOIN scans s ON st.scan_id = s.id
      LEFT JOIN stock_analysis sa ON st.id = sa.stock_id
      WHERE s.scan_date = (SELECT MAX(scan_date) FROM scans)
      ORDER BY st.symbol
    `;

    const result = await this.query(text);
    return result.rows;
  }

  async getAllStocksWithAnalysis(): Promise<any[]> {
    const text = `
      SELECT 
        st.id, st.symbol, st.name,
        sa.qualified, sa.fail_step, sa.fail_reason, sa.current_price,
        sa.ema10, sa.ema20, sa.strategy_details,
        sa.analysis_duration_ms, sa.data_points_daily, sa.data_points_intraday,
        s.scan_date
      FROM stocks st
      JOIN scans s ON st.scan_id = s.id
      LEFT JOIN stock_analysis sa ON st.id = sa.stock_id
      ORDER BY s.scan_date DESC, st.symbol
    `;

    const result = await this.query(text);
    return result.rows;
  }

  async getSelectedStocks(): Promise<any[]> {
    const text = `
      SELECT 
        st.symbol, st.name,
        ss.entry_price, ss.stop_loss, ss.target_1, ss.target_2, ss.target_3,
        ss.position_size, ss.position_value,
        sa.current_price, sa.ema10, sa.ema20,
        s.scan_date
      FROM selected_stocks ss
      JOIN stocks st ON ss.stock_id = st.id
      JOIN scans s ON st.scan_id = s.id
      LEFT JOIN stock_analysis sa ON st.id = sa.stock_id
      ORDER BY s.scan_date DESC, st.symbol
    `;

    const result = await this.query(text);
    return result.rows;
  }

  async getAnalysisStatistics(scanId?: string): Promise<any> {
    let whereClause = '';
    let params: any[] = [];
    
    if (scanId) {
      whereClause = 'WHERE sa.scan_id = $1';
      params = [scanId];
    }

    const text = `
      SELECT 
        COUNT(*) as total_analysis,
        COUNT(CASE WHEN qualified = true THEN 1 END) as qualified_count,
        COUNT(CASE WHEN qualified = false THEN 1 END) as rejected_count,
        AVG(analysis_duration_ms) as avg_duration,
        AVG(CASE WHEN qualified = true THEN (strategy_details->>'score')::numeric ELSE 0 END) as avg_score,
        COUNT(CASE WHEN fail_step = 1 THEN 1 END) as consolidation_failures,
        COUNT(CASE WHEN fail_step = 2 THEN 1 END) as higher_low_failures,
        COUNT(CASE WHEN fail_step = 3 THEN 1 END) as volume_failures,
        COUNT(CASE WHEN fail_step = 4 THEN 1 END) as bear_squeeze_failures
      FROM stock_analysis sa
      ${whereClause}
    `;

    const result = await this.query(text, params);
    return result.rows[0];
  }

  async getScanHistory(limit: number = 10): Promise<ScanRecord[]> {
    const text = `
      SELECT 
        s.*,
        COUNT(sa.id) as total_analysis,
        COUNT(CASE WHEN sa.qualified = true THEN 1 END) as qualified_count
      FROM scans s
      LEFT JOIN stock_analysis sa ON s.id = sa.scan_id
      GROUP BY s.id, s.scan_date, s.total_stocks_scraped, s.stocks_analyzed, s.stocks_passed, s.scan_duration_seconds
      ORDER BY s.scan_date DESC
      LIMIT $1
    `;

    const result = await this.query<ScanRecord>(text, [limit]);
    return result.rows;
  }

  async deleteOldScans(olderThanDays: number = 30): Promise<number> {
    const text = `
      DELETE FROM scans 
      WHERE scan_date < NOW() - INTERVAL '${olderThanDays} days'
    `;

    const result = await this.query(text);
    this.logger.info(`Deleted ${result.rowCount} old scans`);
    return result.rowCount || 0;
  }

  /**
   * Check if stocks were already scraped today
   * @returns true if stocks exist for today's date, false otherwise
   */
  async hasStocksForToday(): Promise<boolean> {
    const text = `
      SELECT COUNT(*) as count
      FROM stocks st
      JOIN scans s ON st.scan_id = s.id
      WHERE DATE(s.scan_date) = CURRENT_DATE
    `;

    const result = await this.query<{ count: string }>(text);
    const count = parseInt(result.rows[0]?.count || '0', 10);
    return count > 0;
  }

  /**
   * Get stocks from today's scan
   * @returns Array of StockData from today's scan
   */
  async getStocksFromToday(): Promise<StockData[]> {
    const text = `
      SELECT DISTINCT st.symbol, st.name
      FROM stocks st
      JOIN scans s ON st.scan_id = s.id
      WHERE DATE(s.scan_date) = CURRENT_DATE
      ORDER BY st.symbol
    `;

    const result = await this.query<StockData>(text);
    this.logger.info(`Fetched ${result.rows.length} stocks from today's scan`);
    return result.rows;
  }

  /**
   * Get today's scan record
   * @returns ScanRecord for today or null if no scan exists
   */
  async getTodayScanRecord(): Promise<ScanRecord | null> {
    const text = `
      SELECT 
        s.id, s.scan_date, s.total_stocks_scraped, s.stocks_analyzed, s.stocks_passed,
        s.scan_duration_seconds
      FROM scans s
      WHERE DATE(s.scan_date) = CURRENT_DATE
      ORDER BY s.scan_date DESC
      LIMIT 1
    `;

    const result = await this.query<ScanRecord>(text);
    return result.rows[0] || null;
  }

  /**
   * Get stocks from today's scan with their IDs
   * Used when re-analyzing cached stocks
   * @param scanId - The scan ID to get stocks for
   * @returns Array of StockRecord with id, symbol, and name
   */
  async getStocksFromTodayWithIds(scanId: string): Promise<StockRecord[]> {
    const text = `
      SELECT st.id, st.symbol, st.name, st.scan_id as "scanId"
      FROM stocks st
      JOIN scans s ON st.scan_id = s.id
      WHERE DATE(s.scan_date) = CURRENT_DATE
      ORDER BY st.symbol
    `;

    const result = await this.query<StockRecord>(text);
    this.logger.info(`Fetched ${result.rows.length} stocks with IDs from today's scan`);
    return result.rows;
  }

  /**
   * Check if analysis already exists for today's stocks
   * @returns true if all stocks from today have analysis records, false otherwise
   */
  async hasAnalysisForTodayStocks(): Promise<boolean> {
    const text = `
      SELECT 
        COUNT(DISTINCT st.id) as total_stocks,
        COUNT(DISTINCT sa.stock_id) as analyzed_stocks
      FROM stocks st
      JOIN scans s ON st.scan_id = s.id
      LEFT JOIN stock_analysis sa ON st.id = sa.stock_id AND DATE(sa.created_at) = CURRENT_DATE
      WHERE DATE(s.scan_date) = CURRENT_DATE
    `;

    const result = await this.query<{ total_stocks: string; analyzed_stocks: string }>(text);
    const totalStocks = parseInt(result.rows[0]?.total_stocks || '0', 10);
    const analyzedStocks = parseInt(result.rows[0]?.analyzed_stocks || '0', 10);
    
    const hasAnalysis = totalStocks > 0 && analyzedStocks === totalStocks;
    this.logger.info(`Analysis check for today: ${analyzedStocks}/${totalStocks} stocks analyzed`);
    return hasAnalysis;
  }

  /**
   * Get existing analysis results for today's stocks
   * @returns Array of stocks with their existing analysis results
   */
  async getTodayStocksWithAnalysis(): Promise<any[]> {
    const text = `
      SELECT 
        st.id, st.symbol, st.name, st.scan_id as "scanId",
        sa.qualified, 
        sa.fail_step as "failedAt", 
        sa.fail_reason as reason,
        sa.current_price as "currentPrice",
        sa.ema10,
        sa.ema20,
        sa.strategy_details as details, 
        sa.created_at as "analysisCreatedAt"
      FROM stocks st
      JOIN scans s ON st.scan_id = s.id
      LEFT JOIN stock_analysis sa ON st.id = sa.stock_id AND DATE(sa.created_at) = CURRENT_DATE
      WHERE DATE(s.scan_date) = CURRENT_DATE
      ORDER BY st.symbol
    `;

    const result = await this.query(text);
    this.logger.info(`Fetched ${result.rows.length} stocks with analysis from today`);
    return result.rows;
  }
}
