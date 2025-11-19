// src/services/ScanService.ts - Scan orchestration service

import { BaseService } from './BaseService';
import { StockRepository } from '../repositories/StockRepository';
import { StockAnalysisService } from './StockAnalysisService';
import { ScraperService } from './ScraperService';
import { StockDataService } from './StockDataService';
import { AppConfig, StockData, ScanResult } from '../types';
import { ScanRecord, StockRecord } from '../types/database';

export class ScanService extends BaseService {
  private stockRepository: StockRepository;
  private scraperService: ScraperService;
  private stockDataService: StockDataService;
  private config: AppConfig;
  private isRunning: boolean = false;
  private currentProgress: number = 0;
  private totalStocks: number = 0;
  private currentStage: string = '';

  private analysisService: StockAnalysisService;

  constructor(
    stockRepository: StockRepository,
    analysisService: StockAnalysisService,
    scraperService: ScraperService,
    stockDataService: StockDataService,
    config: AppConfig
  ) {
    super('ScanService');
    this.stockRepository = stockRepository;
    this.analysisService = analysisService;
    this.scraperService = scraperService;
    this.stockDataService = stockDataService;
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
      
      // Step 1: Check if stocks exist for today
      this.logger.info('🔍 Step 1: Checking if stocks were already scraped today...');
      const hasStocksToday = await this.stockRepository.hasStocksForToday();
      
      let scrapeResult: { stocks: StockData[]; totalCount: number; duration: number };
      let scanRecord: ScanRecord | null;
      let insertedStocks: StockRecord[];

      if (hasStocksToday) {
        // Fetch from database (cached)
        this.logger.info('💾 Found stocks from today in database. Fetching from cache...');
        const cachedStocks = await this.stockRepository.getStocksFromToday();
        scrapeResult = {
          stocks: cachedStocks,
          totalCount: cachedStocks.length,
          duration: 0 // No scraping time needed
        };
        this.logger.success(`✅ Fetched ${cachedStocks.length} stocks from today's cache`);

        // Get today's scan record (should always exist if hasStocksToday is true)
        scanRecord = await this.stockRepository.getTodayScanRecord();
        
        if (!scanRecord) {
          // This shouldn't happen if hasStocksToday is true, but handle edge case
          this.logger.error('⚠️ No scan record found for today despite stocks existing. Creating new scan record...');
          scanRecord = await this.stockRepository.createScan(
            cachedStocks.length,
            0, // Will be updated
            0, // Will be updated
            Math.round((Date.now() - startTime) / 1000)
          );
        } else {
          this.logger.info(`✅ Using existing scan record: ${scanRecord.id} from today`);
        }

        // Get stocks with their IDs from today's scan (using the scan record ID)
        // At this point scanRecord is guaranteed to be non-null
        const stocksWithIds = await this.stockRepository.getStocksFromTodayWithIds(scanRecord!.id);
        insertedStocks = stocksWithIds;
        this.logger.success(`✅ Retrieved ${insertedStocks.length} stocks with IDs from database`);
      } else {
        // Scrape from website (first time today)
        this.logger.info('📊 No stocks found for today. Scraping from Chartink...');
        scrapeResult = await this.scraperService.scrapeAllStocks();
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

        // Create scan record
        this.logger.info('💾 Creating scan record in database...');
        scanRecord = await this.stockRepository.createScan(
          scrapeResult.stocks.length,
          0, // Will be updated
          0, // Will be updated
          Math.round((Date.now() - startTime) / 1000)
        );
        this.logger.success(`✅ Scan record created with ID: ${scanRecord.id}`);

        // Insert stocks
        this.logger.info('💾 Inserting stocks into database...');
        insertedStocks = await this.stockRepository.insertStocks(scanRecord!.id, scrapeResult.stocks);
        this.logger.success(`✅ Inserted ${insertedStocks.length} stocks into database`);
      }

      // At this point, scanRecord is guaranteed to be non-null (set in both branches above)
      if (!scanRecord) {
        throw new Error('Scan record not created');
      }

      // Step 4: Check if analysis already exists for today's stocks
      this.logger.info('🔍 Step 4: Checking if analysis already exists for today\'s stocks...');
      const hasExistingAnalysis = await this.stockRepository.hasAnalysisForTodayStocks();
      
      let qualifiedCount = 0;
      let analyzedCount = 0;

      if (hasExistingAnalysis && hasStocksToday) {
        // Analysis already exists for today - fetch and use existing results
        this.logger.info('✅ Analysis already exists for today\'s stocks. Fetching existing results...');
        const stocksWithAnalysis = await this.stockRepository.getTodayStocksWithAnalysis();
        
        analyzedCount = stocksWithAnalysis.length;
        qualifiedCount = stocksWithAnalysis.filter((s: any) => s.qualified === true).length;
        
        this.logger.success(`✅ Retrieved existing analysis: ${qualifiedCount}/${analyzedCount} qualified`);
        this.logger.info('💡 To re-run analysis, wait until tomorrow or clear today\'s analysis records');
      } else {
        // No existing analysis - run full analysis
        this.logger.info('🔍 Step 5: Running technical analysis on stocks...');
        
        for (let i = 0; i < insertedStocks.length; i++) {
          const stock = insertedStocks[i];
        
          // Log progress every 10 stocks
          if (i % 10 === 0 || i === insertedStocks.length - 1) {
            this.logger.scanProgress(i + 1, insertedStocks.length, 'Technical Analysis');
          }
          
          try {
            // Fetch real stock data (daily bars) from Yahoo Finance
            // Yahoo Finance rate limit: ~60 requests/minute recommended
            // Add 1 second delay between requests to stay within limits
            if (i > 0) {
              await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
            }
            
            const dailyBars = await this.stockDataService.fetchDailyBars(stock.symbol, 120);
            
            if (dailyBars.length < 80) {
              this.logger.warn(`⚠️ ${stock.symbol}: Insufficient data (${dailyBars.length} days). Minimum 80 days required. Skipping...`);
              continue;
            }
            
            // Perform real analysis using StockAnalysisService
            const analysisResult = await this.analysisService.analyzeStock({
              symbol: stock.symbol,
              dailyBars: dailyBars,
              intradayBars: undefined
            });
            
            // Build detailed rejection reason from analysis details
            // Only show the rule that actually failed (based on failedAt)
            // Don't show subsequent rules that weren't checked due to early exit
            let detailedReason = analysisResult.reason;
            if (!analysisResult.qualified && analysisResult.details && analysisResult.failedAt) {
              const details = analysisResult.details;
              const failedAt = analysisResult.failedAt;
              
              // Only include the rule that actually failed
              // ACTUAL rule execution order in SwingStrategyService:
              // Rule 1: Consolidation (mapped to failedAt=1)
              // Rule 2: Higher Low (mapped to failedAt=2)
              // Rule 3: Volume Pump (mapped to failedAt=3)
              // Rule 4: Bear Squeeze (mapped to failedAt=4)
              if (failedAt === 1 && details.consolidation && !details.consolidation.pass) {
                detailedReason = `Rule 1 (Consolidation): ${details.consolidation.reason || 'Failed'}`;
              } else if (failedAt === 2 && details.higherLow && !details.higherLow.pass) {
                detailedReason = `Rule 2 (Higher Low Structure): ${details.higherLow.reason || 'Failed'}`;
              } else if (failedAt === 3 && details.volumePump && !details.volumePump.pass) {
                detailedReason = `Rule 3 (Volume Pump): ${details.volumePump.reason || 'Failed'}`;
              } else if (failedAt === 4 && details.bearSqueeze && !details.bearSqueeze.pass) {
                detailedReason = `Rule 4 (Bear Squeeze): ${details.bearSqueeze.reason || 'Failed'}`;
              }
              // If failedAt doesn't match expected values, use original reason
            }

            await this.stockRepository.insertStockAnalysis(stock.id, scanRecord.id, analysisResult);
            analyzedCount++;

            // Log individual stock analysis result with detailed rejection reason
            this.logger.stockAnalysis(
              stock.symbol, 
              analysisResult.qualified, 
              analysisResult.score,
              analysisResult.qualified ? undefined : detailedReason
            );
            
            // Log detailed failure information for rejected stocks
            if (!analysisResult.qualified) {
              const failedAt = analysisResult.failedAt || 0;
              const details = analysisResult.details;
              
              // Build rule status - only show rules that were actually checked
              // ACTUAL execution order: Consolidation (1) -> Higher Low (2) -> Volume (3) -> Bear Squeeze (4)
              const rules: Record<string, string> = {};
              if (failedAt >= 1) {
                rules.consolidation = details?.consolidation?.pass ? '✅' : '❌';
              }
              if (failedAt >= 2) {
                rules.higherLow = details?.higherLow?.pass ? '✅' : '❌';
              }
              if (failedAt >= 3) {
                rules.volumePump = details?.volumePump?.pass ? '✅' : '❌';
              }
              if (failedAt >= 4) {
                rules.bearSqueeze = details?.bearSqueeze?.pass ? '✅' : '❌';
              }
              
              this.logger.warn(`❌ ${stock.symbol} REJECTED at Rule ${failedAt || 'Unknown'}:`, {
                reason: detailedReason,
                score: analysisResult.score,
                failedAt: failedAt,
                rules: rules
              });
            }

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
    try {
      // Get latest scan results
      const latestScan = await this.stockRepository.getLatestScanResults();
      
      // Get overall statistics (with error handling)
      let statistics = null;
      try {
        statistics = await this.stockRepository.getAnalysisStatistics();
      } catch (statError) {
        this.logger.warn('Error fetching statistics (non-critical):', statError);
        // Continue without statistics
      }
      
      // Calculate metrics
      // Note: Database returns snake_case, but TypeScript interface uses camelCase
      // Database queries now return camelCase due to column aliases
      const totalStocks = latestScan?.totalStocksScraped || 0;
      const qualifiedStocks = latestScan?.stocksPassed || 0;
      const analyzedStocks = latestScan?.stocksAnalyzed || 0;
      const successRate = analyzedStocks > 0 ? Math.round((qualifiedStocks / analyzedStocks) * 100) : 0;
      
      return {
        running: this.isRunning,
        totalStocks,
        qualifiedStocks,
        analyzedStocks,
        successRate,
        lastScan: latestScan?.scanDate ? new Date(latestScan.scanDate).toISOString() : null,
        scanDuration: latestScan?.scanDurationSeconds || 0,
        nextScan: null,
        cronTime: this.config.scheduler.scanCron,
        timezone: this.config.scheduler.timezone
      };
    } catch (error) {
      this.logger.error('Error in getScanStatus:', error);
      // Return default values on error
      return {
        running: this.isRunning,
        totalStocks: 0,
        qualifiedStocks: 0,
        analyzedStocks: 0,
        successRate: 0,
        lastScan: null,
        scanDuration: 0,
        nextScan: null,
        cronTime: this.config.scheduler.scanCron,
        timezone: this.config.scheduler.timezone
      };
    }
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
    try {
      const results = await this.stockRepository.getLatestScanResults();
      return results || null;
    } catch (error) {
      this.logger.error('Error in getLatestResults:', error);
      throw error;
    }
  }

  async getStocksFromLatestScan(_page: number = 1, _limit: number = 10): Promise<{ stocks: any[], total: number }> {
    // Get all stocks (not just latest scan) to allow grouping by date
    const allStocks = await this.stockRepository.getAllStocksWithAnalysis();
    const total = allStocks.length;
    const startIndex = (_page - 1) * _limit;
    const endIndex = startIndex + _limit;
    const paginatedStocks = allStocks.slice(startIndex, endIndex);
    
    return { stocks: paginatedStocks, total };
  }

  async getSelectedStocks(page: number = 1, limit: number = 10): Promise<{ stocks: any[], total: number }> {
    try {
      const allStocks = await this.stockRepository.getSelectedStocks();
      
      if (!Array.isArray(allStocks)) {
        this.logger.error('getSelectedStocks returned non-array result');
        return { stocks: [], total: 0 };
      }
      
      const total = allStocks.length;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedStocks = allStocks.slice(startIndex, endIndex);
      
      return { stocks: paginatedStocks, total };
    } catch (error) {
      this.logger.error('Error in getSelectedStocks:', error);
      throw error;
    }
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
    // Get all stocks (not just latest scan) to allow grouping by date
    const allStocks = await this.stockRepository.getAllStocksWithAnalysis();
    
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