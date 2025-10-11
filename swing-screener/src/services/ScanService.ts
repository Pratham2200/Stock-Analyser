// src/services/ScanService.ts - Scan orchestration service

import { BaseService } from './BaseService';
import { StockRepository } from '../repositories/StockRepository';
import { StockAnalysisService } from './StockAnalysisService';
import { ScraperService } from './ScraperService';
import { NotificationService } from './NotificationService';
import { AppConfig } from '../types';
import { ScanResult } from '../types';

export class ScanService extends BaseService {
  private stockRepository: StockRepository;
  private scraperService: ScraperService;
  private config: AppConfig;
  private isRunning: boolean = false;
  private currentProgress: number = 0;
  private totalStocks: number = 0;
  private currentStage: string = '';

  constructor(
    stockRepository: StockRepository,
    _analysisService: StockAnalysisService,
    scraperService: ScraperService,
    _notificationService: NotificationService,
    config: AppConfig
  ) {
    super('ScanService');
    this.stockRepository = stockRepository;
    this.scraperService = scraperService;
    this.config = config;
  }

  async startManualScan(): Promise<ScanResult> {
    if (this.isRunning) {
      this.logger.error('Scan is already running');
      throw new Error('Scan is already running');
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      this.logger.info('🚀 Starting manual scan...');
      
      // Step 1: Scrape stocks
      this.logger.info('📊 Step 1: Scraping stocks from Chartink...');
      const scrapeResult = await this.scraperService.scrapeAllStocks();
      this.logger.success(`✅ Scraped ${scrapeResult.stocks.length} stocks from Chartink`);

      if (scrapeResult.stocks.length === 0) {
        this.logger.warn('⚠️ No stocks found during scraping');
        return {
          qualifiedCount: 0,
          totalCandidates: 0,
          successRate: 0,
          duration: Date.now() - startTime
        };
      }

      // Step 2: Create scan record
      this.logger.info('💾 Step 2: Creating scan record in database...');
      const scanRecord = await this.stockRepository.createScan(
        scrapeResult.stocks.length,
        0, // Will be updated
        0, // Will be updated
        Math.round((Date.now() - startTime) / 1000)
      );
      this.logger.success(`✅ Scan record created with ID: ${scanRecord.id}`);

      // Step 3: Insert stocks
      this.logger.info('💾 Step 3: Inserting stocks into database...');
      const insertedStocks = await this.stockRepository.insertStocks(scanRecord.id, scrapeResult.stocks);
      this.logger.success(`✅ Inserted ${insertedStocks.length} stocks into database`);

      // Step 4: Analyze stocks
      this.logger.info('🔍 Step 4: Analyzing stocks with technical indicators...');
      let qualifiedCount = 0;
      let analyzedCount = 0;

      for (let i = 0; i < insertedStocks.length; i++) {
        const stock = insertedStocks[i];
        
        // Log progress every 10 stocks
        if (i % 10 === 0 || i === insertedStocks.length - 1) {
          this.logger.scanProgress(i + 1, insertedStocks.length, 'Technical Analysis');
        }
        
        try {
          // For now, create a mock analysis result
          const analysisResult = {
            qualified: Math.random() > 0.7, // 30% qualification rate
            score: Math.floor(Math.random() * 100),
            failedAt: 0,
            reason: 'Mock analysis',
            currentPrice: 100 + Math.random() * 1000,
            ema10: 100 + Math.random() * 1000,
            ema20: 100 + Math.random() * 1000,
            details: {
              consolidation: { pass: true, status: 'consolidated', reason: 'Mock', basePrice: 100, currentMove: 2, consolidationDays: 20, range: { high: 110, low: 90, range: 20, rangePercent: 20 } },
              higherLow: { pass: true, status: 'higher_low', reason: 'Mock', higherLowCount: 2, recentLows: [90, 95], trend: 'up' as const, strength: 0.8 },
              volumePump: { pass: false, status: 'no_volume_pump', reason: 'Mock', volumeRatio: 1.2, averageVolume: 1000, currentVolume: 1200, volumeTrend: 'increasing' as const },
              bearSqueeze: { pass: true, status: 'bear_squeeze', reason: 'Mock', squeezeCount: 1, recentSqueezes: [], bearishPressure: 0.3, bullishMomentum: 0.7 },
              overall: { score: 75, grade: 'B' as const, recommendation: 'buy' as const, confidence: 0.8, riskLevel: 'medium' as const }
            },
            analysisDurationMs: 100,
            dataPointsDaily: 120,
            dataPointsIntraday: 0
          };

          await this.stockRepository.insertStockAnalysis(stock.id, scanRecord.id, analysisResult);
          analyzedCount++;

          // Log individual stock analysis result with proper rejection reason
          this.logger.stockAnalysis(
            stock.symbol, 
            analysisResult.qualified, 
            analysisResult.score,
            analysisResult.qualified ? undefined : analysisResult.reason
          );

          if (analysisResult.qualified) {
            qualifiedCount++;
            await this.stockRepository.insertSelectedStock(stock.id, scanRecord.id, {
              entryPrice: analysisResult.currentPrice || 0,
              stopLoss: (analysisResult.currentPrice || 0) * 0.95,
              target1: (analysisResult.currentPrice || 0) * 1.15,
              target2: (analysisResult.currentPrice || 0) * 1.30,
              target3: (analysisResult.currentPrice || 0) * 1.50,
              positionSize: 100,
              positionValue: (analysisResult.currentPrice || 0) * 100
            });
          }
        } catch (error) {
          this.logger.error(`❌ Failed to analyze ${stock.symbol}:`, error);
        }
      }

      const duration = Date.now() - startTime;
      const successRate = analyzedCount > 0 ? (qualifiedCount / analyzedCount) * 100 : 0;

      // Log performance metrics
      this.logger.performance('Stock Analysis', duration, {
        totalStocks: analyzedCount,
        qualifiedStocks: qualifiedCount,
        successRate: `${successRate.toFixed(1)}%`
      });

      this.logger.success(`🎉 Scan completed: ${qualifiedCount}/${analyzedCount} qualified (${successRate.toFixed(1)}%)`);

      return {
        qualifiedCount,
        totalCandidates: analyzedCount,
        successRate,
        duration
      };

    } catch (error) {
      this.logger.error('❌ Manual scan failed:', error);
      this.handleError(error, 'Manual scan failed');
    } finally {
      this.isRunning = false;
      this.logger.info('🔚 Scan process completed');
    }
  }

  async getScanStatus(): Promise<any> {
    return {
      running: this.isRunning,
      lastScan: {
        start: null,
        end: null,
        count: 0,
        error: null
      },
      nextScan: null,
      cronTime: this.config.scheduler.scanCron,
      timezone: this.config.scheduler.timezone
    };
  }

  async getScanProgress(): Promise<any> {
    return {
      running: this.isRunning,
      progress: this.currentProgress,
      total: this.totalStocks,
      percentage: this.totalStocks > 0 ? Math.round((this.currentProgress / this.totalStocks) * 100) : 0,
      stage: this.currentStage
    };
  }

  async getLatestResults(): Promise<any> {
    return await this.stockRepository.getLatestScanResults();
  }

  async getStocksFromLatestScan(_page: number = 1, _limit: number = 10): Promise<{ stocks: any[], total: number }> {
    const stocks = await this.stockRepository.getStocksFromLatestScan();
    const total = stocks.length;
    const startIndex = (_page - 1) * _limit;
    const endIndex = startIndex + _limit;
    const paginatedStocks = stocks.slice(startIndex, endIndex);
    
    return { stocks: paginatedStocks, total };
  }

  async getSelectedStocks(): Promise<any[]> {
    return await this.stockRepository.getSelectedStocks();
  }

  async getScanHistory(_page: number = 1, limit: number = 10): Promise<{ scans: any[], total: number }> {
    const scans = await this.stockRepository.getScanHistory(limit);
    return { scans, total: scans.length };
  }

  async getAnalysisStatistics(): Promise<any> {
    return await this.stockRepository.getAnalysisStatistics();
  }

  async analyzeSingleStock(symbol: string, _lookbackDays: number = 120, _includeIntraday: boolean = false): Promise<any> {
    // Mock analysis for now
    return {
      symbol,
      qualified: Math.random() > 0.5,
      score: Math.floor(Math.random() * 100),
      reason: 'Mock analysis result',
      details: {
        consolidation: { pass: true, status: 'consolidated' },
        higherLow: { pass: true, status: 'higher_low' },
        volumePump: { pass: false, status: 'no_volume_pump' },
        bearSqueeze: { pass: true, status: 'bear_squeeze' }
      }
    };
  }

  async getStockQuote(symbol: string): Promise<any> {
    // Mock quote for now
    return {
      symbol,
      price: 100 + Math.random() * 1000,
      change: (Math.random() - 0.5) * 10,
      changePercent: (Math.random() - 0.5) * 5
    };
  }

  async getRejectedStocksFromLatestScan(page: number = 1, limit: number = 10): Promise<{ stocks: any[], total: number }> {
    const allStocks = await this.stockRepository.getStocksFromLatestScan();
    
    // Filter for rejected stocks (qualified = false)
    const rejectedStocks = allStocks.filter((stock: any) => !stock.qualified);
    
    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedStocks = rejectedStocks.slice(startIndex, endIndex);
    
    return {
      stocks: paginatedStocks,
      total: rejectedStocks.length
    };
  }

  async getRecentLogs(_lines: number = 100): Promise<string[]> {
    // Mock logs for now
    return [
      '2024-01-01 10:00:00 INFO [ScanService] Scan started',
      '2024-01-01 10:01:00 INFO [ScanService] Scraped 50 stocks',
      '2024-01-01 10:02:00 INFO [ScanService] Analysis completed',
      '2024-01-01 10:03:00 INFO [ScanService] Scan finished'
    ];
  }
}