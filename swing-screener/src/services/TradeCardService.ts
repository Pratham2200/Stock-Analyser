// src/services/TradeCardService.ts — Generates shareable analysis cards for social media
// PHASE D: Cards are persisted to trade_cards table

import { Pool } from 'pg';
import { BaseService } from './BaseService';
import { MarketDataService } from './MarketDataService';
import { AIAnalysisService } from './AIAnalysisService';

export interface TradeCard {
  id: number;
  symbol: string;
  generatedAt: string;
  cardType: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  headline: string;
  metrics: {
    price: number;
    changePercent: number;
    high52w: number;
    low52w: number;
    volume: number;
  };
  aiSummary: string;
  shareUrl: string;
}

export class TradeCardService extends BaseService {
  private marketData: MarketDataService;
  private aiService: AIAnalysisService | null;
  private pool: Pool;

  constructor(marketData: MarketDataService, aiService: AIAnalysisService | null, pool: Pool) {
    super('TradeCardService');
    this.marketData = marketData;
    this.aiService = aiService;
    this.pool = pool;
  }

  async generateCard(symbol: string, userId: string): Promise<TradeCard> {
    const symbolUpper = symbol.toUpperCase();

    const quote = await this.marketData.fetchCurrentQuote(symbolUpper);
    if (!quote || quote.price <= 0) {
      throw new Error(`Cannot generate card: no quote data for ${symbolUpper}`);
    }

    const cardType: TradeCard['cardType'] =
      quote.changePercent > 1 ? 'BULLISH' :
      quote.changePercent < -1 ? 'BEARISH' : 'NEUTRAL';

    let aiSummary = `${symbolUpper} at ₹${quote.price} (${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%)`;
    const headline = `${symbolUpper} ${cardType === 'BULLISH' ? '🚀' : cardType === 'BEARISH' ? '📉' : '➡️'} ${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%`;

    if (this.aiService) {
      try {
        const prompt = `Generate a single compelling, tweet-length (max 140 chars) stock insight for ${symbolUpper} currently at ₹${quote.price}, ${quote.changePercent >= 0 ? 'up' : 'down'} ${Math.abs(quote.changePercent).toFixed(2)}%. 52-week high: ₹${quote.fiftyTwoWeekHigh}, low: ₹${quote.fiftyTwoWeekLow}. Output only the text, no quotes or formatting.`;
        aiSummary = await this.aiService.generateContent(prompt);
      } catch {
        this.logger.debug('AI summary generation failed, using default');
      }
    }

    const metrics = {
      price: quote.price,
      changePercent: quote.changePercent,
      high52w: quote.fiftyTwoWeekHigh,
      low52w: quote.fiftyTwoWeekLow,
      volume: quote.volume,
    };

    // Persist to database
    const res = await this.pool.query(
      `INSERT INTO trade_cards (user_id, symbol, card_type, headline, metrics, ai_summary, share_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, symbolUpper, cardType, headline, JSON.stringify(metrics), aiSummary, '']
    );

    const row = res.rows[0];
    const shareUrl = `/share/card/${row.id}`;

    // Update share URL with the generated ID
    await this.pool.query(
      'UPDATE trade_cards SET share_url = $1 WHERE id = $2',
      [shareUrl, row.id]
    );

    return {
      id: row.id,
      symbol: symbolUpper,
      generatedAt: row.created_at?.toISOString() || new Date().toISOString(),
      cardType,
      headline,
      metrics,
      aiSummary,
      shareUrl,
    };
  }

  /**
   * Get a user's generated cards
   */
  async getUserCards(userId: string, limit: number = 20): Promise<TradeCard[]> {
    const res = await this.pool.query(
      'SELECT * FROM trade_cards WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit]
    );

    return res.rows.map((row: any) => {
      const metrics = typeof row.metrics === 'string' ? JSON.parse(row.metrics) : (row.metrics || {});
      return {
        id: row.id,
        symbol: row.symbol,
        generatedAt: row.created_at?.toISOString() || '',
        cardType: row.card_type,
        headline: row.headline || '',
        metrics,
        aiSummary: row.ai_summary || '',
        shareUrl: row.share_url || `/share/card/${row.id}`,
      };
    });
  }
}
