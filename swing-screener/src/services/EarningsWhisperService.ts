// src/services/EarningsWhisperService.ts — AI predicts earnings outcomes based on peers and sentiment

import { BaseService } from './BaseService';
import { AIAnalysisService } from './AIAnalysisService';
import { SentimentService } from './SentimentService';
import { MarketDataService } from './MarketDataService';

export interface EarningsPrediction {
  symbol: string;
  expectedDate: string;
  sentimentScore: number;
  peerContext: string; // E.g., "TCS and INFY reported strong beats, boosting sector outlook"
  aiPrediction: 'BEAT' | 'MISS' | 'IN_LINE';
  confidencePercent: number;
  reasoning: string;
}

export class EarningsWhisperService extends BaseService {
  private aiService: AIAnalysisService;
  private sentimentService: SentimentService;
  private marketData: MarketDataService;

  constructor(
    aiService: AIAnalysisService,
    sentimentService: SentimentService,
    marketData: MarketDataService
  ) {
    super('EarningsWhisperService');
    this.aiService = aiService;
    this.sentimentService = sentimentService;
    this.marketData = marketData;
  }

  /**
   * Generates an earnings whisper prediction
   */
  async predictEarnings(symbol: string, peerSymbols: string[]): Promise<EarningsPrediction> {
    const symbolUpper = symbol.toUpperCase();
    this.logger.info(`Generating earnings whisper for ${symbolUpper} vs peers [${peerSymbols.join(', ')}]`);

    // 1. Fetch sentiment for target stock
    const sentiment = await this.sentimentService.scrapeSentiment(symbolUpper);
    
    // 2. Fetch recent price action for target stock
    const quote = await this.marketData.fetchCurrentQuote(symbolUpper);
    const recentTrend = quote ? quote.changePercent : 0;

    // 3. Fetch real peer price action
    const peerResults: string[] = [];
    for (const peer of peerSymbols) {
      try {
        const peerQuote = await this.marketData.fetchCurrentQuote(peer.toUpperCase());
        if (peerQuote) {
          const direction = peerQuote.changePercent >= 0 ? 'up' : 'down';
          peerResults.push(`${peer.toUpperCase()}: ${direction} ${Math.abs(peerQuote.changePercent).toFixed(2)}% (₹${peerQuote.price})`);
        }
      } catch {
        peerResults.push(`${peer.toUpperCase()}: data unavailable`);
      }
    }
    const peerContextStr = peerResults.length > 0
      ? `Recent peer performance: ${peerResults.join('; ')}`
      : 'No peer data available for comparison.';

    // 4. Construct AI Prompt
    const prompt = `
      You are an expert fundamental quantitative analyst specializing in the Indian stock market (NSE).
      Provide an "Earnings Whisper" prediction for ${symbolUpper}.
      
      CONTEXT:
      - Current Social Sentiment Score: ${sentiment.score}/100 
      - Bullish mentions: ${sentiment.bullishPercent}%, Bearish mentions: ${sentiment.bearishPercent}%
      - Recent Price Trend: ${recentTrend}% today
      - Peer Context: ${peerContextStr}
      
      Based on this limited data, predict the likelihood of an earnings BEAT, MISS, or IN_LINE.
      
      Respond STRICTLY in JSON format matching this schema:
      {
        "expectedDate": "string (estimate of next earnings date, e.g. Q3 2024)",
        "aiPrediction": "BEAT" | "MISS" | "IN_LINE",
        "confidencePercent": number (0-100),
        "reasoning": "string (2-3 concise sentences explaining the rationale)"
      }
      Do not output any markdown blocks or text outside the JSON.
    `;

    try {
      const responseText = await this.aiService.generateContent(prompt, [{ role: 'user', content: prompt }]);
      
      // Clean up response if the model returned markdown blocks
      const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      
      try {
        const parsed = JSON.parse(cleaned);
        return {
          symbol: symbolUpper,
          expectedDate: parsed.expectedDate || 'Upcoming',
          sentimentScore: sentiment.score,
          peerContext: peerContextStr,
          aiPrediction: parsed.aiPrediction || 'IN_LINE',
          confidencePercent: parsed.confidencePercent || 50,
          reasoning: parsed.reasoning || 'Insufficient data to form a strong conviction.'
        };
      } catch (e) {
        this.logger.error(`Failed to parse AI JSON response: ${cleaned}`);
        throw new Error('AI produced invalid JSON output');
      }

    } catch (error) {
      this.logger.error(`Failed to generate earnings whisper for ${symbolUpper}`, error);
      
      // Fallback
      return {
        symbol: symbolUpper,
        expectedDate: 'Upcoming',
        sentimentScore: sentiment.score,
        peerContext: peerContextStr,
        aiPrediction: 'IN_LINE',
        confidencePercent: 0,
        reasoning: 'Prediction engine failed. Displaying neutral baseline.'
      };
    }
  }
}
