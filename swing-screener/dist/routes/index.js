"use strict";
// src/routes/index.ts - Main routes configuration
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRoutes = createRoutes;
const express_1 = require("express");
const ScanController_1 = require("../controllers/ScanController");
const PortfolioController_1 = require("../controllers/PortfolioController");
const HealthController_1 = require("../controllers/HealthController");
function createRoutes(services, _repositories, pool) {
    const router = (0, express_1.Router)();
    // Initialize controllers
    const scanController = new ScanController_1.ScanController(services.scanService, services.priceTrackingService);
    const portfolioController = new PortfolioController_1.PortfolioController();
    const healthController = new HealthController_1.HealthController(pool);
    // Health check routes
    router.get('/health', healthController.getHealth);
    // Scan routes
    router.get('/status', scanController.getStatus);
    router.get('/scan-progress', scanController.getProgress);
    router.post('/start-scan', scanController.startScan);
    router.get('/scan-results', scanController.getResults);
    router.get('/stocks', scanController.getStocks);
    router.get('/selected', scanController.getSelectedStocks);
    router.get('/rejected', scanController.getRejectedStocks);
    router.get('/scan-history', scanController.getScanHistory);
    router.get('/statistics', scanController.getStatistics);
    router.post('/analyze-stock', scanController.analyzeStock);
    router.get('/quote/:symbol', scanController.getQuote);
    router.get('/logs', scanController.getLogs);
    // Price tracking routes
    router.post('/selected/track-prices', scanController.trackSelectedStocksPrices);
    router.get('/selected/:symbol/prices', scanController.getStockPriceHistory);
    router.get('/selected/summary', scanController.getSelectedStocksSummary);
    // Portfolio routes
    router.get('/portfolio', portfolioController.getPortfolio);
    router.get('/performance', portfolioController.getPerformance);
    return router;
}
//# sourceMappingURL=index.js.map