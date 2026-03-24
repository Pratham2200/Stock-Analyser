// src/services/NseSessionService.ts — Cookie + Rate Limit manager for NSE India
// Reference: https://github.com/BennyThadikaran/NseIndiaApi

import { BaseService } from './BaseService';

interface NseCookie {
  name: string;
  value: string;
  expires?: number;
}

export class NseSessionService extends BaseService {
  private static readonly BASE_URL = 'https://www.nseindia.com';
  private static readonly API_URL = 'https://www.nseindia.com/api';
  private static readonly ARCHIVE_URL = 'https://nsearchives.nseindia.com';

  private static readonly USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/118.0';

  private static readonly HEADERS: Record<string, string> = {
    'User-Agent': NseSessionService.USER_AGENT,
    Accept: '*/*',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    Referer: 'https://www.nseindia.com/get-quotes/equity?symbol=HDFCBANK',
  };

  // Cookie page — NseIndiaApi uses /option-chain to grab cookies
  private static readonly COOKIE_URL = 'https://www.nseindia.com/option-chain';

  // Rate limiting
  private readonly rateLimitMs: number;
  private lastRequestTime = 0;

  // Session cookies
  private cookies: Map<string, string> = new Map();
  private cookiesExpireAt = 0;
  private sessionInitialized = false;
  private initPromise: Promise<void> | null = null;

  // Retry config
  private static readonly MAX_RETRIES = 2;
  private static readonly TIMEOUT_MS = 15000;

  constructor(rateLimitMs?: number) {
    super('NseSessionService');
    // Default: 350ms = ~3 requests per second (matching NSE's tolerance)
    this.rateLimitMs = rateLimitMs ?? parseInt(process.env.NSE_RATE_LIMIT_MS || '350', 10);
  }

  /**
   * Get base API URL
   */
  get apiUrl(): string {
    return NseSessionService.API_URL;
  }

  /**
   * Get archive URL
   */
  get archiveUrl(): string {
    return NseSessionService.ARCHIVE_URL;
  }

  /**
   * Initialize session by visiting the NSE website to get cookies.
   * Safe to call multiple times — will only initialize once.
   */
  async initSession(): Promise<void> {
    if (this.sessionInitialized && !this.hasCookiesExpired()) {
      return;
    }

    // Prevent concurrent initialization
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._doInitSession();

    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  private async _doInitSession(): Promise<void> {
    this.logger.info('Initializing NSE session (fetching cookies)...');

    try {
      const response = await fetch(NseSessionService.COOKIE_URL, {
        headers: NseSessionService.HEADERS,
        redirect: 'follow',
      });

      if (!response.ok) {
        throw new Error(`NSE session init failed: ${response.status} ${response.statusText}`);
      }

      // Extract cookies from Set-Cookie headers
      const setCookieHeaders = response.headers.getSetCookie?.() || [];
      this.parseCookies(setCookieHeaders);

      // Cookies typically expire in ~5 minutes; refresh slightly earlier
      this.cookiesExpireAt = Date.now() + 4 * 60 * 1000; // 4 minutes
      this.sessionInitialized = true;

      this.logger.info(
        `NSE session initialized (${this.cookies.size} cookies, expires in ~4min)`,
      );
    } catch (error) {
      this.sessionInitialized = false;
      this.logger.error('Failed to initialize NSE session:', error);
      throw error;
    }
  }

  /**
   * Parse Set-Cookie headers into our cookie map
   */
  private parseCookies(setCookieHeaders: string[]): void {
    this.cookies.clear();

    for (const header of setCookieHeaders) {
      const parts = header.split(';')[0]; // Take only name=value
      const eqIdx = parts.indexOf('=');

      if (eqIdx > 0) {
        const name = parts.substring(0, eqIdx).trim();
        const value = parts.substring(eqIdx + 1).trim();
        this.cookies.set(name, value);
      }
    }
  }

  /**
   * Build cookie header string from stored cookies
   */
  private getCookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  /**
   * Check if cookies have expired
   */
  private hasCookiesExpired(): boolean {
    return Date.now() >= this.cookiesExpireAt;
  }

  /**
   * Rate limiting — waits until enough time has passed since last request
   */
  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < this.rateLimitMs) {
      const waitTime = this.rateLimitMs - elapsed;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Make an authenticated request to NSE
   * Handles: rate limiting, cookie refresh, retries on 403
   */
  async request<T = any>(url: string, params?: Record<string, string>): Promise<T> {
    // Ensure session is initialized
    await this.initSession();

    // Build URL with query params
    let fullUrl = url;
    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams(params);
      fullUrl = `${url}?${searchParams.toString()}`;
    }

    for (let attempt = 0; attempt <= NseSessionService.MAX_RETRIES; attempt++) {
      // Rate limit
      await this.throttle();

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          NseSessionService.TIMEOUT_MS,
        );

        const response = await fetch(fullUrl, {
          headers: {
            ...NseSessionService.HEADERS,
            Cookie: this.getCookieHeader(),
          },
          signal: controller.signal,
          redirect: 'follow',
        });

        clearTimeout(timeoutId);

        // Cookie expired — refresh and retry
        if (response.status === 401 || response.status === 403) {
          this.logger.warn(
            `NSE returned ${response.status} — refreshing session (attempt ${attempt + 1}/${NseSessionService.MAX_RETRIES + 1})`,
          );
          this.sessionInitialized = false;
          await this.initSession();
          continue;
        }

        if (!response.ok) {
          throw new Error(`NSE API error: ${response.status} ${response.statusText} for ${url}`);
        }

        // Check content type — NSE sometimes returns HTML error pages
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
          throw new Error('NSE returned HTML instead of JSON — data may be unavailable');
        }

        const data = await response.json();
        return data as T;
      } catch (error: any) {
        if (error.name === 'AbortError') {
          throw new TimeoutError(`NSE request timed out: ${url}`);
        }

        // On last attempt, throw
        if (attempt === NseSessionService.MAX_RETRIES) {
          throw error;
        }

        this.logger.warn(
          `NSE request failed (attempt ${attempt + 1}): ${error.message}`,
        );
      }
    }

    // Should never reach here, but TypeScript needs it
    throw new Error(`NSE request failed after ${NseSessionService.MAX_RETRIES + 1} attempts`);
  }

  /**
   * Make a raw request (for CSV/binary content like FnO lots)
   */
  async requestRaw(url: string): Promise<string> {
    await this.initSession();
    await this.throttle();

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      NseSessionService.TIMEOUT_MS,
    );

    const response = await fetch(url, {
      headers: {
        ...NseSessionService.HEADERS,
        Cookie: this.getCookieHeader(),
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`NSE raw request failed: ${response.status} for ${url}`);
    }

    return response.text();
  }

  /**
   * Check if the service is healthy (has valid session)
   */
  isHealthy(): boolean {
    return this.sessionInitialized && !this.hasCookiesExpired();
  }

  /**
   * Force a session refresh
   */
  async refreshSession(): Promise<void> {
    this.sessionInitialized = false;
    await this.initSession();
  }
}

/**
 * Custom timeout error
 */
class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}
