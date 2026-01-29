// src/services/TargetStoplossService.ts - Target and Stoploss calculation service

import { BaseService } from './BaseService';
import { DailyBar } from '../types/analysis';
import { EMA } from 'technicalindicators';

export interface TargetLevels {
    t1: number;  // 6% gain
    t2: number;  // 15% gain
    t3: number;  // 30% gain
}

export interface StoplossState {
    initialStoploss: number;
    currentStoploss: number;
    isAtCost: boolean;
    isTrailing: boolean;
    trailingEma4: number;
}

export interface PerformanceSummary {
    symbol: string;
    entryPrice: number;
    currentPrice: number;
    changePercent: number;
    highestPrice: number;
    lowestPrice: number;
    t1Reached: boolean;
    t2Reached: boolean;
    t3Reached: boolean;
    stoplossHit: boolean;
    stoplossLevel: number;
    status: 'active' | 'target_hit' | 'stoploss_hit';
    recommendation: string;
}

export class TargetStoplossService extends BaseService {
    // Target percentages
    private readonly T1_PERCENT = 6;   // First target at 6%
    private readonly T2_PERCENT = 15;  // Second target at 15%
    private readonly T3_PERCENT = 30;  // Third target at 30%

    // Stoploss rules
    private readonly MIN_STOPLOSS_PERCENT = 3;  // Minimum 3% stoploss
    private readonly MOVE_SL_TO_COST_PERCENT = 10;  // Move SL to cost at 10% gain
    private readonly START_TRAILING_PERCENT = 15;   // Start trailing at 15% gain

    constructor() {
        super('TargetStoplossService');
    }

    /**
     * Calculate target levels based on entry price
     * T1: 6% gain (partial exit 30-50%)
     * T2: 15% gain
     * T3: 30% gain
     */
    calculateTargets(entryPrice: number): TargetLevels {
        return {
            t1: entryPrice * (1 + this.T1_PERCENT / 100),
            t2: entryPrice * (1 + this.T2_PERCENT / 100),
            t3: entryPrice * (1 + this.T3_PERCENT / 100)
        };
    }

    /**
     * Calculate initial stoploss
     * Based on the swing low (bear squeeze candle low)
     * Minimum stoploss is 3%
     */
    calculateInitialStoploss(entryPrice: number, swingLow: number): number {
        // Calculate stoploss based on swing low
        const swingBasedSL = swingLow;

        // Calculate minimum 3% stoploss
        const minSL = entryPrice * (1 - this.MIN_STOPLOSS_PERCENT / 100);

        // Use the higher of the two (closer to entry price = less risk, but minimum 3%)
        // Actually we want the lower value to ensure at least 3% buffer
        const stoploss = Math.min(swingBasedSL, minSL);

        // But ensure at least 3% distance from entry
        const stoplossPercent = ((entryPrice - stoploss) / entryPrice) * 100;
        if (stoplossPercent < this.MIN_STOPLOSS_PERCENT) {
            return minSL;
        }

        return stoploss;
    }

    /**
     * Find the swing low from analysis details (bear squeeze candle low)
     * This is typically the low of the consolidation range or bear squeeze pattern
     */
    findSwingLow(dailyBars: DailyBar[], lookbackDays: number = 20): number {
        if (dailyBars.length === 0) {
            return 0;
        }

        // Get recent bars
        const recentBars = dailyBars.slice(-lookbackDays);

        // Find the lowest low in the recent period
        const swingLow = Math.min(...recentBars.map(bar => bar.low));

        return swingLow;
    }

    /**
     * Update trailing stoploss based on current gains
     * - At 10% gain: Move SL to cost (entry price)
     * - At 15% gain: Trail SL to 4EMA
     */
    updateTrailingStoploss(
        entryPrice: number,
        currentPrice: number,
        dailyBars: DailyBar[],
        currentStoploss: number
    ): StoplossState {
        const gainPercent = ((currentPrice - entryPrice) / entryPrice) * 100;

        // Calculate 4EMA
        const ema4 = this.calculate4EMA(dailyBars);

        let newStoploss = currentStoploss;
        let isAtCost = false;
        let isTrailing = false;

        if (gainPercent >= this.START_TRAILING_PERCENT) {
            // At 15%+ gain: Trail to 4EMA (but never lower than current SL)
            newStoploss = Math.max(currentStoploss, ema4);
            isTrailing = true;
            isAtCost = true; // Also at cost since we're above 10%
        } else if (gainPercent >= this.MOVE_SL_TO_COST_PERCENT) {
            // At 10%+ gain: Move SL to entry price (cost)
            newStoploss = Math.max(currentStoploss, entryPrice);
            isAtCost = true;
        }

        return {
            initialStoploss: currentStoploss,
            currentStoploss: newStoploss,
            isAtCost,
            isTrailing,
            trailingEma4: ema4
        };
    }

    /**
     * Calculate 4-period EMA for trailing stoploss
     */
    private calculate4EMA(bars: DailyBar[]): number {
        if (bars.length < 4) {
            return 0;
        }

        const closes = bars.map(bar => bar.close);
        const ema4Values = EMA.calculate({ values: closes, period: 4 });

        if (ema4Values.length === 0) {
            return 0;
        }

        return ema4Values[ema4Values.length - 1];
    }

    /**
     * Evaluate performance of a stock from entry to current
     * Checks if targets/stoploss were hit
     */
    evaluatePerformance(
        symbol: string,
        entryPrice: number,
        currentPrice: number,
        priceHistory: DailyBar[],
        initialStoploss: number
    ): PerformanceSummary {
        const targets = this.calculateTargets(entryPrice);

        // Get highest and lowest from price history
        const highestPrice = priceHistory.length > 0
            ? Math.max(...priceHistory.map(bar => bar.high))
            : currentPrice;
        const lowestPrice = priceHistory.length > 0
            ? Math.min(...priceHistory.map(bar => bar.low))
            : currentPrice;

        // Check if targets were reached
        const t1Reached = highestPrice >= targets.t1;
        const t2Reached = highestPrice >= targets.t2;
        const t3Reached = highestPrice >= targets.t3;

        // Check if stoploss was hit
        const stoplossHit = lowestPrice <= initialStoploss;

        // Calculate current change percent
        const changePercent = ((currentPrice - entryPrice) / entryPrice) * 100;

        // Determine current stoploss level (with trailing logic)
        const stoplossState = this.updateTrailingStoploss(
            entryPrice,
            currentPrice,
            priceHistory,
            initialStoploss
        );

        // Determine status
        let status: 'active' | 'target_hit' | 'stoploss_hit' = 'active';
        if (stoplossHit) {
            status = 'stoploss_hit';
        } else if (t3Reached) {
            status = 'target_hit';
        }

        // Generate recommendation
        let recommendation = '';
        if (stoplossHit) {
            recommendation = 'Stoploss hit - Position closed';
        } else if (t3Reached) {
            recommendation = 'T3 reached - Consider full exit';
        } else if (t2Reached) {
            recommendation = 'T2 reached - Consider partial exit, trail remaining';
        } else if (t1Reached) {
            recommendation = 'T1 reached - Book 30-50% profits at 6% gain';
        } else if (stoplossState.isTrailing) {
            recommendation = `Trailing SL to 4EMA at ₹${stoplossState.trailingEma4.toFixed(2)}`;
        } else if (stoplossState.isAtCost) {
            recommendation = 'SL moved to cost - Risk-free trade';
        } else {
            recommendation = 'Hold position - Targets pending';
        }

        return {
            symbol,
            entryPrice,
            currentPrice,
            changePercent,
            highestPrice,
            lowestPrice,
            t1Reached,
            t2Reached,
            t3Reached,
            stoplossHit,
            stoplossLevel: stoplossState.currentStoploss,
            status,
            recommendation
        };
    }

    /**
     * Get position sizing recommendation (placeholder for future)
     * Currently returns fixed values
     */
    getPositionSizing(_entryPrice: number, _stoploss: number): { quantity: number; value: number } {
        // Placeholder - to be implemented in next phase
        return {
            quantity: 100,
            value: 100 * 100 // placeholder
        };
    }
}
