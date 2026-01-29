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
      const { stocks, total } = await this.scanService.getSelectedStocks(page, limit);

      const response = this.createPaginatedResponse(stocks, total, page, limit);
      res.json(response);
    } catch (error) {
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
      const statistics = await this.scanService.getAnalysisStatistics();
      this.success(res, statistics);
    } catch (error) {
      this.error(res, (error as Error).message, 500);
    }
  });

  getAlerts = this.handleAsync(async (req: Request, res: Response) => {
    this.logRequest(req, 'GET', '/api/alerts');

    try {
      const alerts = await this.scanService.getMarketAlerts();
      this.success(res, alerts);
    } catch (error) {
      this.error(res, (error as Error).message, 500);
    }
  });

  analyzeStock = this.handleAsync(async (req: Request, res: Response) => {
    this.logRequest(req, 'POST', '/api/analyze-stock');

    try {
      const { symbol, lookbackDays } = req.body;

      if (!symbol) {
        return this.error(res, 'Symbol is required', 400);
      }

      const result = await this.scanService.analyzeSingleStock(symbol, lookbackDays || 120);
      this.success(res, result);
    } catch (error) {
      this.error(res, (error as Error).message, 500);
    }
  });

  getQuote = this.handleAsync(async (req: Request, res: Response) => {
    this.logRequest(req, 'GET', `/api/quote/${req.params.symbol}`);

    try {
      const { symbol } = req.params;

      if (!symbol) {
        return this.error(res, 'Symbol is required', 400);
      }

      const quote = await this.scanService.getStockQuote(symbol);
      this.success(res, quote);
    } catch (error) {
      this.error(res, (error as Error).message, 500);
    }
  });

  getLogs = this.handleAsync(async (req: Request, res: Response) => {
    this.logRequest(req, 'GET', '/api/logs');

    try {
      const lines = parseInt(req.query.lines as string) || 100;
      const logs = await this.scanService.getRecentLogs(lines);
      this.success(res, logs);
    } catch (error) {
      this.error(res, (error as Error).message, 500);
    }
  });

  /**
   * Run selected scan - evaluate performance of selected stocks from a date
   */
  runSelectedScan = this.handleAsync(async (req: Request, res: Response) => {
    this.logRequest(req, 'POST', '/api/run-selected-scan');

    try {
      const { fromDate } = req.body;

      if (!fromDate) {
        return this.error(res, 'fromDate is required', 400);
      }

      const results = await this.scanService.runSelectedScan(new Date(fromDate));
      this.success(res, results, 'Selected scan completed');
    } catch (error) {
      this.error(res, (error as Error).message, 500);
    }
  });
}
