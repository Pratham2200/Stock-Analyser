// src/services/TradeIdeaService.ts — AI-generated daily trade ideas
// PHASE D: Fully persistent via PostgreSQL

import { Pool } from 'pg';
import { BaseService } from './BaseService';
import { AIAnalysisService } from './AIAnalysisService';
import { MarketDataService } from './MarketDataService';
import { SentimentService } from './SentimentService';
import { OptionsService } from './OptionsService';

export interface TradeIdea {
  id: number;
  symbol: string;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  confidence: number;
  rationale: string;
  entryZone: string;
  targetPrice: string;
  stopLoss: string;
  generatedAt: string;
  dataPoints: {
    sentiment: number;
    pcr?: number;
    rsiSignal: string;
    priceChangePercent: number;
  };
  upvotes: number;
  downvotes: number;
}

export class TradeIdeaService extends BaseService {
  private aiService: AIAnalysisService | null;
  private marketData: MarketDataService;
  private sentimentService: SentimentService;
  private optionsService: OptionsService;
  private pool: Pool;

  constructor(
    aiService: AIAnalysisService | null,
    marketData: MarketDataService,
    sentimentService: SentimentService,
    optionsService: OptionsService,
    pool: Pool
  ) {
    super('TradeIdeaService');
    this.aiService = aiService;
    this.marketData = marketData;
    this.sentimentService = sentimentService;
    this.optionsService = optionsService;
    this.pool = pool;
  }

  /**
   * Generate a trade idea for a given symbol and persist it
   */
  async generateIdea(symbol: string): Promise<TradeIdea> {
    const symbolUpper = symbol.toUpperCase();

    // 1. Gather data points
    const [quote, sentiment] = await Promise.all([
      this.marketData.fetchCurrentQuote(symbolUpper),
      this.sentimentService.scrapeSentiment(symbolUpper),
    ]);

    if (!quote || quote.price <= 0) {
      throw new Error(`Cannot generate idea for ${symbolUpper}: no market data`);
    }

    let pcr: number | undefined;
    try {
      const oi = await this.optionsService.getOIAnalysis(symbolUpper);
      pcr = oi.pcrRatio;
    } catch { /* Not an F&O stock */ }

    // 2. Determine direction
    const direction: TradeIdea['direction'] =
      sentiment.score > 60 && quote.changePercent > 0 ? 'LONG' :
      sentiment.score < 40 && quote.changePercent < 0 ? 'SHORT' : 'NEUTRAL';

    // 3. AI rationale
    let rationale = `${symbolUpper} shows ${direction.toLowerCase()} bias based on sentiment (${sentiment.score}/100) and price action (${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%).`;
    let entryZone = `₹${(quote.price * 0.99).toFixed(2)} - ₹${(quote.price * 1.01).toFixed(2)}`;
    let targetPrice = direction === 'LONG'
      ? `₹${(quote.price * 1.05).toFixed(2)}`
      : direction === 'SHORT'
        ? `₹${(quote.price * 0.95).toFixed(2)}`
        : `₹${quote.price.toFixed(2)}`;
    let stopLoss = direction === 'LONG'
      ? `₹${(quote.price * 0.97).toFixed(2)}`
      : `₹${(quote.price * 1.03).toFixed(2)}`;

    if (this.aiService) {
      try {
        const prompt = `You are a professional swing trader on NSE India. Generate a concise trade idea for ${symbolUpper} at ₹${quote.price}.
Sentiment: ${sentiment.score}/100. Price Change: ${quote.changePercent.toFixed(2)}%. ${pcr ? `PCR: ${pcr}` : ''}
Respond in JSON: {"rationale":"string (2 sentences max)","entryZone":"string","targetPrice":"string","stopLoss":"string"}
No markdown, only JSON.`;
        const response = await this.aiService.generateContent(prompt);
        const cleaned = response.replace(/```json/g, '').replace(/```/g, '').trim();
        try {
          const parsed = JSON.parse(cleaned);
          rationale = parsed.rationale || rationale;
          entryZone = parsed.entryZone || entryZone;
          targetPrice = parsed.targetPrice || targetPrice;
          stopLoss = parsed.stopLoss || stopLoss;
        } catch { /* use defaults */ }
      } catch { /* use defaults */ }
    }

    const dataPoints = {
      sentiment: sentiment.score,
      pcr,
      rsiSignal: direction === 'LONG' ? 'Bullish' : direction === 'SHORT' ? 'Bearish' : 'Neutral',
      priceChangePercent: quote.changePercent,
    };

    // 4. Persist to database
    const res = await this.pool.query(
      `INSERT INTO ai_trade_ideas (symbol, direction, confidence, rationale, entry_zone, target_price, stop_loss, data_points)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [symbolUpper, direction, Math.min(100, Math.max(0, sentiment.score)), rationale, entryZone, targetPrice, stopLoss, JSON.stringify(dataPoints)]
    );

    const row = res.rows[0];
    return this.rowToIdea(row);
  }

  /**
   * Vote on a trade idea — atomic increment
   */
  async vote(ideaId: string | number, direction: 'up' | 'down'): Promise<TradeIdea> {
    const column = direction === 'up' ? 'upvotes' : 'downvotes';
    const res = await this.pool.query(
      `UPDATE ai_trade_ideas SET ${column} = ${column} + 1 WHERE id = $1 RETURNING *`,
      [ideaId]
    );
    if (res.rows.length === 0) throw new Error(`Trade idea ${ideaId} not found`);
    return this.rowToIdea(res.rows[0]);
  }

  /**
   * Get recent trade ideas from database
   */
  async getRecentIdeas(limit: number = 10): Promise<TradeIdea[]> {
    const res = await this.pool.query(
      'SELECT * FROM ai_trade_ideas ORDER BY created_at DESC LIMIT $1',
      [limit]
    );
    return res.rows.map((r: any) => this.rowToIdea(r));
  }

  private rowToIdea(row: any): TradeIdea {
    const dp = typeof row.data_points === 'string' ? JSON.parse(row.data_points) : (row.data_points || {});
    return {
      id: row.id,
      symbol: row.symbol,
      direction: row.direction,
      confidence: row.confidence,
      rationale: row.rationale || '',
      entryZone: row.entry_zone || '',
      targetPrice: row.target_price || '',
      stopLoss: row.stop_loss || '',
      generatedAt: row.created_at?.toISOString() || new Date().toISOString(),
      dataPoints: {
        sentiment: dp.sentiment || 0,
        pcr: dp.pcr,
        rsiSignal: dp.rsiSignal || 'Neutral',
        priceChangePercent: dp.priceChangePercent || 0,
      },
      upvotes: row.upvotes || 0,
      downvotes: row.downvotes || 0,
    };
  }
}
