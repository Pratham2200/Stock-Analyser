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
      // Get real portfolio data from selected stocks summary with error handling
      let portfolioSummary;
      try {
        portfolioSummary = await this.scanService.getSelectedStocksSummary();
      } catch (error) {
        this.logger.warn('Failed to get portfolio summary:', error);
        portfolioSummary = {
          totalStocks: 0,
          totalValue: 0,
          totalPnL: 0,
          stocksInProfit: 0,
          stocksInLoss: 0,
          stocksAtStopLoss: 0,
          targetsHit: { target1: 0, target2: 0, target3: 0 },
          stocks: []
        };
      }

      // Get detailed stock information
      const { stocks: selectedStocks } = await this.scanService.getSelectedStocks(1, 1000);

      const portfolio = {
        summary: {
          totalValue: portfolioSummary.totalValue,
          totalPnL: portfolioSummary.totalPnL,
          totalPnLPercent: portfolioSummary.totalValue > 0 ? (portfolioSummary.totalPnL / portfolioSummary.totalValue) * 100 : 0,
          activePositions: portfolioSummary.totalStocks,
          stocksInProfit: portfolioSummary.stocksInProfit,
          stocksInLoss: portfolioSummary.stocksInLoss,
          stocksAtStopLoss: portfolioSummary.stocksAtStopLoss
        },
        positions: selectedStocks.map((stock: any) => ({
          symbol: stock.symbol,
          name: stock.name,
          entryPrice: stock.entry_price,
          currentPrice: stock.current_price,
          quantity: stock.position_size,
          positionValue: stock.position_value,
          pnl: stock.current_price && stock.entry_price
            ? ((stock.current_price - stock.entry_price) / stock.entry_price) * 100
            : 0,
          stopLoss: stock.stop_loss,
          target1: stock.target_1,
          target2: stock.target_2,
          target3: stock.target_3,
          selectionDate: stock.scan_date
        })),
        targetsHit: portfolioSummary.targetsHit,
        lastUpdated: new Date().toISOString()
      };

      this.success(res, portfolio);
    } catch (error) {
      this.logger.error('Error fetching portfolio:', error);
      this.error(res, (error as Error).message, 500);
    }
  });

  getPerformance = this.handleAsync(async (req: Request, res: Response) => {
    this.logRequest(req, 'GET', '/api/performance');

    try {
      // Get real portfolio summary for performance metrics with error handling
      let portfolioSummary;
      try {
        portfolioSummary = await this.scanService.getSelectedStocksSummary();
      } catch (error) {
        this.logger.warn('Failed to get portfolio summary for performance:', error);
        portfolioSummary = {
          totalPnL: 0,
          totalValue: 0,
          totalStocks: 0
        };
      }

      // For now, return current portfolio P&L as today's performance
      // In a full implementation, this would track historical performance
      const currentPnL = portfolioSummary.totalPnL || 0;
      const currentPnLPercent = portfolioSummary.totalValue > 0 ? (portfolioSummary.totalPnL / portfolioSummary.totalValue) * 100 : 0;

      this.success(res, {
        todayPnl: currentPnL,
        todayPnlPercent: currentPnLPercent,
        weekPnl: currentPnL, // Simplified - would need historical tracking
        weekPnlPercent: currentPnLPercent, // Simplified - would need historical tracking
        monthPnl: currentPnL, // Simplified - would need historical tracking
        monthPnlPercent: currentPnLPercent, // Simplified - would need historical tracking
        totalPortfolioValue: portfolioSummary.totalValue,
        activePositions: portfolioSummary.totalStocks,
        lastUpdated: new Date().toISOString(),
        message: "Real-time portfolio performance metrics"
      });
    } catch (error) {
      this.logger.error('Error fetching performance:', error);
      this.error(res, (error as Error).message, 500);
    }
  });
}