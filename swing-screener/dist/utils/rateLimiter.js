"use strict";
// src/utils/rateLimiter.ts - Rate limiter for Yahoo Finance API
Object.defineProperty(exports, "__esModule", { value: true });
exports.YahooFinanceRateLimiter = void 0;
exports.getGlobalRateLimiter = getGlobalRateLimiter;
/**
 * Rate limiter for Yahoo Finance API
 * Based on community observations:
 * - No official rate limits documented
 * - Too many requests can lead to IP bans
 * - Recommended: 1-2 seconds between requests
 * - Conservative approach: 2 seconds between requests (30 requests per minute max)
 */
class YahooFinanceRateLimiter {
    constructor(minDelayMs = 2000) {
        this.lastRequestTime = 0;
        this.requestCount = 0;
        this.windowStartTime = Date.now();
        this.maxRequestsPerMinute = 30; // Conservative limit
        this.windowMs = 60000; // 1 minute
        this.minDelayMs = minDelayMs;
    }
    /**
     * Wait if necessary to respect rate limits
     * Ensures minimum delay between requests and max requests per minute
     */
    async waitIfNeeded() {
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
    getRequestCount() {
        return this.requestCount;
    }
    /**
     * Reset the rate limiter
     */
    reset() {
        this.lastRequestTime = 0;
        this.requestCount = 0;
        this.windowStartTime = Date.now();
    }
}
exports.YahooFinanceRateLimiter = YahooFinanceRateLimiter;
// Singleton instance for global rate limiting
let globalRateLimiter = null;
/**
 * Get the global rate limiter instance
 */
function getGlobalRateLimiter() {
    if (!globalRateLimiter) {
        globalRateLimiter = new YahooFinanceRateLimiter(2000); // 2 seconds between requests
    }
    return globalRateLimiter;
}
//# sourceMappingURL=rateLimiter.js.map