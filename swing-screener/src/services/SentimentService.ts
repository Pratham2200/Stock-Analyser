// src/services/SentimentService.ts — Social sentiment scraper
// Scrapes public forums via HTTP (no Puppeteer, no API keys)

import { BaseService } from './BaseService';

// ── Types ────────────────────────────────────────────────────────

export interface SentimentPost {
  source: string;
  title: string;
  text: string;
  url: string;
  timestamp: string;
  sentiment?: 'bullish' | 'bearish' | 'neutral';
  score?: number;
}

export interface SentimentResult {
  symbol: string;
  score: number; // 0-100 (0=very bearish, 100=very bullish)
  bullishPercent: number;
  bearishPercent: number;
  neutralPercent: number;
  totalAnalyzed: number;
  sources: {
    name: string;
    count: number;
    sentiment: number;
  }[];
  topMentions: SentimentPost[];
  scrapedAt: string;
}

// ── Service ──────────────────────────────────────────────────────

export class SentimentService extends BaseService {
  private static readonly USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  constructor() {
    super('SentimentService');
  }

  /**
   * Scrape sentiment for a stock from all sources
   */
  async scrapeSentiment(symbol: string): Promise<SentimentResult> {
    const allPosts: SentimentPost[] = [];

    // Scrape all sources in parallel, gracefully handle failures
    const results = await Promise.allSettled([
      this.scrapeReddit(symbol),
      this.scrapeGoogleNews(symbol),
      this.scrapeTradingView(symbol),
    ]);

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allPosts.push(...result.value);
      }
    }

    // Classify sentiment for each post using keyword analysis
    for (const post of allPosts) {
      post.sentiment = this.classifySentiment(post.title + ' ' + post.text);
    }

    // Calculate aggregates
    const bullish = allPosts.filter(p => p.sentiment === 'bullish').length;
    const bearish = allPosts.filter(p => p.sentiment === 'bearish').length;
    const neutral = allPosts.filter(p => p.sentiment === 'neutral').length;
    const total = allPosts.length || 1;

    const bullishPercent = Math.round((bullish / total) * 100);
    const bearishPercent = Math.round((bearish / total) * 100);
    const neutralPercent = 100 - bullishPercent - bearishPercent;
    const score = Math.round(50 + (bullishPercent - bearishPercent) / 2);

    // Per-source breakdown
    const sourceMap: Record<string, SentimentPost[]> = {};
    for (const post of allPosts) {
      if (!sourceMap[post.source]) sourceMap[post.source] = [];
      sourceMap[post.source].push(post);
    }

    const sources = Object.entries(sourceMap).map(([name, posts]) => {
      const srcBullish = posts.filter(p => p.sentiment === 'bullish').length;
      const srcBearish = posts.filter(p => p.sentiment === 'bearish').length;
      const srcTotal = posts.length || 1;
      return {
        name,
        count: posts.length,
        sentiment: Math.round(50 + ((srcBullish - srcBearish) / srcTotal) * 50),
      };
    });

    // Top mentions (most relevant, sorted by recency)
    const topMentions = allPosts
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);

    return {
      symbol: symbol.toUpperCase(),
      score: Math.max(0, Math.min(100, score)),
      bullishPercent,
      bearishPercent,
      neutralPercent,
      totalAnalyzed: allPosts.length,
      sources,
      topMentions,
      scrapedAt: new Date().toISOString(),
    };
  }

  // ── Reddit ───────────────────────────────────────────────────

  private async scrapeReddit(symbol: string): Promise<SentimentPost[]> {
    const posts: SentimentPost[] = [];
    const subreddits = ['IndianStreetBets', 'indiainvestments', 'indianStockMarket'];

    for (const sub of subreddits) {
      try {
        const url = `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(symbol)}&sort=new&t=week&limit=10`;
        const response = await this.fetchWithTimeout(url, {
          headers: { 'User-Agent': SentimentService.USER_AGENT },
        });

        if (!response.ok) continue;
        const data = await response.json();

        if (data?.data?.children) {
          for (const child of data.data.children) {
            const d = child.data;
            posts.push({
              source: `Reddit r/${sub}`,
              title: d.title || '',
              text: (d.selftext || '').substring(0, 500),
              url: `https://reddit.com${d.permalink || ''}`,
              timestamp: new Date((d.created_utc || 0) * 1000).toISOString(),
            });
          }
        }
      } catch (error) {
        this.logger.debug(`Reddit r/${sub} scrape failed: ${(error as Error).message}`);
      }
    }

    return posts;
  }

  // ── Google News ──────────────────────────────────────────────

  private async scrapeGoogleNews(symbol: string): Promise<SentimentPost[]> {
    const posts: SentimentPost[] = [];

    try {
      const query = encodeURIComponent(`${symbol} stock India`);
      const url = `https://news.google.com/rss/search?q=${query}&hl=en-IN&gl=IN&ceid=IN:en`;

      const response = await this.fetchWithTimeout(url);
      if (!response.ok) return posts;

      const xml = await response.text();

      // Simple XML parsing for RSS
      const items = xml.split('<item>').slice(1);
      for (const item of items.slice(0, 10)) {
        const title = this.extractXmlTag(item, 'title');
        const link = this.extractXmlTag(item, 'link');
        const pubDate = this.extractXmlTag(item, 'pubDate');
        const source = this.extractXmlTag(item, 'source');

        if (title) {
          posts.push({
            source: `Google News${source ? ` (${source})` : ''}`,
            title: this.decodeHtmlEntities(title),
            text: '',
            url: link || '',
            timestamp: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      this.logger.debug(`Google News scrape failed: ${(error as Error).message}`);
    }

    return posts;
  }

  // ── TradingView ──────────────────────────────────────────────

  private async scrapeTradingView(symbol: string): Promise<SentimentPost[]> {
    const posts: SentimentPost[] = [];

    try {
      // TradingView ideas API (public)
      const url = `https://www.tradingview.com/symbols/NSE-${symbol.toUpperCase()}/ideas/`;
      const response = await this.fetchWithTimeout(url, {
        headers: { 'User-Agent': SentimentService.USER_AGENT },
      });

      if (!response.ok) return posts;

      const html = await response.text();

      // Extract idea titles from HTML
      const titleMatches = html.match(/data-name="idea-title"[^>]*>([^<]+)</g);
      if (titleMatches) {
        for (const match of titleMatches.slice(0, 5)) {
          const title = match.replace(/data-name="idea-title"[^>]*>/, '').trim();
          if (title) {
            posts.push({
              source: 'TradingView',
              title,
              text: '',
              url: `https://www.tradingview.com/symbols/NSE-${symbol.toUpperCase()}/ideas/`,
              timestamp: new Date().toISOString(),
            });
          }
        }
      }
    } catch (error) {
      this.logger.debug(`TradingView scrape failed: ${(error as Error).message}`);
    }

    return posts;
  }

  // ── Sentiment Classification ─────────────────────────────────

  /**
   * Classify text as bullish/bearish/neutral using keyword analysis
   * NOTE: For AI-powered classification, the AskAIService will use Gemini
   */
  private classifySentiment(text: string): 'bullish' | 'bearish' | 'neutral' {
    const lower = text.toLowerCase();

    const bullishWords = [
      'buy', 'bullish', 'long', 'breakout', 'support', 'upside', 'rally',
      'strong', 'accumulate', 'beat', 'outperform', 'upgrade', 'target',
      'positive', 'growth', 'profit', 'gain', 'surge', 'soar', 'rocket',
      'moon', 'bull', 'green', 'recover', 'momentum', 'undervalued',
    ];

    const bearishWords = [
      'sell', 'bearish', 'short', 'crash', 'resistance', 'downside',
      'weak', 'decline', 'fall', 'drop', 'miss', 'underperform',
      'downgrade', 'negative', 'loss', 'risk', 'warning', 'fear',
      'bear', 'red', 'overvalued', 'dump', 'correction', 'bubble',
    ];

    let bullScore = 0;
    let bearScore = 0;

    for (const word of bullishWords) {
      if (lower.includes(word)) bullScore++;
    }
    for (const word of bearishWords) {
      if (lower.includes(word)) bearScore++;
    }

    if (bullScore > bearScore + 1) return 'bullish';
    if (bearScore > bullScore + 1) return 'bearish';
    return 'neutral';
  }

  // ── Helpers ──────────────────────────────────────────────────

  private async fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractXmlTag(xml: string, tag: string): string {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
    return match?.[1]?.trim() || '';
  }

  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/<!\[CDATA\[|\]\]>/g, '');
  }
}
