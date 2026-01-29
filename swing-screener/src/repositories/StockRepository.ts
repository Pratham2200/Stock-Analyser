
// src/repositories/StockRepository.ts - Stock data repository

import { Pool } from 'pg';
import { BaseRepository } from './BaseRepository';
import {
  ScanRecord,
  StockRecord
} from '../types/database';
import { StockData, AnalysisOutput } from '../types';
import { DailyBar } from '../types/analysis';

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
    this.logger.info(`Created scan record: ${result.rows[0].id} `);
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

  async insertDailyBars(
    stockId: string,
    bars: DailyBar[],
    indicators?: {
      ema10Values?: number[];
      ema20Values?: number[];
      volumeAvgs?: number[];
      volumeRatios?: number[];
    }
  ): Promise<void> {
    if (bars.length === 0) return;

    // Use a transaction for bulk insert
    return this.transaction(async (client) => {
      // Prepare a bulk insert query manually for performance
      // We can't use buildInsertQuery easily for bulk rows with different values without a loop
      // So we'll construct a multi-row INSERT

      // Helper to safely convert to number (handles NaN, Infinity, null, undefined)
      const toSafeNumber = (val: any): number | null => {
        if (val === null || val === undefined) return null;
        const num = Number(val);
        return isFinite(num) ? num : null;
      };

      // Helper for bigint columns (floor to integer)
      const toSafeBigint = (val: any): number | null => {
        if (val === null || val === undefined) return null;
        const num = Number(val);
        return isFinite(num) ? Math.floor(num) : null;
      };

      const values: any[] = [];
      const placeholders: string[] = [];
      let paramCount = 1;

      for (let i = 0; i < bars.length; i++) {
        const bar = bars[i];
        const ema10 = indicators?.ema10Values?.[i];
        const ema20 = indicators?.ema20Values?.[i];
        const volAvg = indicators?.volumeAvgs?.[i];
        const volRatio = indicators?.volumeRatios?.[i];

        placeholders.push(`($${paramCount}, $${paramCount + 1}, $${paramCount + 2}, $${paramCount + 3}, $${paramCount + 4}, $${paramCount + 5}, $${paramCount + 6}, $${paramCount + 7}, $${paramCount + 8}, $${paramCount + 9}, $${paramCount + 10}, $${paramCount + 11})`);
        values.push(
          stockId,
          bar.date,
          toSafeNumber(bar.open),
          toSafeNumber(bar.high),
          toSafeNumber(bar.low),
          toSafeNumber(bar.close),
          toSafeNumber(bar.close), // adjclose
          toSafeBigint(bar.volume),
          toSafeNumber(ema10),
          toSafeNumber(ema20),
          toSafeBigint(volAvg),
          toSafeNumber(volRatio)
        );
        paramCount += 12;
      }

      const text = `
        INSERT INTO stock_daily_bars(
          stock_id, date, open, high, low, close, adjclose, volume, 
          ema10, ema20, volume_20bar_avg, volume_ratio
        )
        VALUES ${placeholders.join(', ')}
        ON CONFLICT(stock_id, date) DO UPDATE SET
          open = EXCLUDED.open,
          high = EXCLUDED.high,
          low = EXCLUDED.low,
          close = EXCLUDED.close,
          adjclose = EXCLUDED.adjclose,
          volume = EXCLUDED.volume,
          ema10 = EXCLUDED.ema10,
          ema20 = EXCLUDED.ema20,
          volume_20bar_avg = EXCLUDED.volume_20bar_avg,
          volume_ratio = EXCLUDED.volume_ratio
      `;

      await client.query(text, values);
      this.logger.debug(`Inserted ${bars.length} daily bars with indicators for stock ${stockId}`);
    });
  }

  async insertStockMetadata(
    stockId: string,
    scanId: string,
    metadata: {
      fiftyTwoWeekLow?: number;
      fiftyTwoWeekHigh?: number;
      fiftyDayAverage?: number;
      twoHundredDayAverage?: number;
      avgVolume3Month?: number;
      avgVolume10Day?: number;
      marketCap?: number;
      trailingPE?: number;
      priceToBook?: number;
      epsTrailingTwelveMonths?: number;
      currency?: string;
      exchange?: string;
      longName?: string;
      marketState?: string;
      rawQuoteData?: any;
      rawChartMeta?: any;
    }
  ): Promise<void> {
    // Helper to safely convert to number
    const toSafeNumber = (val: any): number | null => {
      if (val === null || val === undefined) return null;
      const num = Number(val);
      return isFinite(num) ? num : null;
    };

    // Helper for bigint columns
    const toSafeBigint = (val: any): number | null => {
      if (val === null || val === undefined) return null;
      const num = Number(val);
      return isFinite(num) ? Math.floor(num) : null;
    };

    const { text, values } = this.buildInsertQuery(
      'stock_metadata',
      {
        stock_id: stockId,
        scan_id: scanId,
        fifty_two_week_low: toSafeNumber(metadata.fiftyTwoWeekLow),
        fifty_two_week_high: toSafeNumber(metadata.fiftyTwoWeekHigh),
        fifty_day_average: toSafeNumber(metadata.fiftyDayAverage),
        two_hundred_day_average: toSafeNumber(metadata.twoHundredDayAverage),
        avg_volume_3month: toSafeBigint(metadata.avgVolume3Month),
        avg_volume_10day: toSafeBigint(metadata.avgVolume10Day),
        market_cap: toSafeBigint(metadata.marketCap),
        trailing_pe: toSafeNumber(metadata.trailingPE),
        price_to_book: toSafeNumber(metadata.priceToBook),
        eps_trailing_twelve_months: toSafeNumber(metadata.epsTrailingTwelveMonths),
        currency: metadata.currency || null,
        exchange: metadata.exchange || null,
        long_name: metadata.longName || null,
        market_state: metadata.marketState || null,
        raw_quote_data: metadata.rawQuoteData ? JSON.stringify(metadata.rawQuoteData) : null,
        raw_chart_meta: metadata.rawChartMeta ? JSON.stringify(metadata.rawChartMeta) : null
      }
    );

    await this.query(text, values);
    this.logger.debug(`Inserted metadata for stock ${stockId}`);
  }

  async insertZones(
    stockId: string,
    scanId: string,
    zones: Array<{
      zoneNumber: number;
      startDate: Date | string;
      endDate: Date | string;
      zoneLow: number;
      barCount: number;
    }>
  ): Promise<void> {
    if (zones.length === 0) return;

    return this.transaction(async (client) => {
      for (const zone of zones) {
        const { text, values } = this.buildInsertQuery(
          'stock_zones',
          {
            stock_id: stockId,
            scan_id: scanId,
            zone_number: zone.zoneNumber,
            start_date: zone.startDate,
            end_date: zone.endDate,
            zone_low: zone.zoneLow,
            bar_count: zone.barCount
          }
        );
        await client.query(text, values);
      }
      this.logger.debug(`Inserted ${zones.length} zones for stock ${stockId}`);
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

  async getSelectedStocks(page: number = 1, limit: number = 10): Promise<{ stocks: any[], total: number }> {
    const offset = (page - 1) * limit;

    // Get total count
    const countQuery = 'SELECT COUNT(*) FROM selected_stocks';
    const countResult = await this.query(countQuery);
    const total = parseInt(countResult.rows[0].count);

    if (total === 0) {
      return { stocks: [], total: 0 };
    }

    const text = `
      SELECT
        st.id, st.symbol, st.name,
        ss.entry_price, ss.stop_loss, ss.target_1, ss.target_2, ss.target_3,
        ss.position_size, ss.position_value,
        sa.current_price, sa.ema10, sa.ema20,
        s.scan_date
      FROM selected_stocks ss
      JOIN stocks st ON ss.stock_id = st.id
      JOIN scans s ON st.scan_id = s.id
      LEFT JOIN stock_analysis sa ON st.id = sa.stock_id
      ORDER BY s.scan_date DESC, st.symbol
      LIMIT $1 OFFSET $2
    `;

    const result = await this.query(text, [limit, offset]);
    return { stocks: result.rows, total };
  }

  async getAllSelectedStocks(): Promise<any[]> {
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
  AVG(CASE WHEN qualified = true THEN(strategy_details ->> 'score'):: numeric ELSE 0 END) as avg_score,
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

  async getScanHistory(page: number = 1, limit: number = 10): Promise<{ scans: any[], total: number }> {
    const offset = (page - 1) * limit;

    // Get total count
    const countQuery = 'SELECT COUNT(*) FROM scans';
    const countResult = await this.query(countQuery);
    const total = parseInt(countResult.rows[0].count);

    if (total === 0) {
      return { scans: [], total: 0 };
    }

    const text = `
      SELECT
        s.*,
        COUNT(sa.id) as total_analysis,
        COUNT(CASE WHEN sa.qualified = true THEN 1 END) as qualified_count
      FROM scans s
      LEFT JOIN stock_analysis sa ON s.id = sa.scan_id
      GROUP BY s.id, s.scan_date, s.total_stocks_scraped, s.stocks_analyzed, s.stocks_passed, s.scan_duration_seconds
      ORDER BY s.scan_date DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await this.query(text, [limit, offset]);
    return { scans: result.rows, total };
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
