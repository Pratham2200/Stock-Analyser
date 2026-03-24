// src/services/AiTradeJournalService.ts - Analyzes past trades to find patterns

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
  setup: string; // e.g., 'Breakout', 'Pullback', 'Earnings'
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
  aiFeedbackContext: string; // AI generated personalized paragraph
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
   * Mocking the trade history retrieval (since we don't have a fully fleshed out
   * individual user trade execution table yet, we'll build the contract)
   */
  async getTradeHistory(userId: string = 'default'): Promise<TradeRecord[]> {
    try {
      // In reality: SELECT * FROM user_trades WHERE user_id = userId
      // For now, we return empty or stub data
      return [];
    } catch (error) {
      this.logger.error('Failed to get trade history', error);
      return [];
    }
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

      // Track Setups
      if (!setups[trade.setup]) setups[trade.setup] = { wins: 0, total: 0 };
      setups[trade.setup].total++;
      if (trade.result === 'WIN') setups[trade.setup].wins++;

      // Track Entry Days
      if (!days[trade.dayOfWeekEntry]) days[trade.dayOfWeekEntry] = { wins: 0, total: 0 };
      days[trade.dayOfWeekEntry].total++;
      if (trade.result === 'WIN') days[trade.dayOfWeekEntry].wins++;
    }

    const winRate = (wins / trades.length) * 100;

    // Find best/worst setups
    let bestSetup = '';
    let worstSetup = '';
    let maxSetupWR = -1;
    let minSetupWR = 101;

    for (const [setup, stats] of Object.entries(setups)) {
      if (stats.total < 3) continue; // Need at least 3 trades for statistical relevance
      const wr = (stats.wins / stats.total) * 100;
      if (wr > maxSetupWR) { maxSetupWR = wr; bestSetup = setup; }
      if (wr < minSetupWR) { minSetupWR = wr; worstSetup = setup; }
    }

    // Find best/worst entry days
    let bestDay = '';
    let worstDay = '';
    let maxDayWR = -1;
    let minDayWR = 101;

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
      worstDayToEnter: worstDay
    };
  }

  /**
   * Analyze the user's trading journal using AI
   */
  async analyzeJournal(userId: string = 'default'): Promise<JournalInsights> {
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
        aiFeedbackContext: 'You need at least 10 logged trades before I can provide personalized pattern feedback.'
      };
    }

    // Prepare prompt for AI
    const prompt = `
      You are an expert quantitative trading psychologist. Analyze the following summary of my recent trades:
      Total Trades: ${stats.totalTrades}
      Win Rate: ${stats.winRate}%
      Most Profitable Setup: ${stats.bestSetup}
      Least Profitable Setup: ${stats.worstSetup}
      Best Day to Enter: ${stats.bestDayToEnter}
      Worst Day to Enter: ${stats.worstDayToEnter}

      Write a highly personalized, empathetic, and actionable 3-paragraph analysis. 
      Identify my blind spots, tell me what to stop doing (e.g. stop trading the worst setup), and what to double down on.
      Use professional yet encouraging tone. Do not use asterisks or markdown formatting.
    `;

    // Attempt AI generation
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
      aiFeedbackContext
    };
  }
}
