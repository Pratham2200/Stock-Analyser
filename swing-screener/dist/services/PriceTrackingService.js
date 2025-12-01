"use strict";
// src/services/PriceTrackingService.ts - Service for tracking prices of selected stocks
Object.defineProperty(exports, "__esModule", { value: true });
exports.PriceTrackingService = void 0;
const BaseService_1 = require("./BaseService");
const rateLimiter_1 = require("../utils/rateLimiter");
class PriceTrackingService extends BaseService_1.BaseService {
    constructor(stockDataService, priceTrackingRepository) {
        super('PriceTrackingService');
        this.rateLimiter = (0, rateLimiter_1.getGlobalRateLimiter)();
        this.stockDataService = stockDataService;
        this.priceTrackingRepository = priceTrackingRepository;
    }
    /**
     * Track prices for all selected stocks from their selection date
     */
    async trackAllSelectedStocks() {
        this.logger.info('🚀 Starting price tracking for all selected stocks...');
        try {
            // Get all selected stocks with their selection dates
            const selectedStocks = await this.priceTrackingRepository.getSelectedStocksWithDates();
            if (selectedStocks.length === 0) {
                this.logger.warn('No selected stocks found');
                return [];
            }
            this.logger.info(`Found ${selectedStocks.length} selected stocks to track`);
            const results = [];
            // Process each stock - rate limiting is handled by StockDataService
            // Additional delay here ensures we don't overwhelm the API when processing multiple stocks
            for (let i = 0; i < selectedStocks.length; i++) {
                const stock = selectedStocks[i];
                try {
                    this.logger.info(`Processing stock ${i + 1}/${selectedStocks.length}: ${stock.symbol}`);
                    const result = await this.trackStockPrices(stock);
                    results.push(result);
                    // Log rate limiter status
                    const requestCount = this.rateLimiter.getRequestCount();
                    if (requestCount > 0 && requestCount % 10 === 0) {
                        this.logger.info(`📊 Rate limiter status: ${requestCount} requests in current window`);
                    }
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    this.logger.error(`Error tracking ${stock.symbol}:`, errorMessage);
                    results.push({
                        symbol: stock.symbol,
                        success: false,
                        pricesFetched: 0,
                        error: errorMessage
                    });
                }
            }
            const successCount = results.filter(r => r.success).length;
            this.logger.success(`✅ Price tracking completed: ${successCount}/${selectedStocks.length} stocks tracked successfully`);
            return results;
        }
        catch (error) {
            this.handleError(error, 'Failed to track selected stocks');
            throw error;
        }
    }
    /**
     * Track prices for a single selected stock from its selection date
     */
    async trackStockPrices(stock) {
        try {
            this.logger.info(`📊 Tracking prices for ${stock.symbol} from ${stock.selection_date}...`);
            // Calculate days from selection date to today
            const selectionDate = new Date(stock.selection_date);
            const today = new Date();
            const daysDiff = Math.ceil((today.getTime() - selectionDate.getTime()) / (1000 * 60 * 60 * 24));
            // Fetch historical data (add buffer for weekends/holidays)
            const daysToFetch = Math.max(daysDiff + 10, 30); // Minimum 30 days
            const dailyBars = await this.stockDataService.fetchDailyBars(stock.symbol, daysToFetch);
            if (dailyBars.length === 0) {
                this.logger.warn(`No price data found for ${stock.symbol}`);
                return {
                    symbol: stock.symbol,
                    success: false,
                    pricesFetched: 0,
                    error: 'No price data available'
                };
            }
            // Filter prices from selection date onwards
            const selectionDateStr = selectionDate.toISOString().split('T')[0];
            const pricesAfterSelection = dailyBars.filter(bar => bar.date >= selectionDateStr);
            if (pricesAfterSelection.length === 0) {
                this.logger.warn(`No price data found for ${stock.symbol} after selection date ${selectionDateStr}`);
                return {
                    symbol: stock.symbol,
                    success: false,
                    pricesFetched: 0,
                    error: `No price data after selection date ${selectionDateStr}`
                };
            }
            // Calculate or validate targets and stoploss
            // If targets are null/undefined/zero, calculate them from entry price
            // Use first day's close price as fallback for entry price
            const entryPrice = (stock.entry_price && stock.entry_price > 0)
                ? stock.entry_price
                : (pricesAfterSelection[0]?.close || 0);
            const stopLoss = (stock.stop_loss && stock.stop_loss > 0)
                ? stock.stop_loss
                : (entryPrice * 0.95);
            const target1 = (stock.target1 && stock.target1 > 0)
                ? stock.target1
                : (entryPrice * 1.15);
            const target2 = (stock.target2 && stock.target2 > 0)
                ? stock.target2
                : (entryPrice * 1.30);
            const target3 = (stock.target3 && stock.target3 > 0)
                ? stock.target3
                : (entryPrice * 1.50);
            // Validate that we have valid prices
            if (!entryPrice || entryPrice <= 0) {
                this.logger.warn(`Invalid entry price for ${stock.symbol}: ${entryPrice}`);
                return {
                    symbol: stock.symbol,
                    success: false,
                    pricesFetched: 0,
                    error: 'Invalid entry price'
                };
            }
            // Store prices in database
            let pricesStored = 0;
            const targetsHit = [];
            let stoplossHit = false;
            for (const bar of pricesAfterSelection) {
                // Convert date to string if it's a Date object
                const dateStr = bar.date instanceof Date
                    ? bar.date.toISOString().split('T')[0]
                    : typeof bar.date === 'string'
                        ? bar.date.split('T')[0]
                        : String(bar.date);
                // Store price data
                await this.priceTrackingRepository.upsertPriceData(stock.id, stock.symbol, dateStr, bar.open, bar.high, bar.low, bar.close, bar.volume);
                pricesStored++;
                // Check if targets were hit - use actual price that hit the target
                if (target1 > 0 && bar.high >= target1 && !targetsHit.includes('target1')) {
                    await this.priceTrackingRepository.recordTargetHit(stock.id, stock.symbol, 'target1', dateStr, Math.max(target1, bar.high) // Use the higher of target or actual price
                    );
                    targetsHit.push('target1');
                }
                if (target2 > 0 && bar.high >= target2 && !targetsHit.includes('target2')) {
                    await this.priceTrackingRepository.recordTargetHit(stock.id, stock.symbol, 'target2', dateStr, Math.max(target2, bar.high) // Use the higher of target or actual price
                    );
                    targetsHit.push('target2');
                }
                if (target3 > 0 && bar.high >= target3 && !targetsHit.includes('target3')) {
                    await this.priceTrackingRepository.recordTargetHit(stock.id, stock.symbol, 'target3', dateStr, Math.max(target3, bar.high) // Use the higher of target or actual price
                    );
                    targetsHit.push('target3');
                }
                // Check if stoploss was hit - use actual price that hit the stoploss
                if (stopLoss > 0 && bar.low <= stopLoss && !stoplossHit) {
                    await this.priceTrackingRepository.recordTargetHit(stock.id, stock.symbol, 'stoploss', dateStr, Math.min(stopLoss, bar.low) // Use the lower of stoploss or actual price
                    );
                    stoplossHit = true;
                }
            }
            this.logger.success(`✅ Tracked ${pricesStored} days of prices for ${stock.symbol}`);
            return {
                symbol: stock.symbol,
                success: true,
                pricesFetched: pricesStored,
                targetsHit: targetsHit.length > 0 ? targetsHit : undefined,
                stoplossHit: stoplossHit || undefined
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`Error tracking prices for ${stock.symbol}:`, errorMessage);
            return {
                symbol: stock.symbol,
                success: false,
                pricesFetched: 0,
                error: errorMessage
            };
        }
    }
    /**
     * Get price history for a selected stock
     */
    async getPriceHistory(selectedStockId) {
        const prices = await this.priceTrackingRepository.getPriceHistory(selectedStockId);
        const targetsHit = await this.priceTrackingRepository.getTargetsHit(selectedStockId);
        const stoplossHit = targetsHit.find(t => t.target_type === 'stoploss') || null;
        const targetHits = targetsHit.filter(t => t.target_type !== 'stoploss');
        return {
            prices: prices.map(p => ({
                date: p.price_date,
                open: Number(p.open_price),
                high: Number(p.high_price),
                low: Number(p.low_price),
                close: Number(p.close_price),
                volume: Number(p.volume)
            })),
            targetsHit: targetHits.map(t => ({
                type: t.target_type,
                date: t.hit_date,
                price: Number(t.hit_price)
            })),
            stoplossHit: stoplossHit ? {
                date: stoplossHit.hit_date,
                price: Number(stoplossHit.hit_price)
            } : null
        };
    }
    /**
     * Get price history by symbol
     */
    async getPriceHistoryBySymbol(symbol, fromDate) {
        const prices = await this.priceTrackingRepository.getPriceHistoryBySymbol(symbol, fromDate);
        return prices.map(p => ({
            date: p.price_date,
            open: Number(p.open_price),
            high: Number(p.high_price),
            low: Number(p.low_price),
            close: Number(p.close_price),
            volume: Number(p.volume)
        }));
    }
}
exports.PriceTrackingService = PriceTrackingService;
//# sourceMappingURL=PriceTrackingService.js.map