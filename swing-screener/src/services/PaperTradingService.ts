// src/services/PaperTradingService.ts — Manages virtual portfolios and trades

import { BaseService } from './BaseService';
import { MarketDataService } from './MarketDataService';

export interface PaperTrade {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  entryPrice: number;
  entryDate: string;
  status: 'OPEN' | 'CLOSED';
  exitPrice?: number;
  exitDate?: string;
  pnl?: number;
  pnlPercent?: number;
}

export interface VirtualPortfolio {
  userId: string;
  totalCash: number;
  availableCash: number;
  investedAmount: number;
  currentValue: number;
  totalPnl: number;
  totalPnlPercent: number;
  positions: PaperTrade[];
}

export class PaperTradingService extends BaseService {
  private marketData: MarketDataService;
  
  // In-memory store for prototype
  private portfolios: Map<string, VirtualPortfolio> = new Map();
  private readonly INITIAL_CASH = 1000000; // 10 Lakh INR

  constructor(marketData: MarketDataService) {
    super('PaperTradingService');
    this.marketData = marketData;
  }

  /**
   * Initialize a new virtual portfolio
   */
  createPortfolio(userId: string): VirtualPortfolio {
    if (this.portfolios.has(userId)) {
      return this.portfolios.get(userId)!;
    }

    const newPortfolio: VirtualPortfolio = {
      userId,
      totalCash: this.INITIAL_CASH,
      availableCash: this.INITIAL_CASH,
      investedAmount: 0,
      currentValue: this.INITIAL_CASH,
      totalPnl: 0,
      totalPnlPercent: 0,
      positions: []
    };

    this.portfolios.set(userId, newPortfolio);
    return newPortfolio;
  }

  /**
   * Get portfolio with live mark-to-market valuations
   */
  async getPortfolio(userId: string): Promise<VirtualPortfolio> {
    let portfolio = this.portfolios.get(userId);
    if (!portfolio) {
      portfolio = this.createPortfolio(userId);
    }

    // 1. Calculate live MTM for open positions
    let currentInvestedValue = 0;
    
    for (const pos of portfolio.positions) {
      if (pos.status === 'OPEN') {
        try {
          const quote = await this.marketData.fetchCurrentQuote(pos.symbol);
          if (quote && quote.price) {
            const currentPrice = quote.price;
            pos.pnl = (currentPrice - pos.entryPrice) * pos.quantity;
            pos.pnlPercent = ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
            currentInvestedValue += currentPrice * pos.quantity;
          } else {
            // Fallback if quote fails
            const lastKnownValue = pos.entryPrice * pos.quantity;
            currentInvestedValue += lastKnownValue;
          }
        } catch (e) {
          const lastKnownValue = pos.entryPrice * pos.quantity;
          currentInvestedValue += lastKnownValue;
        }
      }
    }

    // 2. Update totals
    portfolio.currentValue = portfolio.availableCash + currentInvestedValue;
    portfolio.totalPnl = portfolio.currentValue - portfolio.totalCash;
    portfolio.totalPnlPercent = (portfolio.totalPnl / portfolio.totalCash) * 100;

    return portfolio;
  }

  /**
   * Execute a virtual trade
   */
  async executeTrade(userId: string, symbol: string, quantity: number, type: 'BUY' | 'SELL'): Promise<PaperTrade> {
    const symbolUpper = symbol.toUpperCase();
    let portfolio = this.portfolios.get(userId);
    if (!portfolio) {
      portfolio = this.createPortfolio(userId);
    }

    // 1. Fetch live execution price
    const quote = await this.marketData.fetchCurrentQuote(symbolUpper);
    if (!quote || quote.price <= 0) {
      throw new Error(`Execution failed: Could not fetch real-time price for ${symbolUpper}`);
    }
    const executionPrice = quote.price;

    // 2. Process BUY
    if (type === 'BUY') {
      const requiredCash = executionPrice * quantity;
      
      if (portfolio.availableCash < requiredCash) {
        throw new Error(`Insufficient funds. Required: ₹${requiredCash}, Available: ₹${portfolio.availableCash}`);
      }

      const trade: PaperTrade = {
        id: `trd_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        symbol: symbolUpper,
        type: 'BUY',
        quantity,
        entryPrice: executionPrice,
        entryDate: new Date().toISOString(),
        status: 'OPEN',
        pnl: 0,
        pnlPercent: 0
      };

      portfolio.availableCash -= requiredCash;
      portfolio.investedAmount += requiredCash;
      portfolio.positions.push(trade);
      
      this.logger.info(`Paper Trade: User ${userId} BOUGHT ${quantity} ${symbolUpper} @ ₹${executionPrice}`);
      return trade;
    } 
    
    // 3. Process SELL (Close Position)
    else {
      // Find open position
      const openPositionIndex = portfolio.positions.findIndex(p => p.symbol === symbolUpper && p.status === 'OPEN');
      if (openPositionIndex === -1) {
        throw new Error(`No open position found for ${symbolUpper}`);
      }

      const position = portfolio.positions[openPositionIndex];
      
      if (quantity !== position.quantity) {
        // Prototype simplification: only allow closing full positions
        throw new Error(`Must sell exact open quantity: ${position.quantity}`);
      }

      const realizedValue = executionPrice * quantity;
      
      position.status = 'CLOSED';
      position.exitPrice = executionPrice;
      position.exitDate = new Date().toISOString();
      position.pnl = (executionPrice - position.entryPrice) * quantity;
      position.pnlPercent = ((executionPrice - position.entryPrice) / position.entryPrice) * 100;

      portfolio.availableCash += realizedValue;
      portfolio.investedAmount -= (position.entryPrice * quantity);
      
      this.logger.info(`Paper Trade: User ${userId} SOLD ${quantity} ${symbolUpper} @ ₹${executionPrice}. PnL: ₹${position.pnl}`);
      return position;
    }
  }
}
