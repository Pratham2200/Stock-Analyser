"use strict";
// src/services/ScanService.ts - Scan orchestration service
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScanService = void 0;
const BaseService_1 = require("./BaseService");
class ScanService extends BaseService_1.BaseService {
    constructor(stockRepository, analysisService, scraperService, stockDataService, config, priceTrackingRepository) {
        super('ScanService');
        this.isRunning = false;
        this.currentProgress = 0;
        this.totalStocks = 0;
        this.currentStage = '';
        this.stockRepository = stockRepository;
        this.priceTrackingRepository = priceTrackingRepository;
        this.analysisService = analysisService;
        this.scraperService = scraperService;
        this.stockDataService = stockDataService;
        this.config = config;
    }
    async startManualScan() {
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
            let scrapeResult;
            let scanRecord;
            let insertedStocks;
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
                    scanRecord = await this.stockRepository.createScan(cachedStocks.length, 0, // Will be updated
                    0, // Will be updated
                    Math.round((Date.now() - startTime) / 1000));
                }
                else {
                    this.logger.info(`✅ Using existing scan record: ${scanRecord.id} from today`);
                }
                // Get stocks with their IDs from today's scan (using the scan record ID)
                // At this point scanRecord is guaranteed to be non-null
                const stocksWithIds = await this.stockRepository.getStocksFromTodayWithIds(scanRecord.id);
                insertedStocks = stocksWithIds;
                this.logger.success(`✅ Retrieved ${insertedStocks.length} stocks with IDs from database`);
            }
            else {
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
                scanRecord = await this.stockRepository.createScan(scrapeResult.stocks.length, 0, // Will be updated
                0, // Will be updated
                Math.round((Date.now() - startTime) / 1000));
                this.logger.success(`✅ Scan record created with ID: ${scanRecord.id}`);
                // Insert stocks
                this.logger.info('💾 Inserting stocks into database...');
                insertedStocks = await this.stockRepository.insertStocks(scanRecord.id, scrapeResult.stocks);
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
                qualifiedCount = stocksWithAnalysis.filter((s) => s.qualified === true).length;
                this.logger.success(`✅ Retrieved existing analysis: ${qualifiedCount}/${analyzedCount} qualified`);
                this.logger.info('💡 To re-run analysis, wait until tomorrow or clear today\'s analysis records');
            }
            else {
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
                            }
                            else if (failedAt === 2 && details.higherLow && !details.higherLow.pass) {
                                detailedReason = `Rule 2 (Higher Low Structure): ${details.higherLow.reason || 'Failed'}`;
                            }
                            else if (failedAt === 3 && details.volumePump && !details.volumePump.pass) {
                                detailedReason = `Rule 3 (Volume Pump): ${details.volumePump.reason || 'Failed'}`;
                            }
                            else if (failedAt === 4 && details.bearSqueeze && !details.bearSqueeze.pass) {
                                detailedReason = `Rule 4 (Bear Squeeze): ${details.bearSqueeze.reason || 'Failed'}`;
                            }
                            // If failedAt doesn't match expected values, use original reason
                        }
                        await this.stockRepository.insertStockAnalysis(stock.id, scanRecord.id, analysisResult);
                        analyzedCount++;
                        // Log individual stock analysis result with detailed rejection reason
                        this.logger.stockAnalysis(stock.symbol, analysisResult.qualified, analysisResult.score, analysisResult.qualified ? undefined : detailedReason);
                        // Log detailed failure information for rejected stocks
                        if (!analysisResult.qualified) {
                            const failedAt = analysisResult.failedAt || 0;
                            const details = analysisResult.details;
                            // Build rule status - only show rules that were actually checked
                            // ACTUAL execution order: Consolidation (1) -> Higher Low (2) -> Volume (3) -> Bear Squeeze (4)
                            const rules = {};
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
                    }
                    catch (error) {
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
        }
        catch (error) {
            this.logger.error('❌ Manual scan failed:', error);
            this.handleError(error, 'Manual scan failed');
        }
        finally {
            this.isRunning = false;
            this.logger.info('🔚 Scan process completed');
        }
    }
    async getScanStatus() {
        try {
            // Get latest scan results
            const latestScan = await this.stockRepository.getLatestScanResults();
            // Get overall statistics (with error handling)
            let statistics = null;
            try {
                statistics = await this.stockRepository.getAnalysisStatistics();
            }
            catch (statError) {
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
        }
        catch (error) {
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
    async getScanProgress() {
        return {
            running: this.isRunning,
            progress: this.currentProgress,
            total: this.totalStocks,
            percentage: this.totalStocks > 0 ? Math.round((this.currentProgress / this.totalStocks) * 100) : 0,
            stage: this.currentStage
        };
    }
    async getLatestResults() {
        try {
            const results = await this.stockRepository.getLatestScanResults();
            return results || null;
        }
        catch (error) {
            this.logger.error('Error in getLatestResults:', error);
            throw error;
        }
    }
    async getStocksFromLatestScan(_page = 1, _limit = 10) {
        // Get all stocks (not just latest scan) to allow grouping by date
        const allStocks = await this.stockRepository.getAllStocksWithAnalysis();
        const total = allStocks.length;
        const startIndex = (_page - 1) * _limit;
        const endIndex = startIndex + _limit;
        const paginatedStocks = allStocks.slice(startIndex, endIndex);
        return { stocks: paginatedStocks, total };
    }
    async getSelectedStocks(page = 1, limit = 10) {
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
        }
        catch (error) {
            this.logger.error('Error in getSelectedStocks:', error);
            throw error;
        }
    }
    async getScanHistory(_page = 1, limit = 10) {
        const scans = await this.stockRepository.getScanHistory(limit);
        return { scans, total: scans.length };
    }
    async getAnalysisStatistics() {
        return await this.stockRepository.getAnalysisStatistics();
    }
    async analyzeSingleStock(symbol, _lookbackDays = 120, _includeIntraday = false) {
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
    async getStockQuote(symbol) {
        // Mock quote for now
        return {
            symbol,
            price: 100 + Math.random() * 1000,
            change: (Math.random() - 0.5) * 10,
            changePercent: (Math.random() - 0.5) * 5
        };
    }
    async getRejectedStocksFromLatestScan(page = 1, limit = 10) {
        // Get all stocks (not just latest scan) to allow grouping by date
        const allStocks = await this.stockRepository.getAllStocksWithAnalysis();
        // Filter for rejected stocks (qualified = false)
        const rejectedStocks = allStocks.filter((stock) => !stock.qualified);
        // Apply pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedStocks = rejectedStocks.slice(startIndex, endIndex);
        return {
            stocks: paginatedStocks,
            total: rejectedStocks.length
        };
    }
    async getRecentLogs(_lines = 100) {
        // Mock logs for now
        return [
            '2024-01-01 10:00:00 INFO [ScanService] Scan started',
            '2024-01-01 10:01:00 INFO [ScanService] Scraped 50 stocks',
            '2024-01-01 10:02:00 INFO [ScanService] Analysis completed',
            '2024-01-01 10:03:00 INFO [ScanService] Scan finished'
        ];
    }
    /**
     * Get summary statistics for all selected stocks
     */
    async getSelectedStocksSummary() {
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
            const stocksSummary = [];
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
            // Process each stock
            for (const stock of allStocks) {
                const selectedStockId = stock.selected_stock_id;
                const entryPrice = Number(stock.entry_price) || 0;
                const stopLoss = Number(stock.stop_loss) || 0;
                const positionSize = Number(stock.position_size) || 0;
                // Get latest price from price tracking
                let currentPrice = Number(stock.current_price) || entryPrice;
                if (this.priceTrackingRepository && selectedStockId) {
                    try {
                        const latestPrice = await this.priceTrackingRepository.getLatestPrice(selectedStockId);
                        if (latestPrice) {
                            currentPrice = Number(latestPrice.close_price) || currentPrice;
                        }
                    }
                    catch (error) {
                        this.logger.debug(`Could not get latest price for ${stock.symbol}, using current_price`);
                    }
                }
                // Get targets hit
                const targetsHitList = [];
                let stoplossHit = false;
                if (this.priceTrackingRepository && selectedStockId) {
                    try {
                        const targetsHitRecords = await this.priceTrackingRepository.getTargetsHit(selectedStockId);
                        targetsHitRecords.forEach(record => {
                            if (record.target_type === 'stoploss') {
                                stoplossHit = true;
                            }
                            else {
                                targetsHitList.push(record.target_type);
                                if (record.target_type === 'target1')
                                    targetsHit.target1++;
                                if (record.target_type === 'target2')
                                    targetsHit.target2++;
                                if (record.target_type === 'target3')
                                    targetsHit.target3++;
                            }
                        });
                    }
                    catch (error) {
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
                }
                else if (priceMovement < 0) {
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
                    selectionDate: stock.scan_date || new Date().toISOString(),
                    stopLoss: Number(stopLoss),
                    target1: Number(stock.target_1) || 0,
                    target2: Number(stock.target_2) || 0,
                    target3: Number(stock.target_3) || 0,
                    positionSize: Number(positionSize),
                    positionValue: Number(positionValue.toFixed(2)),
                    targetsHit: targetsHitList,
                    stoplossHit
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
        }
        catch (error) {
            this.logger.error('Error getting selected stocks summary:', error);
            throw error;
        }
    }
}
exports.ScanService = ScanService;
//# sourceMappingURL=ScanService.js.map