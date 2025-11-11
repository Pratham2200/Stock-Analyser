// src/controllers/ScanController.ts - Scan management controller

import { Request, Response } from 'express';
import { BaseController } from './BaseController';
import { ScanService } from '../services/ScanService';

export class ScanController extends BaseController {
  private scanService: ScanService;

  constructor(scanService: ScanService) {
    super('ScanController');
    this.scanService = scanService;
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
      // Coming soon - return placeholder data
      this.success(res, {
        message: "Statistics feature coming soon!",
        status: "development",
        features: ["Advanced analytics", "Performance metrics", "Risk analysis"],
        estimatedRelease: "Q1 2025"
      });
    } catch (error) {
      this.error(res, (error as Error).message, 500);
    }
  });

  analyzeStock = this.handleAsync(async (req: Request, res: Response) => {
    this.logRequest(req, 'POST', '/api/analyze-stock');
    
    try {
      // Coming soon - return placeholder data
      this.success(res, {
        message: "Individual stock analysis coming soon!",
        status: "development",
        features: ["Real-time analysis", "Technical indicators", "Risk assessment"],
        estimatedRelease: "Q1 2025"
      });
    } catch (error) {
      this.error(res, (error as Error).message, 400);
    }
  });

  getQuote = this.handleAsync(async (req: Request, res: Response) => {
    this.logRequest(req, 'GET', `/api/quote/${req.params.symbol}`);
    
    try {
      // Coming soon - return placeholder data
      this.success(res, {
        message: "Real-time quotes coming soon!",
        status: "development",
        features: ["Live price updates", "Market data", "Price alerts"],
        estimatedRelease: "Q1 2025"
      });
    } catch (error) {
      this.error(res, (error as Error).message, 500);
    }
  });

  getLogs = this.handleAsync(async (req: Request, res: Response) => {
    this.logRequest(req, 'GET', '/api/logs');
    
    try {
      // Coming soon - return placeholder data
      this.success(res, {
        message: "Advanced logging coming soon!",
        status: "development",
        features: ["Real-time logs", "Error tracking", "Performance monitoring"],
        estimatedRelease: "Q1 2025"
      });
    } catch (error) {
      this.error(res, (error as Error).message, 500);
    }
  });
}
