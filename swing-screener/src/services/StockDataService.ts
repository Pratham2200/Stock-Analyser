// src/services/StockDataService.ts - Service for fetching real stock price data

import yahooFinance from 'yahoo-finance2';
import { BaseService } from './BaseService';
import { DailyBar } from '../types/analysis';
import { getGlobalRateLimiter } from '../utils/rateLimiter';

export class StockDataService extends BaseService {
  // Yahoo Finance rate limit recommendations:
  // - No official rate limits documented by Yahoo
  // - Community observations: Too many requests can lead to IP bans
  // - Conservative approach: 2 seconds between requests (max 30 requests/minute)
  // - Implement exponential backoff for rate limit errors (HTTP 429)
  
  private readonly MAX_RETRIES = 3;
  private readonly INITIAL_RETRY_DELAY_MS = 2000; // 2 seconds initial retry delay
  private rateLimiter = getGlobalRateLimiter();

  constructor() {
    super('StockDataService');
  }

  /**
   * Fetch historical daily price data for a stock with retry logic
   * ⚠️ IMPORTANT: This method fetches REAL stock price data from Yahoo Finance API
   * No dummy/mock data is used - all prices are real market data
   * 
   * @param symbol - Stock symbol (e.g., "RELIANCE", "AFFLE")
   * @param days - Number of days of historical data to fetch (default: 120)
   * @param retryCount - Internal retry counter for exponential backoff
   * @returns Array of DailyBar objects with REAL market data
   */
  async fetchDailyBars(symbol: string, days: number = 120, retryCount: number = 0): Promise<DailyBar[]> {
    try {
      // Wait for rate limiter before making request
      await this.rateLimiter.waitIfNeeded();
      
      // Convert Indian stock symbol to Yahoo Finance format
      // Chartink stocks are NSE stocks, so add .NS suffix
      const yahooSymbol = this.convertToYahooSymbol(symbol);
      
      this.logger.info(`📊 Fetching ${days} days of REAL historical data for ${symbol} (${yahooSymbol}) from Yahoo Finance API...`);

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (days + 10)); // Add buffer for weekends/holidays

      // Fetch REAL historical data from Yahoo Finance API
      // yahoo-finance2 uses date strings or Date objects
      const queryOptions = {
        period1: startDate,
        period2: endDate,
        interval: '1d' as const,
      };

      const result = await yahooFinance.historical(yahooSymbol, queryOptions);

      if (!result || result.length === 0) {
        this.logger.warn(`⚠️ No data found for ${symbol} (${yahooSymbol})`);
        return [];
      }

      // Transform Yahoo Finance data to DailyBar format
      // yahoo-finance2 returns an array of objects with date, open, high, low, close, volume
      const dailyBars: DailyBar[] = result
        .filter((quote: any) => {
          // Filter out invalid data points
          return quote && 
                 quote.close !== null && 
                 quote.close !== undefined &&
                 quote.volume !== null &&
                 quote.volume !== undefined;
        })
        .map((quote: any) => {
          // Handle date format - could be Date object or string
          let dateStr: string;
          if (quote.date instanceof Date) {
            dateStr = quote.date.toISOString().split('T')[0];
          } else if (typeof quote.date === 'string') {
            dateStr = quote.date.split('T')[0]; // Handle ISO string
          } else {
            // Fallback: use current date if format is unexpected
            dateStr = new Date().toISOString().split('T')[0];
          }
          
          return {
            date: dateStr,
            open: Number(quote.open) || 0,
            high: Number(quote.high) || 0,
            low: Number(quote.low) || 0,
            close: Number(quote.close) || 0,
            volume: Number(quote.volume) || 0,
          };
        })
        .sort((a: DailyBar, b: DailyBar) => {
          // Ensure chronological order (oldest first)
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        })
        .slice(-days); // Take only the last 'days' records

      this.logger.success(`✅ Fetched ${dailyBars.length} days of data for ${symbol}`);

      return dailyBars;
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const statusCode = error?.statusCode || error?.status || error?.code;
      
      // Check if it's a rate limit error (429) or network error that might indicate throttling
      const isRateLimitError = statusCode === 429 || 
                               errorMessage.includes('rate limit') ||
                               errorMessage.includes('429') ||
                               errorMessage.includes('Too Many Requests') ||
                               errorMessage.includes('throttle');
      
      // Retry with exponential backoff if rate limited and haven't exceeded max retries
      if (isRateLimitError && retryCount < this.MAX_RETRIES) {
        const retryDelay = this.INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount); // Exponential backoff: 2s, 4s, 8s
        this.logger.warn(`⚠️ Rate limit hit for ${symbol}. Retrying in ${retryDelay}ms... (Attempt ${retryCount + 1}/${this.MAX_RETRIES})`);
        
        // Wait for exponential backoff delay
        await this.delay(retryDelay);
        
        // Reset rate limiter window to allow retry
        this.rateLimiter.reset();
        
        return this.fetchDailyBars(symbol, days, retryCount + 1);
      }
      
      // Log error but don't retry for other types of errors
      if (isRateLimitError) {
        this.logger.error(`❌ Rate limit exceeded for ${symbol} after ${this.MAX_RETRIES} retries. Skipping...`);
      } else {
        this.logger.error(`❌ Failed to fetch data for ${symbol}:`, errorMessage);
      }
      
      // Return empty array on error - will cause analysis to fail gracefully
      return [];
    }
  }

  /**
   * Convert Indian stock symbol to Yahoo Finance format
   * @param symbol - Plain stock symbol (e.g., "RELIANCE", "AFFLE")
   * @returns Yahoo Finance symbol (e.g., "RELIANCE.NS", "AFFLE.NS")
   */
  private convertToYahooSymbol(symbol: string): string {
    // Chartink stocks are typically NSE stocks
    // If symbol doesn't already have a suffix, add .NS
    if (symbol.includes('.NS') || symbol.includes('.BO')) {
      return symbol;
    }
    return `${symbol.toUpperCase()}.NS`;
  }

  /**
   * Fetch current price for a stock
   * @param symbol - Stock symbol
   * @returns Current price or null if not found
   */
  async fetchCurrentPrice(symbol: string): Promise<number | null> {
    try {
      // Wait for rate limiter before making request
      await this.rateLimiter.waitIfNeeded();
      
      const yahooSymbol = this.convertToYahooSymbol(symbol);
      const quote = await yahooFinance.quote(yahooSymbol);
      
      if (quote && quote.regularMarketPrice) {
        return quote.regularMarketPrice;
      }
      
      return null;
    } catch (error) {
      this.logger.error(`Failed to fetch current price for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Check if a stock symbol is valid and data is available
   * @param symbol - Stock symbol
   * @returns true if data is available, false otherwise
   */
  async isSymbolValid(symbol: string): Promise<boolean> {
    try {
      const dailyBars = await this.fetchDailyBars(symbol, 1);
      return dailyBars.length > 0;
    } catch (error) {
      return false;
    }
  }
}

