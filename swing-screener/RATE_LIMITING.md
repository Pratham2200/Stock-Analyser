# Yahoo Finance API Rate Limiting Implementation

## Overview

This document describes the rate limiting implementation for Yahoo Finance API calls to ensure compliance with API usage guidelines and prevent IP bans.

## Rate Limiting Strategy

### Conservative Approach
Since Yahoo Finance does not provide official rate limit documentation, we've implemented a **conservative rate limiting strategy** based on community observations:

- **Minimum delay between requests**: 2 seconds
- **Maximum requests per minute**: 30 requests
- **Exponential backoff**: For rate limit errors (HTTP 429)

### Implementation Details

#### 1. Global Rate Limiter (`src/utils/rateLimiter.ts`)
- Singleton pattern ensures all API calls share the same rate limiter
- Tracks request timestamps and counts
- Enforces minimum delay between requests
- Enforces maximum requests per minute (sliding window)

#### 2. StockDataService Integration
All Yahoo Finance API calls in `StockDataService` are protected:
- `fetchDailyBars()` - Fetches historical price data
- `fetchCurrentPrice()` - Fetches current stock price

**Rate limiting is enforced before each API call:**
```typescript
await this.rateLimiter.waitIfNeeded();
```

#### 3. Error Handling
- Detects rate limit errors (HTTP 429)
- Implements exponential backoff: 2s, 4s, 8s delays
- Maximum 3 retries before giving up
- Resets rate limiter window on retry

#### 4. PriceTrackingService
- Uses the same global rate limiter
- Logs rate limiter status every 10 requests
- All price tracking operations respect rate limits

## Rate Limiting Rules

### Request Frequency
- **Minimum delay**: 2 seconds between consecutive requests
- **Window size**: 60 seconds (1 minute)
- **Max requests per window**: 30 requests
- **If limit exceeded**: Wait until window resets

### Example Timeline
```
Request 1: 00:00
Request 2: 00:02 (2s delay)
Request 3: 00:04 (2s delay)
...
Request 30: 00:58 (2s delay)
Request 31: 01:00 (waits for window reset)
```

## Monitoring

The rate limiter logs:
- Request count in current window (every 10 requests)
- Rate limit errors with retry attempts
- Window resets when limit is reached

## Best Practices

1. **Always use StockDataService** for Yahoo Finance API calls
   - Don't call `yahoo-finance2` directly
   - StockDataService handles rate limiting automatically

2. **Batch Operations**
   - When processing multiple stocks, the rate limiter automatically spaces out requests
   - No need to add additional delays manually

3. **Error Handling**
   - Rate limit errors are automatically retried with exponential backoff
   - Failed requests after retries are logged and skipped gracefully

## Configuration

To adjust rate limiting (if needed), modify `src/utils/rateLimiter.ts`:

```typescript
constructor(minDelayMs: number = 2000) // Change default delay
private readonly maxRequestsPerMinute: number = 30; // Change max requests
```

**Note**: Be conservative with changes. Too aggressive rate limiting can lead to IP bans.

## Testing

The rate limiter has been tested to ensure:
- ✅ Minimum delays are enforced
- ✅ Maximum requests per minute are respected
- ✅ Window resets work correctly
- ✅ Exponential backoff functions properly

## Compliance

This implementation follows:
- Community best practices for Yahoo Finance API
- Conservative approach to prevent IP bans
- Proper error handling and retry logic
- Monitoring and logging for debugging

