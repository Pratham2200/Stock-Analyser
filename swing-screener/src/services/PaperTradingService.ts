// src/services/PaperTradingService.ts — Manages virtual portfolios and trades
// PHASE D: Fully persistent via PostgreSQL with ACID transactions

import { Pool, PoolClient } from 'pg';
import { BaseService } from './BaseService';
import { MarketDataService } from './MarketDataService';

export interface PaperTrade {
  id: number;
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
  id: number;
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
  private pool: Pool;
  private readonly INITIAL_CASH = 1000000;

  constructor(marketData: MarketDataService, pool: Pool) {
    super('PaperTradingService');
    this.marketData = marketData;
    this.pool = pool;
  }

  /**
   * Get or create a portfolio — idempotent via UNIQUE constraint
   */
  async createPortfolio(userId: string): Promise<VirtualPortfolio> {
    const res = await this.pool.query(
      `INSERT INTO paper_portfolios (user_id, initial_cash, cash, total_value)
       VALUES ($1, $2, $2, $2)
       ON CONFLICT (user_id) DO NOTHING
       RETURNING *`,
      [userId, this.INITIAL_CASH]
    );

    // If ON CONFLICT hit, fetch existing
    if (res.rows.length === 0) {
      return this.getPortfolio(userId);
    }

    const row = res.rows[0];
    return this.rowToPortfolio(row, []);
  }

  /**
   * Get portfolio with live mark-to-market valuations
   */
  async getPortfolio(userId: string): Promise<VirtualPortfolio> {
    // 1. Get or create portfolio
    let portfolioRes = await this.pool.query(
      'SELECT * FROM paper_portfolios WHERE user_id = $1', [userId]
    );

    if (portfolioRes.rows.length === 0) {
      return this.createPortfolio(userId);
    }

    const portfolio = portfolioRes.rows[0];

    // 2. Get open positions
    const posRes = await this.pool.query(
      `SELECT * FROM paper_positions WHERE portfolio_id = $1 AND status = 'OPEN'`,
      [portfolio.id]
    );

    // 3. Live MTM for each open position
    let currentInvestedValue = 0;
    const positions: PaperTrade[] = [];

    for (const pos of posRes.rows) {
      let currentPrice = pos.current_price ? parseFloat(pos.current_price) : parseFloat(pos.average_price);
      try {
        const quote = await this.marketData.fetchCurrentQuote(pos.symbol);
        if (quote && quote.price && quote.price > 0) currentPrice = quote.price;
      } catch { /* fallback to last known */ }

      const pnl = (currentPrice - pos.average_price) * pos.quantity;
      const pnlPercent = ((currentPrice - pos.average_price) / pos.average_price) * 100;
      currentInvestedValue += currentPrice * pos.quantity;

      // Update current price in DB (non-blocking)
      this.pool.query(
        'UPDATE paper_positions SET current_price = $1, unrealized_pnl = $2, updated_at = NOW() WHERE id = $3',
        [currentPrice, pnl, pos.id]
      ).catch(() => {});

      positions.push({
        id: pos.id,
        symbol: pos.symbol,
        type: 'BUY',
        quantity: pos.quantity,
        entryPrice: parseFloat(pos.average_price),
        entryDate: pos.opened_at?.toISOString() || new Date().toISOString(),
        status: 'OPEN',
        pnl: Math.round(pnl * 100) / 100,
        pnlPercent: Math.round(pnlPercent * 100) / 100,
      });
    }

    // 4. Also fetch closed positions for history display
    const closedRes = await this.pool.query(
      `SELECT * FROM paper_positions WHERE portfolio_id = $1 AND status = 'CLOSED' ORDER BY closed_at DESC LIMIT 50`,
      [portfolio.id]
    );

    for (const pos of closedRes.rows) {
      positions.push({
        id: pos.id,
        symbol: pos.symbol,
        type: 'SELL',
        quantity: pos.quantity,
        entryPrice: parseFloat(pos.average_price),
        entryDate: pos.opened_at?.toISOString() || '',
        status: 'CLOSED',
        exitPrice: parseFloat(pos.current_price || pos.average_price),
        exitDate: pos.closed_at?.toISOString(),
        pnl: parseFloat(pos.unrealized_pnl || 0),
        pnlPercent: pos.average_price > 0
          ? ((parseFloat(pos.current_price || pos.average_price) - parseFloat(pos.average_price)) / parseFloat(pos.average_price)) * 100
          : 0,
      });
    }

    // 5. Update portfolio totals
    const totalValue = parseFloat(portfolio.cash) + currentInvestedValue;
    const totalPnl = totalValue - parseFloat(portfolio.initial_cash);
    const totalPnlPct = (totalPnl / parseFloat(portfolio.initial_cash)) * 100;

    this.pool.query(
      'UPDATE paper_portfolios SET total_value = $1, total_pnl = $2, total_pnl_pct = $3, updated_at = NOW() WHERE id = $4',
      [totalValue, totalPnl, totalPnlPct, portfolio.id]
    ).catch(() => {});

    return {
      id: portfolio.id,
      userId: portfolio.user_id,
      totalCash: parseFloat(portfolio.initial_cash),
      availableCash: parseFloat(portfolio.cash),
      investedAmount: parseFloat(portfolio.invested),
      currentValue: Math.round(totalValue * 100) / 100,
      totalPnl: Math.round(totalPnl * 100) / 100,
      totalPnlPercent: Math.round(totalPnlPct * 100) / 100,
      positions,
    };
  }

  /**
   * Execute a virtual trade — ACID transaction
   */
  async executeTrade(userId: string, symbol: string, quantity: number, type: 'BUY' | 'SELL'): Promise<PaperTrade> {
    const symbolUpper = symbol.toUpperCase();
    const client: PoolClient = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Get or create portfolio (within transaction)
      let portRes = await client.query(
        'SELECT * FROM paper_portfolios WHERE user_id = $1 FOR UPDATE', [userId]
      );
      if (portRes.rows.length === 0) {
        portRes = await client.query(
          `INSERT INTO paper_portfolios (user_id, initial_cash, cash, total_value)
           VALUES ($1, $2, $2, $2) RETURNING *`,
          [userId, this.INITIAL_CASH]
        );
      }
      const portfolio = portRes.rows[0];

      // 2. Fetch live execution price
      const quote = await this.marketData.fetchCurrentQuote(symbolUpper);
      if (!quote || quote.price <= 0) {
        throw new Error(`Execution failed: Could not fetch real-time price for ${symbolUpper}`);
      }
      const executionPrice = quote.price;

      if (type === 'BUY') {
        return await this.processBuy(client, portfolio, symbolUpper, quantity, executionPrice);
      } else {
        return await this.processSell(client, portfolio, symbolUpper, quantity, executionPrice);
      }
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Process BUY — ACID within existing transaction
   */
  private async processBuy(
    client: PoolClient, portfolio: any, symbol: string, quantity: number, price: number
  ): Promise<PaperTrade> {
    const requiredCash = price * quantity;
    const availableCash = parseFloat(portfolio.cash);

    if (availableCash < requiredCash) {
      throw new Error(`Insufficient funds. Required: ₹${requiredCash.toFixed(2)}, Available: ₹${availableCash.toFixed(2)}`);
    }

    // Check for existing open position (average up/down)
    const existingRes = await client.query(
      `SELECT * FROM paper_positions WHERE portfolio_id = $1 AND symbol = $2 AND status = 'OPEN' FOR UPDATE`,
      [portfolio.id, symbol]
    );

    let positionId: number;

    if (existingRes.rows.length > 0) {
      const existing = existingRes.rows[0];
      const oldQty = existing.quantity;
      const oldAvg = parseFloat(existing.average_price);
      const newQty = oldQty + quantity;
      const newAvg = ((oldAvg * oldQty) + (price * quantity)) / newQty;

      await client.query(
        `UPDATE paper_positions SET quantity = $1, average_price = $2, current_price = $3, updated_at = NOW()
         WHERE id = $4`,
        [newQty, newAvg, price, existing.id]
      );
      positionId = existing.id;
      this.logger.info(`Paper Trade: ${portfolio.user_id} AVERAGED ${symbol}. Qty: ${newQty}, Avg: ₹${newAvg.toFixed(2)}`);
    } else {
      const posRes = await client.query(
        `INSERT INTO paper_positions (portfolio_id, symbol, quantity, average_price, current_price, status)
         VALUES ($1, $2, $3, $4, $5, 'OPEN') RETURNING id`,
        [portfolio.id, symbol, quantity, price, price]
      );
      positionId = posRes.rows[0].id;
    }

    // Record trade in immutable history
    await client.query(
      `INSERT INTO paper_trade_history (portfolio_id, position_id, symbol, trade_type, quantity, price, total_value)
       VALUES ($1, $2, $3, 'BUY', $4, $5, $6)`,
      [portfolio.id, positionId, symbol, quantity, price, requiredCash]
    );

    // Update portfolio cash
    await client.query(
      `UPDATE paper_portfolios SET cash = cash - $1, invested = invested + $1, updated_at = NOW()
       WHERE id = $2`,
      [requiredCash, portfolio.id]
    );

    await client.query('COMMIT');
    this.logger.info(`Paper Trade: ${portfolio.user_id} BOUGHT ${quantity} ${symbol} @ ₹${price}`);

    return {
      id: positionId,
      symbol,
      type: 'BUY',
      quantity,
      entryPrice: price,
      entryDate: new Date().toISOString(),
      status: 'OPEN',
      pnl: 0,
      pnlPercent: 0,
    };
  }

  /**
   * Process SELL — ACID within existing transaction
   */
  private async processSell(
    client: PoolClient, portfolio: any, symbol: string, quantity: number, price: number
  ): Promise<PaperTrade> {
    // Lock the open position
    const posRes = await client.query(
      `SELECT * FROM paper_positions WHERE portfolio_id = $1 AND symbol = $2 AND status = 'OPEN' FOR UPDATE`,
      [portfolio.id, symbol]
    );

    if (posRes.rows.length === 0) {
      throw new Error(`No open position found for ${symbol}`);
    }

    const position = posRes.rows[0];
    const posQty = position.quantity;
    const avgPrice = parseFloat(position.average_price);

    if (quantity > posQty) {
      throw new Error(`Cannot sell ${quantity} shares. You only hold ${posQty} of ${symbol}`);
    }

    const realizedPnl = (price - avgPrice) * quantity;
    const saleValue = price * quantity;

    if (quantity === posQty) {
      // Full close
      await client.query(
        `UPDATE paper_positions SET status = 'CLOSED', current_price = $1, unrealized_pnl = $2, closed_at = NOW(), updated_at = NOW()
         WHERE id = $3`,
        [price, realizedPnl, position.id]
      );
    } else {
      // Partial close — reduce quantity
      await client.query(
        `UPDATE paper_positions SET quantity = quantity - $1, current_price = $2, updated_at = NOW()
         WHERE id = $3`,
        [quantity, price, position.id]
      );
    }

    // Record in immutable history
    await client.query(
      `INSERT INTO paper_trade_history (portfolio_id, position_id, symbol, trade_type, quantity, price, total_value, realized_pnl)
       VALUES ($1, $2, $3, 'SELL', $4, $5, $6, $7)`,
      [portfolio.id, position.id, symbol, quantity, price, saleValue, realizedPnl]
    );

    // Auto-create journal entry for closed trade
    await client.query(
      `INSERT INTO trade_journal_entries (user_id, symbol, trade_type, entry_price, exit_price, quantity, pnl, pnl_percent, result, entry_date, exit_date)
       VALUES ($1, $2, 'SELL', $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        portfolio.user_id, symbol, avgPrice, price, quantity, realizedPnl,
        ((price - avgPrice) / avgPrice) * 100,
        realizedPnl > 0 ? 'WIN' : realizedPnl < 0 ? 'LOSS' : 'BREAKEVEN',
        position.opened_at,
      ]
    );

    // Update portfolio cash
    await client.query(
      `UPDATE paper_portfolios SET cash = cash + $1, invested = invested - $2, updated_at = NOW()
       WHERE id = $3`,
      [saleValue, avgPrice * quantity, portfolio.id]
    );

    await client.query('COMMIT');
    this.logger.info(`Paper Trade: ${portfolio.user_id} SOLD ${quantity} ${symbol} @ ₹${price}. PnL: ₹${realizedPnl.toFixed(2)}`);

    return {
      id: position.id,
      symbol,
      type: 'SELL',
      quantity,
      entryPrice: avgPrice,
      entryDate: position.opened_at?.toISOString() || '',
      status: quantity === posQty ? 'CLOSED' : 'OPEN',
      exitPrice: price,
      exitDate: new Date().toISOString(),
      pnl: Math.round(realizedPnl * 100) / 100,
      pnlPercent: Math.round(((price - avgPrice) / avgPrice) * 10000) / 100,
    };
  }

  /**
   * Get all portfolios (for leaderboard)
   */
  async getAllPortfolios(): Promise<any[]> {
    const res = await this.pool.query(
      `SELECT pp.*,
              COUNT(pth.id) FILTER (WHERE pth.trade_type = 'SELL') as total_closed_trades,
              COUNT(pth.id) FILTER (WHERE pth.trade_type = 'SELL' AND pth.realized_pnl > 0) as winning_trades
       FROM paper_portfolios pp
       LEFT JOIN paper_trade_history pth ON pp.id = pth.portfolio_id
       GROUP BY pp.id
       ORDER BY pp.total_pnl_pct DESC`
    );
    return res.rows;
  }

  private rowToPortfolio(row: any, positions: PaperTrade[]): VirtualPortfolio {
    return {
      id: row.id,
      userId: row.user_id,
      totalCash: parseFloat(row.initial_cash),
      availableCash: parseFloat(row.cash),
      investedAmount: parseFloat(row.invested),
      currentValue: parseFloat(row.total_value),
      totalPnl: parseFloat(row.total_pnl),
      totalPnlPercent: parseFloat(row.total_pnl_pct),
      positions,
    };
  }
}
