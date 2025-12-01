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
export declare class PriceTrackingRepository extends BaseRepository {
    constructor(pool: Pool);
    /**
     * Insert or update daily price data for a selected stock
     */
    upsertPriceData(selectedStockId: number, symbol: string, priceDate: string, openPrice: number, highPrice: number, lowPrice: number, closePrice: number, volume: number): Promise<void>;
    /**
     * Get all price data for a selected stock from selection date onwards
     */
    getPriceHistory(selectedStockId: number): Promise<PriceTrackingRecord[]>;
    /**
     * Get price history by symbol
     */
    getPriceHistoryBySymbol(symbol: string, fromDate?: string): Promise<PriceTrackingRecord[]>;
    /**
     * Get latest price for a selected stock
     */
    getLatestPrice(selectedStockId: number): Promise<PriceTrackingRecord | null>;
    /**
     * Record that a target or stoploss was hit
     */
    recordTargetHit(selectedStockId: number, symbol: string, targetType: 'target1' | 'target2' | 'target3' | 'stoploss', hitDate: string, hitPrice: number): Promise<void>;
    /**
     * Get all targets/stoploss hits for a selected stock
     */
    getTargetsHit(selectedStockId: number): Promise<TargetHitRecord[]>;
    /**
     * Get all selected stocks with their selection dates
     * Handles both old column names (target_1, target_2, target_3) and new ones (target1, target2, target3)
     */
    getSelectedStocksWithDates(): Promise<Array<{
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
    }>>;
}
//# sourceMappingURL=PriceTrackingRepository.d.ts.map