// src/repositories/PriceTrackingRepository.ts - Price tracking data repository

import { Pool } from 'pg';
import { BaseRepository } from './BaseRepository';

export interface PriceTrackingRecord {
  id: number;
  selected_stock_id: number;
  symbol: string;
  price_date: string;
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  volume: number;
  created_at: string;
}

export interface TargetHitRecord {
  id: number;
  selected_stock_id: number;
  symbol: string;
  target_type: 'target1' | 'target2' | 'target3' | 'stoploss';
  hit_date: string;
  hit_price: number;
  created_at: string;
}

export class PriceTrackingRepository extends BaseRepository {
  constructor(pool: Pool) {
    super(pool, 'PriceTrackingRepository');
  }

  /**
   * Insert or update daily price data for a selected stock
   */
  async upsertPriceData(
    selectedStockId: number,
    symbol: string,
    priceDate: string,
    openPrice: number,
    highPrice: number,
    lowPrice: number,
    closePrice: number,
    volume: number
  ): Promise<void> {
    const text = `
      INSERT INTO selected_stock_price_tracking 
        (selected_stock_id, symbol, price_date, open_price, high_price, low_price, close_price, volume)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (selected_stock_id, price_date) 
      DO UPDATE SET
        open_price = EXCLUDED.open_price,
        high_price = EXCLUDED.high_price,
        low_price = EXCLUDED.low_price,
        close_price = EXCLUDED.close_price,
        volume = EXCLUDED.volume
    `;

    await this.query(text, [
      selectedStockId,
      symbol,
      priceDate,
      openPrice,
      highPrice,
      lowPrice,
      closePrice,
      volume
    ]);

    this.logger.info(`Upserted price data for ${symbol} on ${priceDate}`);
  }

  /**
   * Get all price data for a selected stock from selection date onwards
   */
  async getPriceHistory(selectedStockId: number): Promise<PriceTrackingRecord[]> {
    const text = `
      SELECT 
        id, selected_stock_id, symbol, price_date,
        open_price, high_price, low_price, close_price, volume,
        created_at
      FROM selected_stock_price_tracking
      WHERE selected_stock_id = $1
      ORDER BY price_date ASC
    `;

    const result = await this.query<PriceTrackingRecord>(text, [selectedStockId]);
    return result.rows;
  }

  /**
   * Get price history by symbol
   */
  async getPriceHistoryBySymbol(symbol: string, fromDate?: string): Promise<PriceTrackingRecord[]> {
    let text = `
      SELECT 
        id, selected_stock_id, symbol, price_date,
        open_price, high_price, low_price, close_price, volume,
        created_at
      FROM selected_stock_price_tracking
      WHERE symbol = $1
    `;
    const params: any[] = [symbol];

    if (fromDate) {
      text += ` AND price_date >= $2`;
      params.push(fromDate);
    }

    text += ` ORDER BY price_date ASC`;

    const result = await this.query<PriceTrackingRecord>(text, params);
    return result.rows;
  }

  /**
   * Get latest price for a selected stock
   */
  async getLatestPrice(selectedStockId: number): Promise<PriceTrackingRecord | null> {
    const text = `
      SELECT 
        id, selected_stock_id, symbol, price_date,
        open_price, high_price, low_price, close_price, volume,
        created_at
      FROM selected_stock_price_tracking
      WHERE selected_stock_id = $1
      ORDER BY price_date DESC
      LIMIT 1
    `;

    const result = await this.query<PriceTrackingRecord>(text, [selectedStockId]);
    return result.rows[0] || null;
  }

  /**
   * Record that a target or stoploss was hit
   */
  async recordTargetHit(
    selectedStockId: number,
    symbol: string,
    targetType: 'target1' | 'target2' | 'target3' | 'stoploss',
    hitDate: string,
    hitPrice: number
  ): Promise<void> {
    // Validate hitPrice is not null/undefined/zero
    if (!hitPrice || hitPrice <= 0 || isNaN(hitPrice)) {
      this.logger.warn(`Invalid hit_price for ${symbol} ${targetType}: ${hitPrice}. Skipping record.`);
      return;
    }

    const text = `
      INSERT INTO selected_stock_targets_hit 
        (selected_stock_id, symbol, target_type, hit_date, hit_price)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (selected_stock_id, target_type) 
      DO UPDATE SET
        hit_date = EXCLUDED.hit_date,
        hit_price = EXCLUDED.hit_price
    `;

    await this.query(text, [selectedStockId, symbol, targetType, hitDate, hitPrice]);
    this.logger.info(`Recorded ${targetType} hit for ${symbol} on ${hitDate} at ${hitPrice}`);
  }

  /**
   * Get all targets/stoploss hits for a selected stock
   */
  async getTargetsHit(selectedStockId: number): Promise<TargetHitRecord[]> {
    const text = `
      SELECT 
        id, selected_stock_id, symbol, target_type, hit_date, hit_price, created_at
      FROM selected_stock_targets_hit
      WHERE selected_stock_id = $1
      ORDER BY hit_date ASC
    `;

    const result = await this.query<TargetHitRecord>(text, [selectedStockId]);
    return result.rows;
  }

  /**
   * Get all selected stocks with their selection dates
   * Handles both old column names (target_1, target_2, target_3) and new ones (target1, target2, target3)
   */
  async getSelectedStocksWithDates(): Promise<Array<{
    id: number;
    stock_id: number;
    symbol: string;
    name: string;
    entry_price: number;
    stop_loss: number;
    target1: number;
    target2: number;
    target3: number;
    selection_date: string;
  }>> {
    const text = `
      SELECT 
        ss.id,
        ss.stock_id,
        st.symbol,
        st.name,
        COALESCE(ss.entry_price, sa.current_price, 0) as entry_price,
        COALESCE(ss.stop_loss, (COALESCE(ss.entry_price, sa.current_price, 0) * 0.95), 0) as stop_loss,
        COALESCE(NULLIF(ss.target1, 0), (COALESCE(ss.entry_price, sa.current_price, 0) * 1.15), 0) as target1,
        COALESCE(NULLIF(ss.target2, 0), (COALESCE(ss.entry_price, sa.current_price, 0) * 1.30), 0) as target2,
        COALESCE(NULLIF(ss.target3, 0), (COALESCE(ss.entry_price, sa.current_price, 0) * 1.50), 0) as target3,
        ss.created_at as selection_date
      FROM selected_stocks ss
      JOIN stocks st ON ss.stock_id = st.id
      LEFT JOIN stock_analysis sa ON st.id = sa.stock_id
      ORDER BY ss.created_at DESC
    `;

    const result = await this.query(text);
    return result.rows;
  }
}

