import { BaseService } from './BaseService';
import { DailyBar } from '../types/analysis';
export declare class StockDataService extends BaseService {
    private readonly MAX_RETRIES;
    private readonly INITIAL_RETRY_DELAY_MS;
    private rateLimiter;
    constructor();
    /**
     * Fetch historical daily price data for a stock with retry logic
     * ⚠️ IMPORTANT: This method fetches REAL stock price data from Yahoo Finance API
     * No dummy/mock data is used - all prices are real market data
     *
     * @param symbol - Stock symbol (e.g., "RELIANCE", "AFFLE")
     * @param days - Number of days of historical data to fetch (default: 120)
     * @param retryCount - Internal retry counter for exponential backoff
     * @returns Array of DailyBar objects with REAL market data
     */
    fetchDailyBars(symbol: string, days?: number, retryCount?: number): Promise<DailyBar[]>;
    /**
     * Convert Indian stock symbol to Yahoo Finance format
     * @param symbol - Plain stock symbol (e.g., "RELIANCE", "AFFLE")
     * @returns Yahoo Finance symbol (e.g., "RELIANCE.NS", "AFFLE.NS")
     */
    private convertToYahooSymbol;
    /**
     * Fetch current price for a stock
     * @param symbol - Stock symbol
     * @returns Current price or null if not found
     */
    fetchCurrentPrice(symbol: string): Promise<number | null>;
    /**
     * Check if a stock symbol is valid and data is available
     * @param symbol - Stock symbol
     * @returns true if data is available, false otherwise
     */
    isSymbolValid(symbol: string): Promise<boolean>;
}
//# sourceMappingURL=StockDataService.d.ts.map