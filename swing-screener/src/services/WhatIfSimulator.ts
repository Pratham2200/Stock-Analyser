// src/services/WhatIfSimulator.ts — Interactive options strategy simulator

import { BaseService } from './BaseService';
import { GreeksEngine, StrategyLeg, OptionInput } from './GreeksEngine';
import { NseDataService } from './NseDataService';

export interface SimulationParams {
  symbol: string;
  legs: StrategyLeg[];
  currentSpot: number;
  targetDate: string; // ISO date string
  targetIVChangePercent: number; // e.g., 5 for +5% IV, -2 for -2% IV
  priceRangePercent: number; // e.g., 10 for +/- 10%
  steps: number;
}

export interface SimulationResult {
  symbol: string;
  targetDate: string;
  daysToTarget: string;
  ivChangeApplied: number;
  maxProfit: number;
  maxLoss: number;
  breakeven: number[];
  capitalRequired: number;
  riskRewardRatio: number;
  netPremium: number;
  payoffData: {
    underlyingPrice: number;
    payoff: number;         // Intrinsic payoff at expiry
    simulatedPnL: number;   // Simulated PnL at target date/IV
  }[];
}

export class WhatIfSimulator extends BaseService {
  private greeksEngine: GreeksEngine;
  private nseData: NseDataService;

  constructor(greeksEngine: GreeksEngine, nseData: NseDataService) {
    super('WhatIfSimulator');
    this.greeksEngine = greeksEngine;
    this.nseData = nseData;
  }

  /**
   * Simulate a strategy at a future date with adjusted IV
   */
  async simulateStrategy(params: SimulationParams): Promise<SimulationResult> {
    const { symbol, legs, currentSpot, targetDate, targetIVChangePercent, priceRangePercent, steps } = params;

    // Input validation
    if (!legs || legs.length === 0) throw new Error('At least one strategy leg is required');
    if (steps <= 0) throw new Error('Steps must be a positive integer');
    if (priceRangePercent <= 0 || priceRangePercent > 100) throw new Error('priceRangePercent must be between 1 and 100');
    if (currentSpot <= 0) throw new Error('currentSpot must be positive');

    // Calculate days to target date
    const now = new Date();
    const target = new Date(targetDate);
    const daysToTarget = Math.max(0, (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const targetDateStr = target.toISOString().split('T')[0];

    // Get current lot size for capital calculation
    let lotSize = 50;
    try {
      const lots = await this.nseData.fetchFnoLots();
      lotSize = lots[symbol.toUpperCase()] || 50;
    } catch { /* use default */ }

    // Normalize legs with true lot size
    const normalizedLegs = legs.map(l => ({ ...l, lotSize: l.lotSize || lotSize }));

    // Standard expiry payoff analysis via GreeksEngine
    const standardAnalysis = this.greeksEngine.simulateStrategy(
      normalizedLegs,
      currentSpot,
      priceRangePercent,
      steps
    );

    // Calculate net premium
    let netPremium = 0;
    for (const leg of normalizedLegs) {
      const value = leg.premium * leg.lots * leg.lotSize;
      if (leg.action === 'BUY') netPremium -= value;
      else netPremium += value;
    }

    // Now calculate simulated PnL at the target date using Black-Scholes
    // For each price step, re-price every option leg using modified T and IV
    const payoffData = standardAnalysis.payoffData.map(point => {
      const simulatedPrice = point.underlyingPrice;
      let simulatedTotalPnL = 0;

      for (const leg of normalizedLegs) {
        // Calculate real time-to-expiry from the leg's expiry date
        // If leg has no expiryDate, estimate from the target date + 7 days buffer
        let legExpiryMs: number;
        if ((leg as any).expiryDate) {
          legExpiryMs = new Date((leg as any).expiryDate).getTime();
        } else {
          // Fallback: assume expiry is the nearest monthly expiry (~last Thursday)
          // Use target date + 7 days as a reasonable estimate
          legExpiryMs = target.getTime() + (7 * 24 * 60 * 60 * 1000);
        }

        const totalDaysToExpiry = Math.max(0.5, (legExpiryMs - now.getTime()) / (1000 * 60 * 60 * 24));
        const baseTimeToExpiry = totalDaysToExpiry / 365;
        const newTimeToExpiry = Math.max(0.001, baseTimeToExpiry - (daysToTarget / 365));

        // Adjust IV
        const currentIV = leg.impliedVolatility || 0.15;
        const newIV = Math.max(0.01, currentIV + (targetIVChangePercent / 100));

        const greeksInput: OptionInput = {
          spotPrice: simulatedPrice,
          strikePrice: leg.strikePrice,
          timeToExpiry: newTimeToExpiry,
          riskFreeRate: GreeksEngine.DEFAULT_RISK_FREE_RATE,
          impliedVolatility: newIV,
          optionType: leg.optionType,
        };

        const newGreeks = this.greeksEngine.calculateGreeks(greeksInput);
        const newPremium = newGreeks.theoreticalPrice;
        
        const qty = leg.lots * leg.lotSize;
        if (leg.action === 'BUY') {
          simulatedTotalPnL += (newPremium - leg.premium) * qty;
        } else {
          simulatedTotalPnL += (leg.premium - newPremium) * qty;
        }
      }

      return {
        underlyingPrice: simulatedPrice,
        payoff: point.payoff,
        simulatedPnL: Math.round(simulatedTotalPnL * 100) / 100
      };
    });

    return {
      symbol: symbol.toUpperCase(),
      targetDate: targetDateStr,
      daysToTarget: daysToTarget.toFixed(1),
      ivChangeApplied: targetIVChangePercent,
      maxProfit: standardAnalysis.maxProfit,
      maxLoss: standardAnalysis.maxLoss,
      breakeven: standardAnalysis.breakeven,
      capitalRequired: standardAnalysis.capitalRequired,
      riskRewardRatio: standardAnalysis.riskRewardRatio,
      netPremium: Math.round(netPremium * 100) / 100,
      payoffData
    };
  }
}
