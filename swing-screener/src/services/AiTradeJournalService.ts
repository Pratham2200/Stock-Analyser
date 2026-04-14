// src/services/AiTradeJournalService.ts - Analyzes past trades to find patterns
// PHASE D: Reads real data from trade_journal_entries table

import { BaseService } from './BaseService';
import { AIAnalysisService } from './AIAnalysisService';
import { Pool } from 'pg';

export interface TradeRecord {
  id: number;
  symbol: string;
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  setup: string;
  result: 'WIN' | 'LOSS' | 'BREAKEVEN';
  pnlPercent: number;
  dayOfWeekEntry: string;
}

export interface JournalInsights {
  winRate: number;
  totalTrades: number;
  bestSetup: string;
  worstSetup: string;
  bestDayToEnter: string;
  worstDayToEnter: string;
  aiFeedbackContext: string;
}

export class AiTradeJournalService extends BaseService {
  private aiService: AIAnalysisService;
  private pool: Pool;

  constructor(aiService: AIAnalysisService, pool: Pool) {
    super('AiTradeJournalService');
    this.aiService = aiService;
    this.pool = pool;
  }

  /**
   * Get trade history from the persistent journal table
   */
  async getTradeHistory(userId: string = 'default_user'): Promise<TradeRecord[]> {
    try {
      const res = await this.pool.query(
        `SELECT * FROM trade_journal_entries
         WHERE user_id = $1 AND result IS NOT NULL
         ORDER BY exit_date DESC LIMIT 200`,
        [userId]
      );

      return res.rows.map((row: any) => ({
        id: row.id,
        symbol: row.symbol,
        entryDate: row.entry_date?.toISOString() || '',
        exitDate: row.exit_date?.toISOString() || '',
        entryPrice: parseFloat(row.entry_price || 0),
        exitPrice: parseFloat(row.exit_price || 0),
        setup: row.setup || 'Unknown',
        result: row.result || 'BREAKEVEN',
        pnlPercent: parseFloat(row.pnl_percent || 0),
        dayOfWeekEntry: row.day_of_week || this.getDayOfWeek(row.entry_date),
      }));
    } catch (error) {
      this.logger.error('Failed to get trade history', error);
      return [];
    }
  }

  /**
   * Add a manual journal entry
   */
  async addEntry(userId: string, entry: Partial<TradeRecord>): Promise<TradeRecord> {
    const res = await this.pool.query(
      `INSERT INTO trade_journal_entries
         (user_id, symbol, trade_type, entry_price, exit_price, quantity, pnl, pnl_percent, setup, result, day_of_week, entry_date, exit_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        userId,
        entry.symbol?.toUpperCase() || '',
        'SELL',
        entry.entryPrice || 0,
        entry.exitPrice || 0,
        1,
        entry.exitPrice && entry.entryPrice ? (entry.exitPrice - entry.entryPrice) : 0,
        entry.pnlPercent || 0,
        entry.setup || 'Manual',
        entry.result || 'BREAKEVEN',
        entry.dayOfWeekEntry || this.getDayOfWeek(new Date()),
        entry.entryDate || new Date().toISOString(),
        entry.exitDate || new Date().toISOString(),
      ]
    );

    const row = res.rows[0];
    return {
      id: row.id,
      symbol: row.symbol,
      entryDate: row.entry_date?.toISOString() || '',
      exitDate: row.exit_date?.toISOString() || '',
      entryPrice: parseFloat(row.entry_price || 0),
      exitPrice: parseFloat(row.exit_price || 0),
      setup: row.setup || 'Unknown',
      result: row.result,
      pnlPercent: parseFloat(row.pnl_percent || 0),
      dayOfWeekEntry: row.day_of_week || '',
    };
  }

  /**
   * Calculate basic statistics and identify patterns
   */
  private generateStats(trades: TradeRecord[]): Partial<JournalInsights> {
    if (trades.length === 0) return {};

    let wins = 0;
    const setups: Record<string, { wins: number; total: number }> = {};
    const days: Record<string, { wins: number; total: number }> = {};

    for (const trade of trades) {
      if (trade.result === 'WIN') wins++;

      if (!setups[trade.setup]) setups[trade.setup] = { wins: 0, total: 0 };
      setups[trade.setup].total++;
      if (trade.result === 'WIN') setups[trade.setup].wins++;

      if (!days[trade.dayOfWeekEntry]) days[trade.dayOfWeekEntry] = { wins: 0, total: 0 };
      days[trade.dayOfWeekEntry].total++;
      if (trade.result === 'WIN') days[trade.dayOfWeekEntry].wins++;
    }

    const winRate = (wins / trades.length) * 100;

    let bestSetup = '', worstSetup = '';
    let maxSetupWR = -1, minSetupWR = 101;
    for (const [setup, stats] of Object.entries(setups)) {
      if (stats.total < 3) continue;
      const wr = (stats.wins / stats.total) * 100;
      if (wr > maxSetupWR) { maxSetupWR = wr; bestSetup = setup; }
      if (wr < minSetupWR) { minSetupWR = wr; worstSetup = setup; }
    }

    let bestDay = '', worstDay = '';
    let maxDayWR = -1, minDayWR = 101;
    for (const [day, stats] of Object.entries(days)) {
      if (stats.total < 3) continue;
      const wr = (stats.wins / stats.total) * 100;
      if (wr > maxDayWR) { maxDayWR = wr; bestDay = day; }
      if (wr < minDayWR) { minDayWR = wr; worstDay = day; }
    }

    return {
      winRate: Math.round(winRate),
      totalTrades: trades.length,
      bestSetup,
      worstSetup,
      bestDayToEnter: bestDay,
      worstDayToEnter: worstDay,
    };
  }

  /**
   * Analyze the user's trading journal using AI
   */
  async analyzeJournal(userId: string = 'default_user'): Promise<JournalInsights> {
    const trades = await this.getTradeHistory(userId);
    const stats = this.generateStats(trades);

    if (trades.length < 10) {
      return {
        winRate: stats.winRate || 0,
        totalTrades: trades.length,
        bestSetup: stats.bestSetup || 'Not enough data',
        worstSetup: stats.worstSetup || 'Not enough data',
        bestDayToEnter: stats.bestDayToEnter || 'Not enough data',
        worstDayToEnter: stats.worstDayToEnter || 'Not enough data',
        aiFeedbackContext: 'You need at least 10 logged trades before I can provide personalized pattern feedback.',
      };
    }

    const prompt = `
      You are an expert quantitative trading psychologist. Analyze the following summary of my recent trades:
      Total Trades: ${stats.totalTrades}
      Win Rate: ${stats.winRate}%
      Most Profitable Setup: ${stats.bestSetup}
      Least Profitable Setup: ${stats.worstSetup}
      Best Day to Enter: ${stats.bestDayToEnter}
      Worst Day to Enter: ${stats.worstDayToEnter}

      Write a highly personalized, empathetic, and actionable 3-paragraph analysis.
      Identify my blind spots, tell me what to stop doing, and what to double down on.
      Use professional yet encouraging tone. Do not use asterisks or markdown formatting.
    `;

    let aiFeedbackContext = 'AI feedback unavailable at this time.';
    try {
      const completion = await this.aiService.generateContent(prompt, [{ role: 'user', content: prompt }]);
      aiFeedbackContext = completion;
    } catch (error) {
      this.logger.warn('Failed to generate AI Trade Journal feedback', error);
    }

    return {
      winRate: stats.winRate as number,
      totalTrades: stats.totalTrades as number,
      bestSetup: stats.bestSetup as string,
      worstSetup: stats.worstSetup as string,
      bestDayToEnter: stats.bestDayToEnter as string,
      worstDayToEnter: stats.worstDayToEnter as string,
      aiFeedbackContext,
    };
  }

  private getDayOfWeek(date: Date | string | null): string {
    if (!date) return 'Unknown';
    const d = typeof date === 'string' ? new Date(date) : date;
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()] || 'Unknown';
  }
}
