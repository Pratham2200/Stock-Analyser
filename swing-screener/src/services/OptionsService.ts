// src/services/OptionsService.ts — Option chain processor with analytics

import { BaseService } from './BaseService';
import { NseDataService, NseOptionChain, CompiledOptionChain } from './NseDataService';
import { GreeksEngine, OptionGreeks, OptionInput } from './GreeksEngine';

// ── Types ────────────────────────────────────────────────────────

export interface OptionWithGreeks {
  strikePrice: number;
  expiryDate: string;
  optionType: 'CE' | 'PE';
  lastPrice: number;
  openInterest: number;
  changeInOI: number;
  volume: number;
  impliedVolatility: number;
  greeks: OptionGreeks;
  underlyingValue: number;
}

export interface OIAnalysis {
  symbol: string;
  totalCallOI: number;
  totalPutOI: number;
  pcrRatio: number;
  pcrTrend: 'bullish' | 'bearish' | 'neutral';
  maxCallOI: { strike: number; oi: number };
  maxPutOI: { strike: number; oi: number };
  maxCallOIChange: { strike: number; change: number };
  maxPutOIChange: { strike: number; change: number };
  supportLevel: number;   // Max Put OI strike
  resistanceLevel: number; // Max Call OI strike
}

// ── Service ──────────────────────────────────────────────────────

export class OptionsService extends BaseService {
  private nseData: NseDataService;
  private greeksEngine: GreeksEngine;

  constructor(nseData: NseDataService, greeksEngine?: GreeksEngine) {
    super('OptionsService');
    this.nseData = nseData;
    this.greeksEngine = greeksEngine || new GreeksEngine();
  }

  /**
   * Get full option chain with Greeks calculated for each strike
   */
  async getOptionChainWithGreeks(
    symbol: string,
    expiry?: string,
  ): Promise<{ chain: CompiledOptionChain; options: OptionWithGreeks[] }> {
    const chain = await this.nseData.compileOptionChain(symbol, expiry);
    const options: OptionWithGreeks[] = [];

    const daysToExpiry = this.calculateDaysToExpiry(chain.expiryDate);
    const timeToExpiry = Math.max(daysToExpiry / 365, 0.001); // Min 1 hour

    for (const row of chain.data) {
      for (const type of ['CE', 'PE'] as const) {
        const leg = row[type];
        if (!leg) continue;

        const iv = (leg.impliedVolatility || 15) / 100;

        const input: OptionInput = {
          spotPrice: chain.underlyingValue,
          strikePrice: row.strikePrice,
          timeToExpiry,
          riskFreeRate: GreeksEngine.DEFAULT_RISK_FREE_RATE,
          impliedVolatility: iv,
          optionType: type,
        };

        const greeks = this.greeksEngine.calculateGreeks(input);

        options.push({
          strikePrice: row.strikePrice,
          expiryDate: chain.expiryDate,
          optionType: type,
          lastPrice: leg.lastPrice,
          openInterest: leg.openInterest,
          changeInOI: leg.changeinOpenInterest,
          volume: leg.totalTradedVolume,
          impliedVolatility: leg.impliedVolatility,
          greeks,
          underlyingValue: chain.underlyingValue,
        });
      }
    }

    return { chain, options };
  }

  /**
   * Get Greeks for a specific contract
   */
  async getGreeksForContract(
    symbol: string,
    strike: number,
    optionType: 'CE' | 'PE',
    expiry?: string,
  ): Promise<OptionWithGreeks | null> {
    const { options } = await this.getOptionChainWithGreeks(symbol, expiry);
    return options.find(
      o => o.strikePrice === strike && o.optionType === optionType,
    ) || null;
  }

  /**
   * Get OI analysis for a symbol
   */
  async getOIAnalysis(symbol: string, expiry?: string): Promise<OIAnalysis> {
    const chain = await this.nseData.compileOptionChain(symbol, expiry);

    let maxCallOI = { strike: 0, oi: 0 };
    let maxPutOI = { strike: 0, oi: 0 };
    let maxCallOIChange = { strike: 0, change: 0 };
    let maxPutOIChange = { strike: 0, change: 0 };

    for (const row of chain.data) {
      const ceOI = row.CE?.openInterest ?? 0;
      const peOI = row.PE?.openInterest ?? 0;
      const ceChange = row.CE?.changeinOpenInterest ?? 0;
      const peChange = row.PE?.changeinOpenInterest ?? 0;

      if (ceOI > maxCallOI.oi) maxCallOI = { strike: row.strikePrice, oi: ceOI };
      if (peOI > maxPutOI.oi) maxPutOI = { strike: row.strikePrice, oi: peOI };
      if (ceChange > maxCallOIChange.change) maxCallOIChange = { strike: row.strikePrice, change: ceChange };
      if (peChange > maxPutOIChange.change) maxPutOIChange = { strike: row.strikePrice, change: peChange };
    }

    const pcrTrend: 'bullish' | 'bearish' | 'neutral' =
      chain.pcrRatio > 1.2 ? 'bullish' :
      chain.pcrRatio < 0.8 ? 'bearish' : 'neutral';

    return {
      symbol: symbol.toUpperCase(),
      totalCallOI: chain.totalCallOI,
      totalPutOI: chain.totalPutOI,
      pcrRatio: chain.pcrRatio,
      pcrTrend,
      maxCallOI,
      maxPutOI,
      maxCallOIChange,
      maxPutOIChange,
      supportLevel: maxPutOI.strike,
      resistanceLevel: maxCallOI.strike,
    };
  }

  /**
   * Predict option price at a target index level
   */
  async predictAtLevel(
    symbol: string,
    strike: number,
    optionType: 'CE' | 'PE',
    targetPrice: number,
    daysForward: number = 0,
    expiry?: string,
  ): Promise<any> {
    const contract = await this.getGreeksForContract(symbol, strike, optionType, expiry);
    if (!contract) throw new Error(`Contract not found: ${symbol} ${strike} ${optionType}`);

    const underlyingChange = targetPrice - contract.underlyingValue;
    const prediction = this.greeksEngine.predictOptionPrice(
      contract.lastPrice,
      contract.greeks,
      underlyingChange,
      daysForward,
    );

    prediction.targetUnderlyingPrice = targetPrice;

    return {
      contract: {
        symbol,
        strike,
        optionType,
        currentPrice: contract.lastPrice,
        currentSpot: contract.underlyingValue,
      },
      prediction,
      greeks: contract.greeks,
    };
  }

  /**
   * Find what level the index needs to reach for an option to hit a target price
   */
  async findLevelForTargetPrice(
    symbol: string,
    strike: number,
    optionType: 'CE' | 'PE',
    targetOptionPrice: number,
    expiry?: string,
  ): Promise<any> {
    const contract = await this.getGreeksForContract(symbol, strike, optionType, expiry);
    if (!contract) throw new Error(`Contract not found: ${symbol} ${strike} ${optionType}`);

    const daysToExpiry = this.calculateDaysToExpiry(contract.expiryDate);
    const iv = (contract.impliedVolatility || 15) / 100;

    const input: OptionInput = {
      spotPrice: contract.underlyingValue,
      strikePrice: strike,
      timeToExpiry: Math.max(daysToExpiry / 365, 0.001),
      riskFreeRate: GreeksEngine.DEFAULT_RISK_FREE_RATE,
      impliedVolatility: iv,
      optionType,
    };

    const result = this.greeksEngine.findRequiredLevel(
      input,
      contract.lastPrice,
      targetOptionPrice,
    );

    return {
      contract: {
        symbol,
        strike,
        optionType,
        currentPrice: contract.lastPrice,
        currentSpot: contract.underlyingValue,
      },
      target: {
        targetOptionPrice,
        requiredIndexLevel: result.requiredLevel,
        indexMoveRequired: Math.round((result.requiredLevel - contract.underlyingValue) * 100) / 100,
        indexMovePercent: Math.round(
          ((result.requiredLevel - contract.underlyingValue) / contract.underlyingValue) * 10000,
        ) / 100,
        converged: result.converged,
      },
    };
  }

  /**
   * Get max pain analysis
   */
  async getMaxPain(symbol: string, expiry?: string): Promise<any> {
    const chain = await this.nseData.fetchOptionChain(symbol, expiry);
    const expiryDate = expiry || chain.records.expiryDates[0] || '';
    const maxPain = this.nseData.calculateMaxPain(chain, expiryDate);

    return {
      symbol: symbol.toUpperCase(),
      ...maxPain,
      underlyingValue: chain.records.underlyingValue,
      distanceFromSpot: Math.round(
        (maxPain.maxPainStrike - chain.records.underlyingValue) * 100,
      ) / 100,
      distancePercent: Math.round(
        ((maxPain.maxPainStrike - chain.records.underlyingValue) /
          chain.records.underlyingValue) * 10000,
      ) / 100,
    };
  }

  // ── Helpers ──────────────────────────────────────────────────

  private calculateDaysToExpiry(expiryDateStr: string): number {
    const expiry = new Date(expiryDateStr);
    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();
    return Math.max(Math.ceil(diffMs / (1000 * 60 * 60 * 24)), 0);
  }
}
