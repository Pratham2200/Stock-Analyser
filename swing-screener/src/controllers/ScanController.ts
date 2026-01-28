// src/controllers/ScanController.ts - Scan management controller

import { Request, Response } from 'express';
import { BaseController } from './BaseController';
import { ScanService } from '../services/ScanService';
import { PriceTrackingService } from '../services/PriceTrackingService';

export class ScanController extends BaseController {
  private scanService: ScanService;
  private priceTrackingService?: PriceTrackingService;

  constructor(scanService: ScanService, priceTrackingService?: PriceTrackingService) {
    super('ScanController');
    this.scanService = scanService;
    this.priceTrackingService = priceTrackingService;
  }

  getStatus = this.handleAsync(async (req: Request, res: Response) => {
    this.logRequest(req, 'GET', '/api/status');
    
    try {
      const status = await this.scanService.getScanStatus();
      this.success(res, status);
    } catch (error) {
      this.error(res, (error as Error).message, 500);
    }
  });

  getProgress = this.handleAsync(async (req: Request, res: Response) => {
    this.logRequest(req, 'GET', '/api/scan-progress');
    
    try {
      const progress = await this.scanService.getScanProgress();
      this.success(res, progress);
    } catch (error) {
      this.error(res, (error as Error).message, 500);
    }
  });

  startScan = this.handleAsync(async (req: Request, res: Response) => {
    this.logRequest(req, 'POST', '/api/start-scan');
    
    try {
      const result = await this.scanService.startManualScan();
      this.success(res, result, 'Scan started successfully', 202);
    } catch (error) {
      const errorMessage = (error as Error).message;
      if (errorMessage.includes('already running')) {
        this.error(res, errorMessage, 409);
      } else {
        this.error(res, errorMessage, 500);
      }
    }
  });

  getResults = this.handleAsync(async (req: Request, res: Response) => {
    this.logRequest(req, 'GET', '/api/scan-results');
    
    try {
      const results = await this.scanService.getLatestResults();
      this.success(res, results);
    } catch (error) {
      this.error(res, (error as Error).message, 500);
    }
  });

  getStocks = this.handleAsync(async (req: Request, res: Response) => {
    this.logRequest(req, 'GET', '/api/stocks');
    
    try {
      const { page, limit } = this.getPaginationParams(req);
      const { stocks, total } = await this.scanService.getStocksFromLatestScan(page, limit);
      
      const response = this.createPaginatedResponse(stocks, total, page, limit);
      res.json(response);
    } catch (error) {
      this.error(res, (error as Error).message, 500);
    }
  });

  getSelectedStocks = this.handleAsync(async (req: Request, res: Response) => {
    this.logRequest(req, 'GET', '/api/selected');
    
    try {
      const { page, limit } = this.getPaginationParams(req);
      const result = await this.scanService.getSelectedStocks(page, limit);
      
      if (!result || typeof result !== 'object' || !Array.isArray(result.stocks)) {
        this.logger.error('Invalid result from getSelectedStocks:', result);
        this.error(res, 'Invalid response from service', 500);
        return;
      }
      
      const { stocks, total } = result;
      const response = this.createPaginatedResponse(stocks, total, page, limit);
      res.json(response);
    } catch (error) {
      this.logger.error('Error in getSelectedStocks endpoint:', error);
      this.error(res, (error as Error).message, 500);
    }
  });

  getRejectedStocks = this.handleAsync(async (req: Request, res: Response) => {
    this.logRequest(req, 'GET', '/api/rejected');
    
    try {
      const { page, limit } = this.getPaginationParams(req);
      const { stocks, total } = await this.scanService.getRejectedStocksFromLatestScan(page, limit);
      
      const response = this.createPaginatedResponse(stocks, total, page, limit);
      res.json(response);
    } catch (error) {
      this.error(res, (error as Error).message, 500);
    }
  });

  getScanHistory = this.handleAsync(async (req: Request, res: Response) => {
    this.logRequest(req, 'GET', '/api/scan-history');
    
    try {
      const { page, limit } = this.getPaginationParams(req);
      const { scans, total } = await this.scanService.getScanHistory(page, limit);
      
      const response = this.createPaginatedResponse(scans, total, page, limit);
      res.json(response);
    } catch (error) {
      this.error(res, (error as Error).message, 500);
    }
  });

  getStatistics = this.handleAsync(async (req: Request, res: Response) => {
    this.logRequest(req, 'GET', '/api/statistics');

    try {
      // Get real statistics from the scan service with error handling
      let analysisStats = null;
      try {
        analysisStats = await this.scanService.getAnalysisStatistics();
      } catch (error) {
        this.logger.warn('Failed to get analysis statistics:', error);
        analysisStats = {
          total_analysis: 0,
          qualified_count: 0,
          rejected_count: 0,
          avg_duration: 0,
          avg_score: 0,
          consolidation_failures: 0,
          higher_low_failures: 0,
          volume_failures: 0,
          bear_squeeze_failures: 0
        };
      }

      // Get scan status for additional metrics
      let scanStatus = null;
      try {
        scanStatus = await this.scanService.getScanStatus();
      } catch (error) {
        this.logger.warn('Failed to get scan status:', error);
        scanStatus = {
          running: false,
          totalStocks: 0,
          qualifiedStocks: 0,
          analyzedStocks: 0,
          successRate: 0,
          lastScan: null,
          scanDuration: 0,
          nextScan: null,
          cronTime: '0 9 * * 1-5',
          timezone: 'Asia/Kolkata'
        };
      }

      // Get selected stocks summary for portfolio metrics
      let portfolioSummary = null;
      try {
        portfolioSummary = await this.scanService.getSelectedStocksSummary();
      } catch (error) {
        this.logger.warn('Failed to get portfolio summary:', error);
        portfolioSummary = {
          totalStocks: 0,
          totalValue: 0,
          totalPnL: 0,
          averagePnL: 0,
          stocksInProfit: 0,
          stocksInLoss: 0,
          stocksAtStopLoss: 0,
          targetsHit: { target1: 0, target2: 0, target3: 0 },
          stocks: []
        };
      }

      const statistics = {
        // Scan performance metrics
        totalScans: scanStatus.lastScan ? 1 : 0,
        lastScanDate: scanStatus.lastScan,
        totalStocksAnalyzed: analysisStats.total_analysis || 0,
        qualifiedStocks: analysisStats.qualified_count || 0,
        rejectedStocks: analysisStats.rejected_count || 0,
        successRate: analysisStats.total_analysis > 0
          ? ((analysisStats.qualified_count || 0) / analysisStats.total_analysis) * 100
          : 0,

        // Failure analysis
        failureReasons: {
          consolidationFailures: analysisStats.consolidation_failures || 0,
          higherLowFailures: analysisStats.higher_low_failures || 0,
          volumeFailures: analysisStats.volume_failures || 0,
          bearSqueezeFailures: analysisStats.bear_squeeze_failures || 0
        },

        // Performance metrics
        averageAnalysisDuration: analysisStats.avg_duration || 0,
        averageScore: analysisStats.avg_score || 0,

        // Portfolio metrics
        portfolioValue: portfolioSummary.totalValue || 0,
        totalPnL: portfolioSummary.totalPnL || 0,
        totalPnLPercent: portfolioSummary.totalValue > 0 ? (portfolioSummary.totalPnL / portfolioSummary.totalValue) * 100 : 0,
        activePositions: portfolioSummary.totalStocks || 0,

        // System health
        lastUpdated: new Date().toISOString(),
        status: "operational"
      };

      this.success(res, statistics);
    } catch (error) {
      this.logger.error('Error fetching statistics:', error);
      this.error(res, (error as Error).message, 500);
    }
  });

  analyzeStock = this.handleAsync(async (req: Request, res: Response) => {
    this.logRequest(req, 'POST', '/api/analyze-stock');

    try {
      const { symbol, lookbackDays = 120, includeIntraday = false } = req.body;

      if (!symbol) {
        return this.error(res, 'Symbol is required', 400);
      }

      // Validate symbol format
      if (typeof symbol !== 'string' || symbol.trim().length === 0) {
        return this.error(res, 'Invalid symbol format', 400);
      }

      // Perform real analysis
      const analysisResult = await this.scanService.analyzeSingleStock(
        symbol.trim().toUpperCase(),
        Math.min(Math.max(lookbackDays, 80), 365), // Limit between 80-365 days
        includeIntraday
      );

      this.success(res, analysisResult);
    } catch (error) {
      this.logger.error('Error analyzing stock:', error);
      this.error(res, (error as Error).message, 500);
    }
  });

  getQuote = this.handleAsync(async (req: Request, res: Response) => {
    const { symbol } = req.params;
    this.logRequest(req, 'GET', `/api/quote/${symbol}`);

    try {
      if (!symbol) {
        return this.error(res, 'Symbol is required', 400);
      }

      // Validate symbol format
      if (typeof symbol !== 'string' || symbol.trim().length === 0) {
        return this.error(res, 'Invalid symbol format', 400);
      }

      // Get real-time quote
      const quote = await this.scanService.getStockQuote(symbol.trim().toUpperCase());

      this.success(res, quote);
    } catch (error) {
      this.logger.error(`Error fetching quote for ${req.params.symbol}:`, error);
      this.error(res, `Failed to fetch quote: ${(error as Error).message}`, 500);
    }
  });

  getLogs = this.handleAsync(async (req: Request, res: Response) => {
    this.logRequest(req, 'GET', '/api/logs');

    try {
      const lines = Math.min(parseInt(req.query.lines as string) || 100, 500); // Max 500 lines

      // Get real logs from the scan service
      const logs = await this.scanService.getRecentLogs(lines);

      this.success(res, {
        logs,
        count: logs.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Error fetching logs:', error);
      this.error(res, (error as Error).message, 500);
    }
  });

  trackSelectedStocksPrices = this.handleAsync(async (req: Request, res: Response) => {
    this.logRequest(req, 'POST', '/api/selected/track-prices');
    
    if (!this.priceTrackingService) {
      this.error(res, 'Price tracking service not available', 500);
      return;
    }

    try {
      const results = await this.priceTrackingService.trackAllSelectedStocks();
      this.success(res, results, 'Price tracking started successfully', 202);
    } catch (error) {
      this.error(res, (error as Error).message, 500);
    }
  });

  getStockPriceHistory = this.handleAsync(async (req: Request, res: Response) => {
    const { symbol } = req.params;
    this.logRequest(req, 'GET', `/api/selected/${symbol}/prices`);
    
    if (!this.priceTrackingService) {
      this.error(res, 'Price tracking service not available', 500);
      return;
    }

    try {
      // Get selected stock ID from symbol - fetch all stocks to find the one we need
      const selectedStocks = await this.scanService.getSelectedStocks(1, 10000);
      const stock = selectedStocks.stocks.find((s: any) => s.symbol === symbol);
      
      if (!stock) {
        this.error(res, `Selected stock not found for symbol: ${symbol}`, 404);
        return;
      }

      // Get selected_stock_id from the stock data
      const selectedStockId = stock.selected_stock_id;
      if (!selectedStockId) {
        this.error(res, `Selected stock ID not found for symbol: ${symbol}`, 404);
        return;
      }

      const priceHistory = await this.priceTrackingService.getPriceHistory(selectedStockId);
      
      // Get current price and calculate movement
      const latestPrice = priceHistory.prices.length > 0 
        ? priceHistory.prices[priceHistory.prices.length - 1].close 
        : stock.current_price || stock.entry_price;
      
      const entryPrice = stock.entry_price || 0;
      const priceMovement = entryPrice > 0 
        ? ((latestPrice - entryPrice) / entryPrice) * 100 
        : 0;

      this.success(res, {
        ...priceHistory,
        entryPrice,
        currentPrice: latestPrice,
        priceMovement,
        symbol: stock.symbol,
        name: stock.name
      });
    } catch (error) {
      this.error(res, (error as Error).message, 500);
    }
  });

  getSelectedStocksSummary = this.handleAsync(async (req: Request, res: Response) => {
    this.logRequest(req, 'GET', '/api/selected/summary');

    try {
      const summary = await this.scanService.getSelectedStocksSummary();
      this.success(res, summary);
    } catch (error) {
      this.logger.error('Error getting selected stocks summary:', error);
      // Return default empty summary instead of error
      const defaultSummary = {
        totalStocks: 0,
        totalValue: 0,
        totalPnL: 0,
        averagePnL: 0,
        stocksInProfit: 0,
        stocksInLoss: 0,
        stocksAtStopLoss: 0,
        targetsHit: {
          target1: 0,
          target2: 0,
          target3: 0
        },
        stocks: []
      };
      this.success(res, defaultSummary);
    }
  });
}
