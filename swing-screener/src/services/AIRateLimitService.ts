// src/services/AIRateLimitService.ts
// Persistent DB-backed rate limiting for AI providers.
// All state lives in `ai_rate_limits` so it survives process restarts.

import { Pool } from 'pg';
import { Logger } from '../utils/logger-enhanced';

export type AIProvider = 'gemini' | 'groq' | 'openrouter';

interface RateLimitRow {
    id: number;
    provider: AIProvider;
    blocked_until: Date | null;
    last_429_at: Date | null;
    daily_quota_resets_at: Date | null;
    daily_requests_used: number;
    daily_tokens_used: number;
    consecutive_429s: number;
    notes: string | null;
    updated_at: Date;
}

export class AIRateLimitService {
    private pool: Pool;
    private logger: Logger;

    // Local in-process cache to avoid DB round-trips on every call.
    // Gets invalidated whenever we write to the DB.
    private cache: Map<AIProvider, { row: RateLimitRow; cachedAt: number }> = new Map();
    private readonly CACHE_TTL_MS = 5_000; // 5 seconds

    constructor(pool: Pool) {
        this.pool = pool;
        this.logger = new Logger('AIRateLimitService');
    }

    // ---------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------

    /**
     * Returns true if the provider is currently rate-limited and requests
     * should be skipped.
     */
    async isBlocked(provider: AIProvider): Promise<boolean> {
        const row = await this.getRow(provider);
        if (!row.blocked_until) return false;
        const now = new Date();
        if (row.blocked_until > now) {
            const secsLeft = Math.ceil((row.blocked_until.getTime() - now.getTime()) / 1000);
            this.logger.warn(`🚫 ${provider} is rate-limited — blocked for ${secsLeft}s more`);
            return true;
        }
        // Block window has expired — clear it
        await this.clearBlock(provider);
        return false;
    }

    /**
     * Call this when a provider responds with a 429.
     * `retryAfterSeconds` is taken from the API's Retry-After header when available.
     */
    async record429(provider: AIProvider, retryAfterSeconds?: number): Promise<void> {
        const row = await this.getRow(provider);
        const now = new Date();

        // Determine how long to block:
        // 1. Use the explicit Retry-After value if given
        // 2. Otherwise use exponential back-off: min(2^consecutive * 60s, 24h)
        let blockSeconds: number;
        if (retryAfterSeconds && retryAfterSeconds > 0) {
            blockSeconds = retryAfterSeconds;
        } else {
            const consecutive = (row.consecutive_429s ?? 0) + 1;
            blockSeconds = Math.min(Math.pow(2, consecutive) * 60, 86_400); // cap at 24 h
        }

        const blockedUntil = new Date(now.getTime() + blockSeconds * 1_000);

        await this.pool.query(
            `UPDATE ai_rate_limits
             SET blocked_until        = $1,
                 last_429_at          = $2,
                 consecutive_429s     = consecutive_429s + 1,
                 daily_requests_used  = daily_requests_used + 1,
                 updated_at           = CURRENT_TIMESTAMP
             WHERE provider = $3`,
            [blockedUntil, now, provider]
        );

        this.cache.delete(provider); // invalidate cache

        this.logger.warn(
            `⛔ Recorded 429 for ${provider}. Blocked until ${blockedUntil.toISOString()} (${blockSeconds}s)`
        );
    }

    /**
     * Call this on every SUCCESSFUL response — resets consecutive 429 counter
     * and increments usage counters.
     */
    async recordSuccess(provider: AIProvider, tokensUsed = 0): Promise<void> {
        await this.pool.query(
            `UPDATE ai_rate_limits
             SET consecutive_429s     = 0,
                 daily_requests_used  = daily_requests_used + 1,
                 daily_tokens_used    = daily_tokens_used + $1,
                 updated_at           = CURRENT_TIMESTAMP
             WHERE provider = $2`,
            [tokensUsed, provider]
        );
        this.cache.delete(provider);
    }

    /**
     * Returns a human-readable status summary (useful for logging at scan start).
     */
    async getSummary(): Promise<Record<AIProvider, { blocked: boolean; blockedUntil: Date | null; requests: number; tokens: number }>> {
        const result = await this.pool.query<RateLimitRow>(
            `SELECT * FROM ai_rate_limits ORDER BY provider`
        );
        const now = new Date();
        const summary: any = {};
        for (const row of result.rows) {
            summary[row.provider] = {
                blocked: !!(row.blocked_until && row.blocked_until > now),
                blockedUntil: row.blocked_until,
                requests: row.daily_requests_used,
                tokens: row.daily_tokens_used,
            };
        }
        return summary;
    }

    /**
     * Manually unblock a provider (e.g. admin action or after daily reset).
     */
    async unblock(provider: AIProvider): Promise<void> {
        await this.clearBlock(provider);
        this.logger.info(`✅ ${provider} manually unblocked`);
    }

    /**
     * Reset daily counters for all providers (intended to be called once per day).
     */
    async resetDailyCounters(): Promise<void> {
        await this.pool.query(
            `UPDATE ai_rate_limits
             SET daily_requests_used  = 0,
                 daily_tokens_used    = 0,
                 daily_quota_resets_at = CURRENT_TIMESTAMP,
                 updated_at           = CURRENT_TIMESTAMP`
        );
        this.cache.clear();
        this.logger.info('🔄 Daily AI rate-limit counters reset for all providers');
    }

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------

    private async clearBlock(provider: AIProvider): Promise<void> {
        await this.pool.query(
            `UPDATE ai_rate_limits
             SET blocked_until    = NULL,
                 consecutive_429s = 0,
                 updated_at       = CURRENT_TIMESTAMP
             WHERE provider = $1`,
            [provider]
        );
        this.cache.delete(provider);
    }

    private async getRow(provider: AIProvider, depth = 0): Promise<RateLimitRow> {
        // Serve from cache if fresh
        const cached = this.cache.get(provider);
        if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL_MS) {
            return cached.row;
        }

        const result = await this.pool.query<RateLimitRow>(
            `SELECT * FROM ai_rate_limits WHERE provider = $1`,
            [provider]
        );

        if (!result.rows.length) {
            if (depth > 0) {
                throw new Error(`ai_rate_limits row for provider "${provider}" could not be created`);
            }
            // Row missing — insert it (idempotent)
            await this.pool.query(
                `INSERT INTO ai_rate_limits (provider) VALUES ($1) ON CONFLICT (provider) DO NOTHING`,
                [provider]
            );
            return this.getRow(provider, 1); // Retry once only
        }

        const row = result.rows[0];
        this.cache.set(provider, { row, cachedAt: Date.now() });
        return row;
    }
}
