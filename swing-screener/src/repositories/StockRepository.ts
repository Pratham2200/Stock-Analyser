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
        sa.analysis_duration_ms, sa.data_points_daily, sa.data_points_intraday
      FROM stocks st
      JOIN scans s ON st.scan_id = s.id
      LEFT JOIN stock_analysis sa ON st.id = sa.stock_id
      WHERE s.scan_date = (SELECT MAX(scan_date) FROM scans)
      ORDER BY st.symbol
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
}
