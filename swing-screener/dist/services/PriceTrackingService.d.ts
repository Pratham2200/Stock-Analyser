import { BaseService } from './BaseService';
import { StockDataService } from './StockDataService';
import { PriceTrackingRepository } from '../repositories/PriceTrackingRepository';
export interface StockPriceTrackingResult {
    symbol: string;
    success: boolean;
    pricesFetched: number;
    error?: string;
    targetsHit?: string[];
    stoplossHit?: boolean;
}
export declare class PriceTrackingService extends BaseService {
    private stockDataService;
    private priceTrackingRepository;
    private rateLimiter;
    constructor(stockDataService: StockDataService, priceTrackingRepository: PriceTrackingRepository);
    /**
     * Track prices for all selected stocks from their selection date
     */
    trackAllSelectedStocks(): Promise<StockPriceTrackingResult[]>;
    /**
     * Track prices for a single selected stock from its selection date
     */
    trackStockPrices(stock: {
        id: number;
        symbol: string;
        entry_price: number;
        stop_loss: number;
        target1: number;
        target2: number;
        target3: number;
        selection_date: string;
    }): Promise<StockPriceTrackingResult>;
    /**
     * Get price history for a selected stock
     */
    getPriceHistory(selectedStockId: number): Promise<{
        prices: Array<{
            date: string;
            open: number;
            high: number;
            low: number;
            close: number;
            volume: number;
        }>;
        targetsHit: Array<{
            type: string;
            date: string;
            price: number;
        }>;
        stoplossHit: {
            date: string;
            price: number;
        } | null;
    }>;
    /**
     * Get price history by symbol
     */
    getPriceHistoryBySymbol(symbol: string, fromDate?: string): Promise<Array<{
        date: string;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
    }>>;
}
//# sourceMappingURL=PriceTrackingService.d.ts.map