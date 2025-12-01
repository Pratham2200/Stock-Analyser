/**
 * Rate limiter for Yahoo Finance API
 * Based on community observations:
 * - No official rate limits documented
 * - Too many requests can lead to IP bans
 * - Recommended: 1-2 seconds between requests
 * - Conservative approach: 2 seconds between requests (30 requests per minute max)
 */
export declare class YahooFinanceRateLimiter {
    private lastRequestTime;
    private minDelayMs;
    private requestCount;
    private windowStartTime;
    private readonly maxRequestsPerMinute;
    private readonly windowMs;
    constructor(minDelayMs?: number);
    /**
     * Wait if necessary to respect rate limits
     * Ensures minimum delay between requests and max requests per minute
     */
    waitIfNeeded(): Promise<void>;
    /**
     * Get current request count in the current window
     */
    getRequestCount(): number;
    /**
     * Reset the rate limiter
     */
    reset(): void;
}
/**
 * Get the global rate limiter instance
 */
export declare function getGlobalRateLimiter(): YahooFinanceRateLimiter;
//# sourceMappingURL=rateLimiter.d.ts.map