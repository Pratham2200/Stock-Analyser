// src/services/WatchlistService.ts — AI-monitored watchlist with daily signal summaries
// PHASE D: Fully persistent via PostgreSQL

import { Pool } from 'pg';
import { BaseService } from './BaseService';
import { MarketDataService } from './MarketDataService';
import { AIAnalysisService } from './AIAnalysisService';
import { RSI } from 'technicalindicators';

export interface WatchlistStock {
  id?: number;
  symbol: string;
  addedAt: string;
  lastChecked?: string;
  currentPrice?: number;
  changePercent?: number;
  rsi?: number;
  targetPrice?: number;
  stopLoss?: number;
  notes?: string;
  signalStatus: 'BULLISH_TRIGGER' | 'BEARISH_TRIGGER' | 'NO_SIGNAL' | 'PENDING';
}

export interface WatchlistSummary {
  userId: string;
  totalStocks: number;
  triggeredCount: number;
  stocks: WatchlistStock[];
  aiBrief: string;
}

export class WatchlistService extends BaseService {
  private marketData: MarketDataService;
  private aiService: AIAnalysisService | null;
  private pool: Pool;

  constructor(marketData: MarketDataService, aiService: AIAnalysisService | null, pool: Pool) {
    super('WatchlistService');
    this.marketData = marketData;
    this.aiService = aiService;
    this.pool = pool;
  }

  async addStock(userId: string, symbol: string, targetPrice?: number, stopLoss?: number, notes?: string): Promise<WatchlistStock> {
    const symbolUpper = symbol.toUpperCase();

    const res = await this.pool.query(
      `INSERT INTO ai_watchlists (user_id, symbol, target_price, stop_loss, notes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, symbol) DO UPDATE SET
         target_price = COALESCE($3, ai_watchlists.target_price),
         stop_loss = COALESCE($4, ai_watchlists.stop_loss),
         notes = COALESCE($5, ai_watchlists.notes)
       RETURNING *`,
      [userId, symbolUpper, targetPrice || null, stopLoss || null, notes || null]
    );

    const row = res.rows[0];
    return this.rowToWatchlistStock(row);
  }

  async removeStock(userId: string, symbol: string): Promise<boolean> {
    const symbolUpper = symbol.toUpperCase();
    const res = await this.pool.query(
      'DELETE FROM ai_watchlists WHERE user_id = $1 AND symbol = $2',
      [userId, symbolUpper]
    );
    return (res.rowCount || 0) > 0;
  }

  /**
   * Scan all watchlist stocks and generate AI summary
   */
  async getDailySummary(userId: string): Promise<WatchlistSummary> {
    const listRes = await this.pool.query(
      'SELECT * FROM ai_watchlists WHERE user_id = $1 ORDER BY added_at DESC',
      [userId]
    );

    if (listRes.rows.length === 0) {
      return {
        userId,
        totalStocks: 0,
        triggeredCount: 0,
        stocks: [],
        aiBrief: 'Your watchlist is empty. Add stocks to get AI-powered daily briefs.',
      };
    }

    const triggered: string[] = [];
    const stocks: WatchlistStock[] = [];

    for (const row of listRes.rows) {
      const stock = this.rowToWatchlistStock(row);

      try {
        const [quote, chartResult] = await Promise.all([
          this.marketData.fetchCurrentQuote(stock.symbol),
          this.marketData.fetchDailyBars(stock.symbol, 30),
        ]);

        stock.currentPrice = quote?.price || 0;
        stock.changePercent = quote?.changePercent || 0;
        stock.lastChecked = new Date().toISOString();

        const closes = chartResult.bars.map((b: any) => b.close);
        const rsiValues = RSI.calculate({ period: 14, values: closes });
        stock.rsi = rsiValues.length > 0 ? Math.round(rsiValues[rsiValues.length - 1] * 100) / 100 : 50;

        // Signal detection
        if (stock.rsi < 30 || (stock.changePercent && stock.changePercent > 3)) {
          stock.signalStatus = 'BULLISH_TRIGGER';
          triggered.push(`${stock.symbol} (RSI: ${stock.rsi}, Change: ${stock.changePercent?.toFixed(2)}%)`);
        } else if (stock.rsi > 70 || (stock.changePercent && stock.changePercent < -3)) {
          stock.signalStatus = 'BEARISH_TRIGGER';
          triggered.push(`${stock.symbol} (RSI: ${stock.rsi}, Change: ${stock.changePercent?.toFixed(2)}%)`);
        } else {
          stock.signalStatus = 'NO_SIGNAL';
        }

        // Persist updated signal data
        this.pool.query(
          `UPDATE ai_watchlists SET current_price = $1, change_percent = $2, rsi = $3, signal_status = $4, last_checked = NOW()
           WHERE id = $5`,
          [stock.currentPrice, stock.changePercent, stock.rsi, stock.signalStatus, row.id]
        ).catch(() => {});

      } catch {
        stock.signalStatus = 'PENDING';
      }

      stocks.push(stock);
    }

    // Generate AI brief
    let aiBrief = `${triggered.length} of ${stocks.length} watchlist stocks triggered signals today.`;

    if (this.aiService && triggered.length > 0) {
      try {
        const prompt = `You are a concise market analyst. Generate a 2-3 sentence morning brief about these watchlist triggers: ${triggered.join(', ')}. Focus on actionable insights. No markdown formatting.`;
        aiBrief = await this.aiService.generateContent(prompt);
      } catch { /* Keep default */ }
    }

    return {
      userId,
      totalStocks: stocks.length,
      triggeredCount: triggered.length,
      stocks,
      aiBrief,
    };
  }

  private rowToWatchlistStock(row: any): WatchlistStock {
    return {
      id: row.id,
      symbol: row.symbol,
      addedAt: row.added_at?.toISOString() || new Date().toISOString(),
      lastChecked: row.last_checked?.toISOString(),
      currentPrice: row.current_price ? parseFloat(row.current_price) : undefined,
      changePercent: row.change_percent ? parseFloat(row.change_percent) : undefined,
      rsi: row.rsi ? parseFloat(row.rsi) : undefined,
      targetPrice: row.target_price ? parseFloat(row.target_price) : undefined,
      stopLoss: row.stop_loss ? parseFloat(row.stop_loss) : undefined,
      notes: row.notes,
      signalStatus: row.signal_status || 'PENDING',
    };
  }
}
