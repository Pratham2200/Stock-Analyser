// src/services/GreeksEngine.ts — Black-Scholes option pricing and Greeks calculator
// Pure math, zero external dependencies

import { BaseService } from './BaseService';

// ── Types ────────────────────────────────────────────────────────

export interface OptionGreeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  theoreticalPrice: number;
}

export interface OptionInput {
  spotPrice: number;        // Current underlying price
  strikePrice: number;      // Strike price
  timeToExpiry: number;     // Time to expiry in years (e.g., 7 days = 7/365)
  riskFreeRate: number;     // Risk-free rate (e.g., 0.065 for 6.5%)
  impliedVolatility: number; // IV as decimal (e.g., 0.20 for 20%)
  optionType: 'CE' | 'PE';  // Call or Put
}

export interface PricePrediction {
  targetUnderlyingPrice: number;
  predictedOptionPrice: number;
  deltaContribution: number;
  gammaContribution: number;
  thetaContribution: number;
  vegaContribution: number;
  totalPnL: number;
  totalPnLPercent: number;
}

export interface StrategyLeg {
  strikePrice: number;
  optionType: 'CE' | 'PE';
  action: 'BUY' | 'SELL';
  lots: number;
  lotSize: number;
  premium: number;           // Per unit premium
  impliedVolatility: number;
}

export interface StrategyPayoff {
  underlyingPrice: number;
  payoff: number;
  totalPnL: number;
}

export interface StrategyAnalysis {
  name: string;
  legs: StrategyLeg[];
  maxProfit: number;
  maxLoss: number;
  breakeven: number[];
  capitalRequired: number;
  riskRewardRatio: number;
  payoffData: StrategyPayoff[];
}

// ── Engine ───────────────────────────────────────────────────────

export class GreeksEngine extends BaseService {
  // India's risk-free rate (RBI repo rate approximate)
  static readonly DEFAULT_RISK_FREE_RATE = 0.065;

  constructor() {
    super('GreeksEngine');
  }

  // ── Black-Scholes Pricing ────────────────────────────────────

  /**
   * Calculate Black-Scholes option price and all Greeks
   */
  calculateGreeks(input: OptionInput): OptionGreeks {
    const { spotPrice, strikePrice, timeToExpiry, riskFreeRate, impliedVolatility, optionType } = input;

    // Handle edge case: at or past expiry
    if (timeToExpiry <= 0) {
      const intrinsic = optionType === 'CE'
        ? Math.max(spotPrice - strikePrice, 0)
        : Math.max(strikePrice - spotPrice, 0);

      return {
        delta: optionType === 'CE' ? (spotPrice > strikePrice ? 1 : 0) : (spotPrice < strikePrice ? -1 : 0),
        gamma: 0,
        theta: 0,
        vega: 0,
        rho: 0,
        theoreticalPrice: intrinsic,
      };
    }

    const S = spotPrice;
    const K = strikePrice;
    const T = timeToExpiry;
    const r = riskFreeRate;
    const sigma = impliedVolatility;

    const sqrtT = Math.sqrt(T);
    const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * sqrtT);
    const d2 = d1 - sigma * sqrtT;

    const nd1 = this.normalCDF(d1);
    const nd2 = this.normalCDF(d2);
    const nNegD1 = this.normalCDF(-d1);
    const nNegD2 = this.normalCDF(-d2);
    const npd1 = this.normalPDF(d1);

    const expRT = Math.exp(-r * T);

    if (optionType === 'CE') {
      return {
        delta: nd1,
        gamma: npd1 / (S * sigma * sqrtT),
        theta: (-(S * npd1 * sigma) / (2 * sqrtT) - r * K * expRT * nd2) / 365,
        vega: (S * npd1 * sqrtT) / 100, // Per 1% move in IV
        rho: (K * T * expRT * nd2) / 100,
        theoreticalPrice: S * nd1 - K * expRT * nd2,
      };
    } else {
      return {
        delta: nd1 - 1,
        gamma: npd1 / (S * sigma * sqrtT),
        theta: (-(S * npd1 * sigma) / (2 * sqrtT) + r * K * expRT * nNegD2) / 365,
        vega: (S * npd1 * sqrtT) / 100,
        rho: -(K * T * expRT * nNegD2) / 100,
        theoreticalPrice: K * expRT * nNegD2 - S * nNegD1,
      };
    }
  }

  // ── Price Prediction ─────────────────────────────────────────

  /**
   * Predict option price at a target underlying level
   * Uses Greeks for first-order approximation with gamma correction
   */
  predictOptionPrice(
    currentOptionPrice: number,
    greeks: OptionGreeks,
    underlyingChange: number,
    daysElapsed: number = 0,
    ivChange: number = 0, // Absolute change in IV (e.g., 0.02 for 2% increase)
  ): PricePrediction {
    const deltaContribution = greeks.delta * underlyingChange;
    const gammaContribution = 0.5 * greeks.gamma * underlyingChange * underlyingChange;
    const thetaContribution = greeks.theta * daysElapsed;
    const vegaContribution = greeks.vega * (ivChange * 100); // Vega is per 1% IV

    const predictedPrice = Math.max(
      0,
      currentOptionPrice + deltaContribution + gammaContribution + thetaContribution + vegaContribution,
    );

    const totalPnL = predictedPrice - currentOptionPrice;

    return {
      targetUnderlyingPrice: 0, // Caller should set this
      predictedOptionPrice: Math.round(predictedPrice * 100) / 100,
      deltaContribution: Math.round(deltaContribution * 100) / 100,
      gammaContribution: Math.round(gammaContribution * 100) / 100,
      thetaContribution: Math.round(thetaContribution * 100) / 100,
      vegaContribution: Math.round(vegaContribution * 100) / 100,
      totalPnL: Math.round(totalPnL * 100) / 100,
      totalPnLPercent: currentOptionPrice > 0
        ? Math.round((totalPnL / currentOptionPrice) * 10000) / 100
        : 0,
    };
  }

  /**
   * Find what index level is needed for option to reach target price
   * Uses iterative Newton-Raphson method
   */
  findRequiredLevel(
    input: OptionInput,
    currentOptionPrice: number,
    targetOptionPrice: number,
    maxIterations: number = 50,
  ): { requiredLevel: number; iterations: number; converged: boolean } {
    let spot = input.spotPrice;
    const tolerance = 0.01;

    for (let i = 0; i < maxIterations; i++) {
      const greeks = this.calculateGreeks({ ...input, spotPrice: spot });
      const priceDiff = greeks.theoreticalPrice - targetOptionPrice;

      if (Math.abs(priceDiff) < tolerance) {
        return { requiredLevel: Math.round(spot * 100) / 100, iterations: i + 1, converged: true };
      }

      // Newton-Raphson: spot = spot - f(spot) / f'(spot)
      if (Math.abs(greeks.delta) < 0.0001) break; // Avoid division by near-zero
      spot = spot - priceDiff / greeks.delta;

      // Safety bounds
      if (spot < 0) spot = input.spotPrice * 0.5;
      if (spot > input.spotPrice * 3) spot = input.spotPrice * 1.5;
    }

    return { requiredLevel: Math.round(spot * 100) / 100, iterations: maxIterations, converged: false };
  }

  // ── Strategy Simulation ──────────────────────────────────────

  /**
   * Simulate P&L of a multi-leg strategy across a price range
   */
  simulateStrategy(
    legs: StrategyLeg[],
    currentSpot: number,
    rangePercent: number = 10,
    steps: number = 50,
  ): StrategyAnalysis {
    const lowerBound = currentSpot * (1 - rangePercent / 100);
    const upperBound = currentSpot * (1 + rangePercent / 100);
    const stepSize = (upperBound - lowerBound) / steps;

    // Calculate net premium (cost of strategy)
    let netPremium = 0;
    for (const leg of legs) {
      const qty = leg.lots * leg.lotSize;
      if (leg.action === 'BUY') {
        netPremium -= leg.premium * qty; // Debit
      } else {
        netPremium += leg.premium * qty; // Credit
      }
    }

    const payoffData: StrategyPayoff[] = [];
    let maxProfit = -Infinity;
    let maxLoss = Infinity;

    for (let i = 0; i <= steps; i++) {
      const price = lowerBound + i * stepSize;
      let payoff = 0;

      for (const leg of legs) {
        const qty = leg.lots * leg.lotSize;
        let legPayoff: number;

        if (leg.optionType === 'CE') {
          legPayoff = Math.max(price - leg.strikePrice, 0);
        } else {
          legPayoff = Math.max(leg.strikePrice - price, 0);
        }

        if (leg.action === 'BUY') {
          payoff += (legPayoff - leg.premium) * qty;
        } else {
          payoff += (leg.premium - legPayoff) * qty;
        }
      }

      payoffData.push({
        underlyingPrice: Math.round(price * 100) / 100,
        payoff: Math.round(payoff * 100) / 100,
        totalPnL: Math.round(payoff * 100) / 100,
      });

      if (payoff > maxProfit) maxProfit = payoff;
      if (payoff < maxLoss) maxLoss = payoff;
    }

    // Find breakeven points
    const breakeven: number[] = [];
    for (let i = 1; i < payoffData.length; i++) {
      if (
        (payoffData[i - 1].payoff <= 0 && payoffData[i].payoff > 0) ||
        (payoffData[i - 1].payoff >= 0 && payoffData[i].payoff < 0)
      ) {
        // Linear interpolation
        const x1 = payoffData[i - 1].underlyingPrice;
        const x2 = payoffData[i].underlyingPrice;
        const y1 = payoffData[i - 1].payoff;
        const y2 = payoffData[i].payoff;
        const be = x1 + (0 - y1) * (x2 - x1) / (y2 - y1);
        breakeven.push(Math.round(be * 100) / 100);
      }
    }

    // Capital required (margin + premium paid)
    const capitalRequired = Math.abs(netPremium);
    const riskRewardRatio =
      maxLoss !== 0 ? Math.abs(maxProfit / maxLoss) : Infinity;

    return {
      name: this.identifyStrategy(legs),
      legs,
      maxProfit: Math.round(maxProfit * 100) / 100,
      maxLoss: Math.round(maxLoss * 100) / 100,
      breakeven,
      capitalRequired: Math.round(capitalRequired * 100) / 100,
      riskRewardRatio: Math.round(riskRewardRatio * 100) / 100,
      payoffData,
    };
  }

  /**
   * Identify strategy name from legs
   */
  private identifyStrategy(legs: StrategyLeg[]): string {
    const n = legs.length;
    if (n === 1) {
      return `Long ${legs[0].optionType === 'CE' ? 'Call' : 'Put'}`;
    }

    const buyCalls = legs.filter(l => l.action === 'BUY' && l.optionType === 'CE');
    const sellCalls = legs.filter(l => l.action === 'SELL' && l.optionType === 'CE');
    const buyPuts = legs.filter(l => l.action === 'BUY' && l.optionType === 'PE');
    const sellPuts = legs.filter(l => l.action === 'SELL' && l.optionType === 'PE');

    if (n === 2) {
      if (buyCalls.length === 1 && sellCalls.length === 1) {
        return buyCalls[0].strikePrice < sellCalls[0].strikePrice
          ? 'Bull Call Spread'
          : 'Bear Call Spread';
      }
      if (buyPuts.length === 1 && sellPuts.length === 1) {
        return buyPuts[0].strikePrice > sellPuts[0].strikePrice
          ? 'Bear Put Spread'
          : 'Bull Put Spread';
      }
      if (buyCalls.length === 1 && buyPuts.length === 1) {
        return buyCalls[0].strikePrice === buyPuts[0].strikePrice
          ? 'Long Straddle'
          : 'Long Strangle';
      }
      if (sellCalls.length === 1 && sellPuts.length === 1) {
        return sellCalls[0].strikePrice === sellPuts[0].strikePrice
          ? 'Short Straddle'
          : 'Short Strangle';
      }
    }

    if (n === 4) {
      if (sellCalls.length === 1 && buyCalls.length === 1 &&
          sellPuts.length === 1 && buyPuts.length === 1) {
        return 'Iron Condor';
      }
      if (buyCalls.length === 2 && sellCalls.length === 2) {
        return 'Call Butterfly';
      }
      if (buyPuts.length === 2 && sellPuts.length === 2) {
        return 'Put Butterfly';
      }
    }

    return `Custom Strategy (${n} legs)`;
  }

  // ── Implied Volatility ───────────────────────────────────────

  /**
   * Calculate implied volatility from market price using bisection method
   */
  calculateIV(
    marketPrice: number,
    spotPrice: number,
    strikePrice: number,
    timeToExpiry: number,
    riskFreeRate: number,
    optionType: 'CE' | 'PE',
    tolerance: number = 0.0001,
    maxIterations: number = 100,
  ): number {
    let low = 0.01;
    let high = 5.0; // 500% IV max

    for (let i = 0; i < maxIterations; i++) {
      const mid = (low + high) / 2;
      const price = this.calculateGreeks({
        spotPrice,
        strikePrice,
        timeToExpiry,
        riskFreeRate,
        impliedVolatility: mid,
        optionType,
      }).theoreticalPrice;

      if (Math.abs(price - marketPrice) < tolerance) {
        return Math.round(mid * 10000) / 10000;
      }

      if (price > marketPrice) {
        high = mid;
      } else {
        low = mid;
      }
    }

    return Math.round(((low + high) / 2) * 10000) / 10000;
  }

  // ── Math Helpers ─────────────────────────────────────────────

  /**
   * Standard normal CDF (cumulative distribution function)
   * Abramowitz and Stegun approximation
   */
  private normalCDF(x: number): number {
    if (x < -10) return 0;
    if (x > 10) return 1;

    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    const absX = Math.abs(x);

    const t = 1.0 / (1.0 + p * absX);
    const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX / 2);

    return 0.5 * (1.0 + sign * y);
  }

  /**
   * Standard normal PDF (probability density function)
   */
  private normalPDF(x: number): number {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  }
}
