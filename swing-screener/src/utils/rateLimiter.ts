// src/utils/rateLimiter.ts - Rate limiter for Yahoo Finance API

import { BaseService } from '../services/BaseService';

/**
 * Rate limiter for Yahoo Finance API
 * Based on community observations:
 * - No official rate limits documented
 * - Too many requests can lead to IP bans
 * - Recommended: 1-2 seconds between requests
 * - Conservative approach: 2 seconds between requests (30 requests per minute max)
 */
export class YahooFinanceRateLimiter {
  private lastRequestTime: number = 0;
  private minDelayMs: number;
  private requestCount: number = 0;
  private windowStartTime: number = Date.now();
  private readonly maxRequestsPerMinute: number = 30; // Conservative limit
  private readonly windowMs: number = 60000; // 1 minute

  constructor(minDelayMs: number = 2000) {
    this.minDelayMs = minDelayMs;
  }

  /**
   * Wait if necessary to respect rate limits
   * Ensures minimum delay between requests and max requests per minute
   */
  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const timeSinceWindowStart = now - this.windowStartTime;

    // Reset window if a minute has passed
    if (timeSinceWindowStart >= this.windowMs) {
      this.requestCount = 0;
      this.windowStartTime = now;
    }

    // Check if we've exceeded requests per minute
    if (this.requestCount >= this.maxRequestsPerMinute) {
      const waitTime = this.windowMs - timeSinceWindowStart;
      if (waitTime > 0) {
        console.log(`⏳ Rate limit: Waiting ${Math.ceil(waitTime / 1000)}s to reset request window...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        this.requestCount = 0;
        this.windowStartTime = Date.now();
      }
    }

    // Ensure minimum delay between requests
    if (timeSinceLastRequest < this.minDelayMs) {
      const waitTime = this.minDelayMs - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Update tracking
    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  /**
   * Get current request count in the current window
   */
  getRequestCount(): number {
    return this.requestCount;
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.lastRequestTime = 0;
    this.requestCount = 0;
    this.windowStartTime = Date.now();
  }
}

// Singleton instance for global rate limiting
let globalRateLimiter: YahooFinanceRateLimiter | null = null;

/**
 * Get the global rate limiter instance
 */
export function getGlobalRateLimiter(): YahooFinanceRateLimiter {
  if (!globalRateLimiter) {
    globalRateLimiter = new YahooFinanceRateLimiter(2000); // 2 seconds between requests
  }
  return globalRateLimiter;
}

