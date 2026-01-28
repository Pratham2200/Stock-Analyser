// src/services/ScanService.ts - Scan orchestration service

import { BaseService } from './BaseService';
import { StockRepository } from '../repositories/StockRepository';
import { PriceTrackingRepository } from '../repositories/PriceTrackingRepository';
import { StockAnalysisService } from './StockAnalysisService';
import { ScraperService } from './ScraperService';
import { StockDataService } from './StockDataService';
import { AppConfig, StockData, ScanResult } from '../types';
import { ScanRecord, StockRecord } from '../types/database';

export class ScanService extends BaseService {
  private stockRepository: StockRepository;
  private priceTrackingRepository?: PriceTrackingRepository;
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
    config: AppConfig,
    priceTrackingRepository?: PriceTrackingRepository
  ) {
    super('ScanService');

    // Validate required dependencies
    if (!stockRepository) {
      throw new Error('StockRepository is required');
    }
    if (!analysisService) {
      throw new Error('StockAnalysisService is required');
    }
    if (!scraperService) {
      throw new Error('ScraperService is required');
    }
    if (!stockDataService) {
      throw new Error('StockDataService is required');
    }
    if (!config) {
      throw new Error('AppConfig is required');
    }

    this.stockRepository = stockRepository;
    this.priceTrackingRepository = priceTrackingRepository;
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

              // Get the highest price of the current day as entry price
              const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
              const todayBar = dailyBars.find((bar: any) => {
                const barDate = typeof bar.date === 'string' ? bar.date : bar.date.toISOString().split('T')[0];
                return barDate === today;
              });

              // Entry price is today's high (the highest price of the selection day)
              const entryPrice = todayBar ? todayBar.high : analysisResult.currentPrice || 0;
              const currentPrice = analysisResult.currentPrice || (todayBar ? todayBar.close : entryPrice);
              
              // Selection date is today (when stock is being selected)
              const selectionDateObj = new Date();
              selectionDateObj.setHours(0, 0, 0, 0);
              const selectionDateStr = selectionDateObj.toISOString().split('T')[0]; // YYYY-MM-DD

              // Perform price analysis for buy initiation and price ranges
              // Use the dailyBars data that was already fetched during scanning
              let buyInitiated = false;
              let highestPriceAfterSelection: number | undefined = undefined;
              let lowestPriceAfterSelection: number | undefined = undefined;
              let priceAnalysisPeriod = 0;

              try {
                // Filter prices AFTER selection date (including today)
                // This uses the dailyBars data already fetched during scanning
                const pricesAfterSelection = dailyBars.filter(bar => {
                  const barDateStr = typeof bar.date === 'string' 
                    ? bar.date.split('T')[0] 
                    : new Date(bar.date).toISOString().split('T')[0];
                  return barDateStr >= selectionDateStr;
                });

                if (pricesAfterSelection.length > 0) {
                  // Check if ANY price after selection reached or exceeded entry price
                  // Check both high and close prices
                  buyInitiated = pricesAfterSelection.some(bar => 
                    bar.high >= entryPrice || bar.close >= entryPrice
                  );

                  // ALWAYS calculate highest and lowest prices after selection (regardless of buy initiation)
                  const allPrices = pricesAfterSelection.flatMap(bar => [bar.high, bar.low, bar.close, bar.open]);
                  if (allPrices.length > 0) {
                    highestPriceAfterSelection = Math.max(...allPrices);
                    lowestPriceAfterSelection = Math.min(...allPrices);
                  } else {
                    // Fallback to current price if no prices found
                    highestPriceAfterSelection = currentPrice;
                    lowestPriceAfterSelection = currentPrice;
                  }

                  // Calculate analysis period (days since selection)
                  // For same-day selection, it's 1 day (today)
                  const todayDate = new Date();
                  todayDate.setHours(0, 0, 0, 0);
                  const daysDiff = Math.ceil((todayDate.getTime() - selectionDateObj.getTime()) / (1000 * 60 * 60 * 24));
                  priceAnalysisPeriod = Math.max(1, daysDiff);
                  
                  this.logger.debug(`📊 ${stock.symbol}: Found ${pricesAfterSelection.length} bars after selection, period=${priceAnalysisPeriod} days`);
                } else {
                  // No data after selection date - use today's bar if available
                  if (todayBar) {
                    buyInitiated = currentPrice >= entryPrice || todayBar.high >= entryPrice;
                    highestPriceAfterSelection = Math.max(todayBar.high, todayBar.low, currentPrice);
                    lowestPriceAfterSelection = Math.min(todayBar.high, todayBar.low, currentPrice);
                  } else {
                    buyInitiated = currentPrice >= entryPrice;
                    highestPriceAfterSelection = currentPrice;
                    lowestPriceAfterSelection = currentPrice;
                  }
                  priceAnalysisPeriod = 1;
                  this.logger.debug(`📊 ${stock.symbol}: No bars after selection, using today's data or current price`);
                }
                
                this.logger.info(`📊 Price analysis for ${stock.symbol}: entry=₹${entryPrice.toFixed(2)}, current=₹${currentPrice.toFixed(2)}, buyInitiated=${buyInitiated}, high=${highestPriceAfterSelection?.toFixed(2) || 'N/A'}, low=${lowestPriceAfterSelection?.toFixed(2) || 'N/A'}, period=${priceAnalysisPeriod} days`);
                
              } catch (error) {
                this.logger.warn(`⚠️ Could not perform price analysis for ${stock.symbol}:`, error);
                // Default: check if current price >= entry
                buyInitiated = currentPrice >= entryPrice;
                // Always set highest/lowest prices (use current price as fallback)
                highestPriceAfterSelection = currentPrice;
                lowestPriceAfterSelection = currentPrice;
                priceAnalysisPeriod = 1;
              }

              // Ensure all values are set (never undefined)
              const finalBuyInitiated = buyInitiated !== undefined ? buyInitiated : false;
              const finalHighestPrice = highestPriceAfterSelection !== undefined ? highestPriceAfterSelection : currentPrice;
              const finalLowestPrice = lowestPriceAfterSelection !== undefined ? lowestPriceAfterSelection : currentPrice;
              const finalPeriod = priceAnalysisPeriod > 0 ? priceAnalysisPeriod : 1;

              this.logger.info(`💾 Saving analysis for ${stock.symbol}: buyInitiated=${finalBuyInitiated}, high=₹${finalHighestPrice.toFixed(2)}, low=₹${finalLowestPrice.toFixed(2)}, period=${finalPeriod} days`);

              await this.stockRepository.insertSelectedStock(stock.id, scanRecord.id, {
                entryPrice: entryPrice,
                stopLoss: entryPrice * 0.95,
                target1: entryPrice * 1.15,
                target2: entryPrice * 1.30,
                target3: entryPrice * 1.50,
                positionSize: 100,
                positionValue: entryPrice * 100,
                buyInitiated: finalBuyInitiated,
                highestPriceAfterSelection: finalHighestPrice,
                lowestPriceAfterSelection: finalLowestPrice,
                priceAnalysisPeriod: finalPeriod
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

  async analyzeSingleStock(symbol: string, lookbackDays: number = 120, _includeIntraday: boolean = false): Promise<any> {
    try {
      this.logger.info(`🔍 Starting real analysis for ${symbol} with ${lookbackDays} days of data`);

      // Fetch real historical data
      const dailyBars = await this.stockDataService.fetchDailyBars(symbol, lookbackDays);

      if (dailyBars.length < 80) {
        return {
          symbol,
          qualified: false,
          score: 0,
          reason: `Insufficient data: Only ${dailyBars.length} days available, need at least 80 days`,
          details: {
            consolidation: { pass: false, status: 'insufficient_data' },
            higherLow: { pass: false, status: 'insufficient_data' },
            volumePump: { pass: false, status: 'insufficient_data' },
            bearSqueeze: { pass: false, status: 'insufficient_data' }
          }
        };
      }

      // Perform real technical analysis
      const analysisResult = await this.analysisService.analyzeStock({
        symbol,
        dailyBars: dailyBars,
        intradayBars: undefined
      });

      this.logger.success(`✅ Completed real analysis for ${symbol}: ${analysisResult.qualified ? 'QUALIFIED' : 'REJECTED'}`);

      return {
        symbol,
        qualified: analysisResult.qualified,
        score: analysisResult.score,
        reason: analysisResult.reason,
        currentPrice: analysisResult.currentPrice,
        ema10: analysisResult.ema10,
        ema20: analysisResult.ema20,
        details: analysisResult.details
      };
    } catch (error) {
      this.logger.error(`❌ Failed to analyze ${symbol}:`, error);
      return {
        symbol,
        qualified: false,
        score: 0,
        reason: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: {
          consolidation: { pass: false, status: 'error' },
          higherLow: { pass: false, status: 'error' },
          volumePump: { pass: false, status: 'error' },
          bearSqueeze: { pass: false, status: 'error' }
        }
      };
    }
  }

  async getStockQuote(symbol: string): Promise<any> {
    try {
      this.logger.info(`📊 Fetching real-time quote for ${symbol}`);

      // Fetch current price from Yahoo Finance
      const currentPrice = await this.stockDataService.fetchCurrentPrice(symbol);

      if (currentPrice === null) {
        throw new Error(`Unable to fetch quote for ${symbol}`);
      }

      // For change calculation, we need previous close price
      // Fetch 2 days of data to get yesterday's close
      const dailyBars = await this.stockDataService.fetchDailyBars(symbol, 2);

      let change = 0;
      let changePercent = 0;

      if (dailyBars.length >= 2) {
        // Sort by date (most recent first)
        dailyBars.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const yesterdayClose = dailyBars[1]?.close || dailyBars[0]?.close;
        if (yesterdayClose && yesterdayClose > 0) {
          change = currentPrice - yesterdayClose;
          changePercent = (change / yesterdayClose) * 100;
        }
      }

      this.logger.success(`✅ Fetched real quote for ${symbol}: ₹${currentPrice.toFixed(2)}`);

      return {
        symbol,
        price: currentPrice,
        change: change,
        changePercent: changePercent,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`❌ Failed to fetch quote for ${symbol}:`, error);
      throw error;
    }
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

  async getRecentLogs(lines: number = 100): Promise<string[]> {
    try {
      this.logger.info(`📋 Fetching recent logs (last ${lines} entries)`);

      // Get recent scan history and format as logs
      const scans = await this.stockRepository.getScanHistory(Math.min(lines, 50));

      const logEntries: string[] = [];

      // Add system status logs
      logEntries.push(`${new Date().toISOString()} INFO [System] System status check`);
      logEntries.push(`${new Date().toISOString()} INFO [ScanService] Log retrieval requested`);

      // Add scan history as logs
      scans.forEach((scan: any) => {
        const scanDate = new Date(scan.scanDate).toISOString();
        logEntries.push(`${scanDate} INFO [ScanService] Scan completed - ${scan.stocksPassed}/${scan.totalStocksScraped} stocks qualified`);
        logEntries.push(`${scanDate} INFO [ScanService] Analysis duration: ${scan.scanDurationSeconds}s`);
      });

      // Add current status logs
      const status = await this.getScanStatus();
      logEntries.push(`${new Date().toISOString()} INFO [ScanService] Current status: ${status.running ? 'Running' : 'Idle'}`);
      logEntries.push(`${new Date().toISOString()} INFO [ScanService] Total qualified stocks: ${status.qualifiedStocks}`);

      // Return the most recent entries (up to requested lines)
      return logEntries.slice(-lines);
    } catch (error) {
      this.logger.error('Failed to fetch logs:', error);
      return [
        `${new Date().toISOString()} ERROR [ScanService] Failed to retrieve logs: ${error instanceof Error ? error.message : 'Unknown error'}`,
        `${new Date().toISOString()} INFO [System] System operational`
      ];
    }
  }

  /**
   * Get summary statistics for all selected stocks
   */
  async getSelectedStocksSummary(): Promise<{
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
      buyInitiated: boolean;
      highestPriceAfterSelection?: number;
      lowestPriceAfterSelection?: number;
      priceAnalysisPeriod: number; // days since selection
    }>;
  }> {
    try {
      // Get all selected stocks
      const allStocks = await this.stockRepository.getSelectedStocks();
      
      if (!Array.isArray(allStocks) || allStocks.length === 0) {
        return {
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
      }

      const stocksSummary: any[] = [];
      let totalValue = 0;
      let totalPnL = 0;
      let stocksInProfit = 0;
      let stocksInLoss = 0;
      let stocksAtStopLoss = 0;
      const targetsHit = {
        target1: 0,
        target2: 0,
        target3: 0
      };

      // Process each stock - use cached analysis data
      for (const stock of allStocks) {
        const selectedStockId = stock.selected_stock_id;
        const entryPrice = Number(stock.entry_price) || 0;
        const stopLoss = Number(stock.stop_loss) || 0;
        const positionSize = Number(stock.position_size) || 0;
        const selectionDate = stock.scan_date || new Date().toISOString();

        // Get latest price from price tracking
        let currentPrice = Number(stock.current_price) || entryPrice;
        if (this.priceTrackingRepository && selectedStockId) {
          try {
            const latestPrice = await this.priceTrackingRepository.getLatestPrice(selectedStockId);
            if (latestPrice) {
              currentPrice = Number(latestPrice.close_price) || currentPrice;
            }
          } catch (error) {
            this.logger.debug(`Could not get latest price for ${stock.symbol}, using current_price`);
          }
        }

        // Use cached analysis data from database (fetched during scanning)
        // This uses the data that was calculated and saved during the scan process
        let buyInitiated = stock.buy_initiated !== undefined && stock.buy_initiated !== null 
          ? Boolean(stock.buy_initiated) 
          : false;
        
        let highestPriceAfterSelection = stock.highest_price_after_selection !== undefined && stock.highest_price_after_selection !== null
          ? Number(stock.highest_price_after_selection)
          : undefined;
          
        let lowestPriceAfterSelection = stock.lowest_price_after_selection !== undefined && stock.lowest_price_after_selection !== null
          ? Number(stock.lowest_price_after_selection)
          : undefined;
          
        let priceAnalysisPeriod = stock.price_analysis_period !== undefined && stock.price_analysis_period !== null
          ? Number(stock.price_analysis_period)
          : 0;

        // If data seems invalid (0 period or missing prices), use current price as fallback
        if (priceAnalysisPeriod === 0 || (highestPriceAfterSelection === undefined && lowestPriceAfterSelection === undefined)) {
          // Data might not be in database yet - use current price as fallback
          if (highestPriceAfterSelection === undefined) {
            highestPriceAfterSelection = currentPrice;
          }
          if (lowestPriceAfterSelection === undefined) {
            lowestPriceAfterSelection = currentPrice;
          }
          if (priceAnalysisPeriod === 0) {
            // Calculate days since selection
            const selectionDateObj = new Date(selectionDate);
            const todayDate = new Date();
            const daysDiff = Math.ceil((todayDate.getTime() - selectionDateObj.getTime()) / (1000 * 60 * 60 * 24));
            priceAnalysisPeriod = Math.max(1, daysDiff);
          }
          // Recalculate buy initiation if needed
          if (stock.buy_initiated === undefined || stock.buy_initiated === null) {
            buyInitiated = currentPrice >= entryPrice;
          }
        }

        // Get targets hit
        const targetsHitList: string[] = [];
        let stoplossHit = false;
        if (this.priceTrackingRepository && selectedStockId) {
          try {
            const targetsHitRecords = await this.priceTrackingRepository.getTargetsHit(selectedStockId);
            targetsHitRecords.forEach(record => {
              if (record.target_type === 'stoploss') {
                stoplossHit = true;
              } else {
                targetsHitList.push(record.target_type);
                if (record.target_type === 'target1') targetsHit.target1++;
                if (record.target_type === 'target2') targetsHit.target2++;
                if (record.target_type === 'target3') targetsHit.target3++;
              }
            });
          } catch (error) {
            this.logger.debug(`Could not get targets hit for ${stock.symbol}`);
          }
        }

        // Calculate P&L
        const priceMovement = entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0;
        const positionValue = currentPrice * positionSize;
        const pnl = (currentPrice - entryPrice) * positionSize;

        totalValue += positionValue;
        totalPnL += pnl;

        if (priceMovement > 0) {
          stocksInProfit++;
        } else if (priceMovement < 0) {
          stocksInLoss++;
        }

        if (stoplossHit || (stopLoss > 0 && currentPrice <= stopLoss)) {
          stocksAtStopLoss++;
        }

        stocksSummary.push({
          symbol: stock.symbol,
          name: stock.name,
          entryPrice: Number(entryPrice),
          currentPrice: Number(currentPrice),
          priceMovement: Number(priceMovement.toFixed(2)),
          selectionDate: selectionDate,
          stopLoss: Number(stopLoss),
          target1: Number(stock.target_1) || 0,
          target2: Number(stock.target_2) || 0,
          target3: Number(stock.target_3) || 0,
          positionSize: Number(positionSize),
          positionValue: Number(positionValue.toFixed(2)),
          targetsHit: targetsHitList,
          stoplossHit,
          buyInitiated,
          highestPriceAfterSelection,
          lowestPriceAfterSelection,
          priceAnalysisPeriod
        });
      }

      const averagePnL = allStocks.length > 0 ? totalPnL / allStocks.length : 0;

      return {
        totalStocks: allStocks.length,
        totalValue: Number(totalValue.toFixed(2)),
        totalPnL: Number(totalPnL.toFixed(2)),
        averagePnL: Number(averagePnL.toFixed(2)),
        stocksInProfit,
        stocksInLoss,
        stocksAtStopLoss,
        targetsHit,
        stocks: stocksSummary
      };
    } catch (error) {
      this.logger.error('Error getting selected stocks summary:', error);
      throw error;
    }
  }
}