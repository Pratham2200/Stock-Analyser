"use strict";
// src/controllers/ScanController.ts - Scan management controller
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScanController = void 0;
const BaseController_1 = require("./BaseController");
class ScanController extends BaseController_1.BaseController {
    constructor(scanService, priceTrackingService) {
        super('ScanController');
        this.getStatus = this.handleAsync(async (req, res) => {
            this.logRequest(req, 'GET', '/api/status');
            try {
                const status = await this.scanService.getScanStatus();
                this.success(res, status);
            }
            catch (error) {
                this.error(res, error.message, 500);
            }
        });
        this.getProgress = this.handleAsync(async (req, res) => {
            this.logRequest(req, 'GET', '/api/scan-progress');
            try {
                const progress = await this.scanService.getScanProgress();
                this.success(res, progress);
            }
            catch (error) {
                this.error(res, error.message, 500);
            }
        });
        this.startScan = this.handleAsync(async (req, res) => {
            this.logRequest(req, 'POST', '/api/start-scan');
            try {
                const result = await this.scanService.startManualScan();
                this.success(res, result, 'Scan started successfully', 202);
            }
            catch (error) {
                const errorMessage = error.message;
                if (errorMessage.includes('already running')) {
                    this.error(res, errorMessage, 409);
                }
                else {
                    this.error(res, errorMessage, 500);
                }
            }
        });
        this.getResults = this.handleAsync(async (req, res) => {
            this.logRequest(req, 'GET', '/api/scan-results');
            try {
                const results = await this.scanService.getLatestResults();
                this.success(res, results);
            }
            catch (error) {
                this.error(res, error.message, 500);
            }
        });
        this.getStocks = this.handleAsync(async (req, res) => {
            this.logRequest(req, 'GET', '/api/stocks');
            try {
                const { page, limit } = this.getPaginationParams(req);
                const { stocks, total } = await this.scanService.getStocksFromLatestScan(page, limit);
                const response = this.createPaginatedResponse(stocks, total, page, limit);
                res.json(response);
            }
            catch (error) {
                this.error(res, error.message, 500);
            }
        });
        this.getSelectedStocks = this.handleAsync(async (req, res) => {
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
            }
            catch (error) {
                this.logger.error('Error in getSelectedStocks endpoint:', error);
                this.error(res, error.message, 500);
            }
        });
        this.getRejectedStocks = this.handleAsync(async (req, res) => {
            this.logRequest(req, 'GET', '/api/rejected');
            try {
                const { page, limit } = this.getPaginationParams(req);
                const { stocks, total } = await this.scanService.getRejectedStocksFromLatestScan(page, limit);
                const response = this.createPaginatedResponse(stocks, total, page, limit);
                res.json(response);
            }
            catch (error) {
                this.error(res, error.message, 500);
            }
        });
        this.getScanHistory = this.handleAsync(async (req, res) => {
            this.logRequest(req, 'GET', '/api/scan-history');
            try {
                const { page, limit } = this.getPaginationParams(req);
                const { scans, total } = await this.scanService.getScanHistory(page, limit);
                const response = this.createPaginatedResponse(scans, total, page, limit);
                res.json(response);
            }
            catch (error) {
                this.error(res, error.message, 500);
            }
        });
        this.getStatistics = this.handleAsync(async (req, res) => {
            this.logRequest(req, 'GET', '/api/statistics');
            try {
                // Coming soon - return placeholder data
                this.success(res, {
                    message: "Statistics feature coming soon!",
                    status: "development",
                    features: ["Advanced analytics", "Performance metrics", "Risk analysis"],
                    estimatedRelease: "Q1 2025"
                });
            }
            catch (error) {
                this.error(res, error.message, 500);
            }
        });
        this.analyzeStock = this.handleAsync(async (req, res) => {
            this.logRequest(req, 'POST', '/api/analyze-stock');
            try {
                // Coming soon - return placeholder data
                this.success(res, {
                    message: "Individual stock analysis coming soon!",
                    status: "development",
                    features: ["Real-time analysis", "Technical indicators", "Risk assessment"],
                    estimatedRelease: "Q1 2025"
                });
            }
            catch (error) {
                this.error(res, error.message, 400);
            }
        });
        this.getQuote = this.handleAsync(async (req, res) => {
            this.logRequest(req, 'GET', `/api/quote/${req.params.symbol}`);
            try {
                // Coming soon - return placeholder data
                this.success(res, {
                    message: "Real-time quotes coming soon!",
                    status: "development",
                    features: ["Live price updates", "Market data", "Price alerts"],
                    estimatedRelease: "Q1 2025"
                });
            }
            catch (error) {
                this.error(res, error.message, 500);
            }
        });
        this.getLogs = this.handleAsync(async (req, res) => {
            this.logRequest(req, 'GET', '/api/logs');
            try {
                // Coming soon - return placeholder data
                this.success(res, {
                    message: "Advanced logging coming soon!",
                    status: "development",
                    features: ["Real-time logs", "Error tracking", "Performance monitoring"],
                    estimatedRelease: "Q1 2025"
                });
            }
            catch (error) {
                this.error(res, error.message, 500);
            }
        });
        this.trackSelectedStocksPrices = this.handleAsync(async (req, res) => {
            this.logRequest(req, 'POST', '/api/selected/track-prices');
            if (!this.priceTrackingService) {
                this.error(res, 'Price tracking service not available', 500);
                return;
            }
            try {
                const results = await this.priceTrackingService.trackAllSelectedStocks();
                this.success(res, results, 'Price tracking started successfully', 202);
            }
            catch (error) {
                this.error(res, error.message, 500);
            }
        });
        this.getStockPriceHistory = this.handleAsync(async (req, res) => {
            const { symbol } = req.params;
            this.logRequest(req, 'GET', `/api/selected/${symbol}/prices`);
            if (!this.priceTrackingService) {
                this.error(res, 'Price tracking service not available', 500);
                return;
            }
            try {
                // Get selected stock ID from symbol - fetch all stocks to find the one we need
                const selectedStocks = await this.scanService.getSelectedStocks(1, 10000);
                const stock = selectedStocks.stocks.find((s) => s.symbol === symbol);
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
            }
            catch (error) {
                this.error(res, error.message, 500);
            }
        });
        this.getSelectedStocksSummary = this.handleAsync(async (req, res) => {
            this.logRequest(req, 'GET', '/api/selected/summary');
            try {
                const summary = await this.scanService.getSelectedStocksSummary();
                this.success(res, summary);
            }
            catch (error) {
                this.error(res, error.message, 500);
            }
        });
        this.scanService = scanService;
        this.priceTrackingService = priceTrackingService;
    }
}
exports.ScanController = ScanController;
//# sourceMappingURL=ScanController.js.map