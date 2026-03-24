// src/services/AskAIService.ts — Conversational stock assistant
// Orchestrates: symbol extraction → parallel data fetch → AI response

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { BaseService } from './BaseService';
import { NseDataService } from './NseDataService';
import { SentimentService, SentimentResult } from './SentimentService';
import { OptionsService } from './OptionsService';

// ── Types ────────────────────────────────────────────────────────

export interface AskAIRequest {
  prompt: string;
  conversationHistory?: ChatMessage[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface AskAIResponse {
  answer: string;
  sources: string[];
  dataUsed: {
    quote?: boolean;
    sentiment?: boolean;
    options?: boolean;
    news?: boolean;
  };
  tokensUsed: number;
  processingTimeMs: number;
}

interface ExtractedContext {
  symbols: string[];
  intent: 'analysis' | 'sentiment' | 'options' | 'price' | 'compare' | 'general';
  includeOptions: boolean;
  includeSentiment: boolean;
}

// ── Service ──────────────────────────────────────────────────────

export class AskAIService extends BaseService {
  private model: GenerativeModel;
  private nseData: NseDataService;
  private sentimentService: SentimentService;
  private optionsService: OptionsService | null;

  constructor(
    nseData: NseDataService,
    sentimentService: SentimentService,
    optionsService?: OptionsService,
    apiKey?: string,
  ) {
    super('AskAIService');

    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY required for AskAI');

    const genAI = new GoogleGenerativeAI(key);
    this.model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.4,
        topP: 0.9,
        maxOutputTokens: 4096,
      },
    });

    this.nseData = nseData;
    this.sentimentService = sentimentService;
    this.optionsService = optionsService || null;
  }

  /**
   * Process a natural language question about stocks
   */
  async ask(request: AskAIRequest): Promise<AskAIResponse> {
    const startTime = Date.now();
    const sources: string[] = [];

    // 1. Extract symbols and intent from prompt
    const context = await this.extractContext(request.prompt);

    // 2. Fetch data in parallel based on context
    const dataBundle = await this.fetchData(context, sources);

    // 3. Build comprehensive prompt with all data
    const enhancedPrompt = this.buildPrompt(request, context, dataBundle);

    // 4. Get AI response
    const response = await this.model.generateContent(enhancedPrompt);
    const text = response.response.text();
    const tokensUsed = response.response.usageMetadata?.totalTokenCount || 0;

    return {
      answer: text,
      sources,
      dataUsed: {
        quote: dataBundle.quotes.length > 0,
        sentiment: dataBundle.sentiments.length > 0,
        options: dataBundle.optionsData.length > 0,
        news: dataBundle.sentiments.some(s => s.sources.some(src => src.name.includes('News'))),
      },
      tokensUsed,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Extract stock symbols and intent from natural language
   */
  private async extractContext(prompt: string): Promise<ExtractedContext> {
    // Quick pattern matching for common symbols
    const symbolPattern = /\b([A-Z]{2,15})\b/g;
    const knownIndices = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'SENSEX'];

    const potentialSymbols: string[] = [];
    let match;

    while ((match = symbolPattern.exec(prompt.toUpperCase())) !== null) {
      const word = match[1];
      // Filter out common English words
      const stopWords = new Set([
        'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'ANY',
        'CAN', 'HER', 'WAS', 'ONE', 'OUR', 'OUT', 'DAY', 'HAD', 'HAS',
        'HIS', 'HOW', 'ITS', 'MAY', 'NEW', 'NOW', 'OLD', 'SEE', 'WAY',
        'WHO', 'DID', 'GET', 'LET', 'SAY', 'SHE', 'TOO', 'USE', 'WILL',
        'WHAT', 'WHEN', 'WHERE', 'WHICH', 'THIS', 'THAT', 'THAN', 'THEM',
        'THEN', 'SOME', 'ABOUT', 'STOCK', 'PRICE', 'MARKET', 'SHARE',
        'TRADE', 'OPTION', 'CALL', 'PUT', 'BUY', 'SELL', 'WITH', 'SHOULD',
        'THINK', 'DOES', 'FROM', 'GOOD', 'HAVE', 'INTO', 'JUST', 'LIKE',
        'LONG', 'MUCH', 'VERY', 'BEEN', 'ALSO', 'HIGH', 'LOW', 'MORE',
      ]);

      if (!stopWords.has(word) && word.length >= 2) {
        potentialSymbols.push(word);
      }
    }

    // Add known index names if mentioned
    for (const idx of knownIndices) {
      if (prompt.toUpperCase().includes(idx) && !potentialSymbols.includes(idx)) {
        potentialSymbols.push(idx);
      }
    }

    // Determine intent
    const lower = prompt.toLowerCase();
    let intent: ExtractedContext['intent'] = 'analysis';

    if (lower.match(/sentim|opinion|think|feel|forum|reddit|twitter|social/)) {
      intent = 'sentiment';
    } else if (lower.match(/option|call|put|strike|expiry|greeks|delta|gamma|straddle/)) {
      intent = 'options';
    } else if (lower.match(/price|level|target|support|resistance|where|current/)) {
      intent = 'price';
    } else if (lower.match(/compare|vs|versus|better|between/)) {
      intent = 'compare';
    } else if (potentialSymbols.length === 0) {
      intent = 'general';
    }

    return {
      symbols: potentialSymbols.slice(0, 3), // Max 3 symbols
      intent,
      includeOptions: intent === 'options' || lower.includes('option'),
      includeSentiment: intent === 'sentiment' || lower.includes('sentim'),
    };
  }

  /**
   * Fetch all relevant data in parallel
   */
  private async fetchData(
    context: ExtractedContext,
    sources: string[],
  ): Promise<{
    quotes: any[];
    sentiments: SentimentResult[];
    optionsData: any[];
  }> {
    const quotes: any[] = [];
    const sentiments: SentimentResult[] = [];
    const optionsData: any[] = [];

    const tasks: Promise<void>[] = [];

    for (const symbol of context.symbols) {
      // Always fetch quote
      tasks.push(
        this.nseData.fetchQuote(symbol)
          .then(q => { quotes.push(q); sources.push(`NSE Quote: ${symbol}`); })
          .catch(() => this.logger.debug(`Quote fetch failed for ${symbol}`)),
      );

      // Sentiment if requested or general analysis
      if (context.includeSentiment || context.intent === 'analysis') {
        tasks.push(
          this.sentimentService.scrapeSentiment(symbol)
            .then(s => { sentiments.push(s); sources.push(`Sentiment: ${symbol}`); })
            .catch(() => this.logger.debug(`Sentiment fetch failed for ${symbol}`)),
        );
      }

      // Options if requested
      if (context.includeOptions && this.optionsService) {
        tasks.push(
          this.optionsService.getOIAnalysis(symbol)
            .then(o => { optionsData.push(o); sources.push(`Options OI: ${symbol}`); })
            .catch(() => this.logger.debug(`Options fetch failed for ${symbol}`)),
        );
      }
    }

    await Promise.allSettled(tasks);
    return { quotes, sentiments, optionsData };
  }

  /**
   * Build the final prompt with all context data
   */
  private buildPrompt(
    request: AskAIRequest,
    context: ExtractedContext,
    data: { quotes: any[]; sentiments: SentimentResult[]; optionsData: any[] },
  ): string {
    let prompt = `You are a professional Indian stock market analyst assistant. Respond with well-structured, actionable analysis. Use markdown formatting with headers, bullet points, and tables where appropriate.

IMPORTANT RULES:
- Always include specific numbers, prices, and percentages when available
- For sentiment analysis, show the breakdown by source
- For options, explain Greeks, max pain, and support/resistance in simple terms
- Add a clear "Summary" section at the end
- Include a "Risk Factors" section when giving buy/sell opinions
- Use ₹ for Indian Rupee prices
- Be confident but honest about uncertainty
- If data is unavailable for any part, acknowledge it clearly

`;

    // Add conversation history if available
    if (request.conversationHistory?.length) {
      prompt += `=== CONVERSATION HISTORY ===\n`;
      for (const msg of request.conversationHistory.slice(-5)) {
        prompt += `${msg.role.toUpperCase()}: ${msg.content}\n`;
      }
      prompt += '\n';
    }

    // Add live market data
    if (data.quotes.length > 0) {
      prompt += `=== LIVE MARKET DATA (from NSE India) ===\n`;
      prompt += JSON.stringify(data.quotes, null, 2);
      prompt += '\n\n';
    }

    // Add sentiment data
    if (data.sentiments.length > 0) {
      prompt += `=== SOCIAL SENTIMENT DATA ===\n`;
      for (const s of data.sentiments) {
        prompt += `\n${s.symbol}: Overall Score ${s.score}/100\n`;
        prompt += `- Bullish: ${s.bullishPercent}% | Bearish: ${s.bearishPercent}% | Neutral: ${s.neutralPercent}%\n`;
        prompt += `- Sources analyzed: ${s.totalAnalyzed} posts from ${s.sources.map(src => src.name).join(', ')}\n`;

        if (s.topMentions.length > 0) {
          prompt += `- Recent mentions:\n`;
          for (const m of s.topMentions.slice(0, 5)) {
            prompt += `  • [${m.source}] "${m.title}" (${m.sentiment})\n`;
          }
        }
      }
      prompt += '\n';
    }

    // Add options data
    if (data.optionsData.length > 0) {
      prompt += `=== OPTIONS MARKET DATA ===\n`;
      prompt += JSON.stringify(data.optionsData, null, 2);
      prompt += '\n\n';
    }

    // Add the user's question
    prompt += `=== USER QUESTION ===\n${request.prompt}\n\n`;
    prompt += `Provide a comprehensive, professional response:`;

    return prompt;
  }
}
