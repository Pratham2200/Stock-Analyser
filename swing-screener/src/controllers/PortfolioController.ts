// src/controllers/PortfolioController.ts - Portfolio management controller

import { Request, Response } from 'express';
import { BaseController } from './BaseController';
import { ScanService } from '../services/ScanService';

export class PortfolioController extends BaseController {
  private scanService: ScanService;

  constructor(scanService: ScanService) {
    super('PortfolioController');
    this.scanService = scanService;
  }

  getPortfolio = this.handleAsync(async (req: Request, res: Response) => {
    this.logRequest(req, 'GET', '/api/portfolio');

    try {
      // Fetch actual selected stocks from database
      const selectedStocks = await this.scanService.getAllSelectedStocks();

      // Calculate portfolio metrics
      let totalValue = 0;
      let totalInvested = 0;

      const positions = selectedStocks.map((stock: any) => {
        const qty = stock.position_size || 1; // Fallback to 1 to avoid 0/NaN issues
        const currentValue = (stock.current_price || stock.entry_price) * qty;
        const investedValue = stock.entry_price * qty;
        totalValue += currentValue;
        totalInvested += investedValue;

        return {
          symbol: stock.symbol,
          name: stock.name,
          shares: qty,
          entryPrice: stock.entry_price,
          currentPrice: stock.current_price || stock.entry_price,
          value: currentValue,
          pnl: currentValue - investedValue,
          pnlPercent: investedValue > 0 ? ((currentValue - investedValue) / investedValue) * 100 : 0
        };
      });

      this.success(res, {
        totalPositions: positions.length,
        totalValue,
        totalInvested,
        totalPnl: totalValue - totalInvested,
        totalPnlPercent: totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0,
        positions
      });
    } catch (error) {
      this.error(res, (error as Error).message, 500);
    }
  });

  getPerformance = this.handleAsync(async (req: Request, res: Response) => {
    this.logRequest(req, 'GET', '/api/performance');

    try {
      // Fetch statistics from database
      const statistics = await this.scanService.getAnalysisStatistics();
      const selectedStocks = await this.scanService.getAllSelectedStocks();

      // Calculate performance metrics
      let todayPnl = 0;
      let todayPnlPercent = 0;
      let weekPnl = 0;

      // Calculate basic performance from selected stocks
      selectedStocks.forEach((stock: any) => {
        const qty = stock.position_size || 1;
        const entryValue = stock.entry_price * qty;
        const currentValue = (stock.current_price || stock.entry_price) * qty;
        todayPnl += currentValue - entryValue;
      });

      const totalInvested = selectedStocks.reduce((sum: number, s: any) =>
        sum + (s.entry_price * (s.position_size || 1)), 0);

      if (totalInvested > 0) {
        todayPnlPercent = (todayPnl / totalInvested) * 100;
      }

      this.success(res, {
        todayPnl,
        todayPnlPercent,
        weekPnl: todayPnl, // Using same value as we don't track historical
        weekPnlPercent: todayPnlPercent,
        totalStocks: statistics?.total_stocks || 0,
        qualifiedStocks: statistics?.qualified_stocks || selectedStocks.length,
        successRate: statistics?.success_rate || 0
      });
    } catch (error) {
      this.error(res, (error as Error).message, 500);
    }
  });
}