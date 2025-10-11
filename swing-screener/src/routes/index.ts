// src/routes/index.ts - Main routes configuration

import { Router } from 'express';
import { ScanController } from '../controllers/ScanController';
import { PortfolioController } from '../controllers/PortfolioController';
import { HealthController } from '../controllers/HealthController';

export function createRoutes(services: any, _repositories: any, pool: any): Router {
  const router = Router();

  // Initialize controllers
  const scanController = new ScanController(services.scanService);
  const portfolioController = new PortfolioController();
  const healthController = new HealthController(pool);

  // Health check routes
  router.get('/health', healthController.getHealth);

  // Scan routes
  router.get('/status', scanController.getStatus);
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

  // Portfolio routes
  router.get('/portfolio', portfolioController.getPortfolio);
  router.get('/performance', portfolioController.getPerformance);

  return router;
}