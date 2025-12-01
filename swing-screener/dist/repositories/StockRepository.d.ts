import { Pool } from 'pg';
import { BaseRepository } from './BaseRepository';
import { ScanRecord, StockRecord } from '../types/database';
import { StockData, AnalysisOutput } from '../types';
export declare class StockRepository extends BaseRepository {
    constructor(pool: Pool);
    createScan(totalStocksScraped: number, stocksAnalyzed: number, stocksPassed: number, scanDurationSeconds: number): Promise<ScanRecord>;
    insertStocks(scanId: string, stocks: StockData[]): Promise<StockRecord[]>;
    insertStockAnalysis(stockId: string, scanId: string, analysisResult: AnalysisOutput): Promise<void>;
    insertSelectedStock(stockId: string, scanId: string, selectedStockData: {
        entryPrice: number;
        stopLoss: number;
        target1: number;
        target2: number;
        target3: number;
        positionSize: number;
        positionValue: number;
    }): Promise<void>;
    getLatestScanResults(): Promise<ScanRecord | null>;
    getStocksFromLatestScan(): Promise<any[]>;
    getAllStocksWithAnalysis(): Promise<any[]>;
    getSelectedStocks(): Promise<any[]>;
    getAnalysisStatistics(scanId?: string): Promise<any>;
    getScanHistory(limit?: number): Promise<ScanRecord[]>;
    deleteOldScans(olderThanDays?: number): Promise<number>;
    /**
     * Check if stocks were already scraped today
     * @returns true if stocks exist for today's date, false otherwise
     */
    hasStocksForToday(): Promise<boolean>;
    /**
     * Get stocks from today's scan
     * @returns Array of StockData from today's scan
     */
    getStocksFromToday(): Promise<StockData[]>;
    /**
     * Get today's scan record
     * @returns ScanRecord for today or null if no scan exists
     */
    getTodayScanRecord(): Promise<ScanRecord | null>;
    /**
     * Get stocks from today's scan with their IDs
     * Used when re-analyzing cached stocks
     * @param scanId - The scan ID to get stocks for
     * @returns Array of StockRecord with id, symbol, and name
     */
    getStocksFromTodayWithIds(scanId: string): Promise<StockRecord[]>;
    /**
     * Check if analysis already exists for today's stocks
     * @returns true if all stocks from today have analysis records, false otherwise
     */
    hasAnalysisForTodayStocks(): Promise<boolean>;
    /**
     * Get existing analysis results for today's stocks
     * @returns Array of stocks with their existing analysis results
     */
    getTodayStocksWithAnalysis(): Promise<any[]>;
}
//# sourceMappingURL=StockRepository.d.ts.map