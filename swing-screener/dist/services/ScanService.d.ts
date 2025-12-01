import { BaseService } from './BaseService';
import { StockRepository } from '../repositories/StockRepository';
import { PriceTrackingRepository } from '../repositories/PriceTrackingRepository';
import { StockAnalysisService } from './StockAnalysisService';
import { ScraperService } from './ScraperService';
import { StockDataService } from './StockDataService';
import { AppConfig, ScanResult } from '../types';
export declare class ScanService extends BaseService {
    private stockRepository;
    private priceTrackingRepository?;
    private scraperService;
    private stockDataService;
    private config;
    private isRunning;
    private currentProgress;
    private totalStocks;
    private currentStage;
    private analysisService;
    constructor(stockRepository: StockRepository, analysisService: StockAnalysisService, scraperService: ScraperService, stockDataService: StockDataService, config: AppConfig, priceTrackingRepository?: PriceTrackingRepository);
    startManualScan(): Promise<ScanResult>;
    getScanStatus(): Promise<any>;
    getScanProgress(): Promise<any>;
    getLatestResults(): Promise<any>;
    getStocksFromLatestScan(_page?: number, _limit?: number): Promise<{
        stocks: any[];
        total: number;
    }>;
    getSelectedStocks(page?: number, limit?: number): Promise<{
        stocks: any[];
        total: number;
    }>;
    getScanHistory(_page?: number, limit?: number): Promise<{
        scans: any[];
        total: number;
    }>;
    getAnalysisStatistics(): Promise<any>;
    analyzeSingleStock(symbol: string, _lookbackDays?: number, _includeIntraday?: boolean): Promise<any>;
    getStockQuote(symbol: string): Promise<any>;
    getRejectedStocksFromLatestScan(page?: number, limit?: number): Promise<{
        stocks: any[];
        total: number;
    }>;
    getRecentLogs(_lines?: number): Promise<string[]>;
    /**
     * Get summary statistics for all selected stocks
     */
    getSelectedStocksSummary(): Promise<{
        totalStocks: number;
        totalValue: number;
        totalPnL: number;
        averagePnL: number;
        stocksInProfit: number;
        stocksInLoss: number;
        stocksAtStopLoss: number;
        targetsHit: {
            target1: number;
            target2: number;
            target3: number;
        };
        stocks: Array<{
            symbol: string;
            name: string;
            entryPrice: number;
            currentPrice: number;
            priceMovement: number;
            selectionDate: string;
            stopLoss: number;
            target1: number;
            target2: number;
            target3: number;
            positionSize: number;
            positionValue: number;
            targetsHit: string[];
            stoplossHit: boolean;
        }>;
    }>;
}
//# sourceMappingURL=ScanService.d.ts.map