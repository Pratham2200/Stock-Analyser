// src/services/MarketDataService.ts - Market data fetching using Puppeteer browser

import { BaseService } from './BaseService';
import { DailyBar } from '../types/analysis';
import { EMA } from 'technicalindicators';
import { YahooBrowserService, QuoteData, ChartResult } from './YahooBrowserService';

export { QuoteData, ChartResult } from './YahooBrowserService';

export class MarketDataService extends BaseService {
    private yahooBrowser: YahooBrowserService;

    constructor() {
        super('MarketDataService');
        this.yahooBrowser = new YahooBrowserService();

        // Pre-initialize the browser
        this.yahooBrowser.initialize().catch(err => {
            this.logger.error('Failed to pre-initialize Yahoo browser:', err);
        });
    }

    /**
     * Fetch daily bars AND quote data in a single API call (most efficient)
     */
    async fetchDailyBarsWithQuote(symbol: string, days: number = 120): Promise<ChartResult> {
        return await this.yahooBrowser.fetchDailyBarsWithQuote(symbol, days);
    }

    /**
     * Fetch daily OHLCV bars only
     */
    async fetchDailyBars(symbol: string, days: number = 120): Promise<{ bars: DailyBar[]; chartMeta?: any }> {
        return await this.yahooBrowser.fetchDailyBars(symbol, days);
    }

    /**
     * Fetch current quote
     */
    async fetchCurrentQuote(symbol: string): Promise<QuoteData | null> {
        return await this.yahooBrowser.fetchCurrentQuote(symbol);
    }

    /**
     * Fetch price history from a specific date
     */
    async fetchPriceHistoryFromDate(symbol: string, fromDate: Date): Promise<DailyBar[]> {
        const daysSinceStart = Math.ceil((Date.now() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
        const { bars } = await this.fetchDailyBars(symbol, Math.max(daysSinceStart + 30, 120));

        const fromDateStr = fromDate.toISOString().split('T')[0];
        return bars.filter(bar => bar.date >= fromDateStr);
    }

    /**
     * Fetch current price for a symbol
     */
    async fetchCurrentPrice(symbol: string): Promise<number> {
        const quote = await this.fetchCurrentQuote(symbol);
        return quote?.price || 0;
    }

    /**
     * Calculate EMAs from price data
     */
    calculateEMAs(bars: DailyBar[], period: number): number[] {
        const closes = bars.map(bar => bar.close);
        const emaValues = EMA.calculate({ period, values: closes });
        const padding = new Array(period - 1).fill(null as any);
        return [...padding, ...emaValues];
    }

    /**
     * Calculate volume statistics
     */
    calculateVolumeStats(bars: DailyBar[], lookback: number = 20): { averages: number[]; ratios: number[] } {
        const averages: number[] = [];
        const ratios: number[] = [];

        for (let i = 0; i < bars.length; i++) {
            if (i < lookback - 1) {
                averages.push(null as any);
                ratios.push(null as any);
            } else {
                const windowStart = i - lookback + 1;
                const volumeWindow = bars.slice(windowStart, i + 1).map(b => b.volume);
                const avg = volumeWindow.reduce((a, b) => a + b, 0) / lookback;
                averages.push(avg);
                ratios.push(avg > 0 ? bars[i].volume / avg : null as any);
            }
        }

        return { averages, ratios };
    }

    /**
     * Close the browser when done
     */
    async shutdown(): Promise<void> {
        await this.yahooBrowser.close();
    }
}
