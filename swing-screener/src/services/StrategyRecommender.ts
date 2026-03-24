// src/services/StrategyRecommender.ts — AI-powered options strategy engine

import { BaseService } from './BaseService';
import { OptionsService, OIAnalysis } from './OptionsService';
import { GreeksEngine, StrategyLeg, StrategyAnalysis } from './GreeksEngine';
import { NseDataService, CompiledOptionChain, FnoLotSizes } from './NseDataService';

// ── Types ────────────────────────────────────────────────────────

export interface StrategyRecommendation {
  rank: number;
  name: string;
  type: 'bullish' | 'bearish' | 'neutral' | 'volatile';
  description: string;
  legs: StrategyLeg[];
  analysis: StrategyAnalysis;
  suitability: string;
}

export interface MarketContext {
  symbol: string;
  spotPrice: number;
  trend: 'bullish' | 'bearish' | 'sideways';
  pcrRatio: number;
  ivLevel: 'low' | 'medium' | 'high';
  maxPain: number;
  support: number;
  resistance: number;
  daysToExpiry: number;
}

// ── Service ──────────────────────────────────────────────────────

export class StrategyRecommender extends BaseService {
  private optionsService: OptionsService;
  private greeksEngine: GreeksEngine;
  private nseData: NseDataService;

  constructor(
    optionsService: OptionsService,
    greeksEngine: GreeksEngine,
    nseData: NseDataService,
  ) {
    super('StrategyRecommender');
    this.optionsService = optionsService;
    this.greeksEngine = greeksEngine;
    this.nseData = nseData;
  }

  /**
   * Get AI-recommended strategies for a symbol
   */
  async recommendStrategies(
    symbol: string,
    capitalAvailable: number = 100000,
    riskTolerance: 'low' | 'medium' | 'high' = 'medium',
  ): Promise<{
    context: MarketContext;
    recommendations: StrategyRecommendation[];
  }> {
    // 1. Gather market context
    const context = await this.buildMarketContext(symbol);

    // 2. Get lot size
    let lotSize = 50; // Default Nifty
    try {
      const lots = await this.nseData.fetchFnoLots();
      lotSize = lots[symbol.toUpperCase()] || 50;
    } catch { /* use default */ }

    // 3. Get compiled chain for ATM/OTM strikes
    const chain = await this.nseData.compileOptionChain(symbol);

    // 4. Generate candidate strategies based on context
    const candidates = this.generateCandidates(context, chain, lotSize, capitalAvailable);

    // 5. Filter by risk tolerance and capital
    const filtered = candidates.filter(s => {
      if (riskTolerance === 'low' && Math.abs(s.analysis.maxLoss) > capitalAvailable * 0.05) return false;
      if (riskTolerance === 'medium' && Math.abs(s.analysis.maxLoss) > capitalAvailable * 0.15) return false;
      return s.analysis.capitalRequired <= capitalAvailable;
    });

    // 6. Rank by risk-reward ratio
    const ranked = filtered
      .sort((a, b) => b.analysis.riskRewardRatio - a.analysis.riskRewardRatio)
      .slice(0, 5)
      .map((s, i) => ({ ...s, rank: i + 1 }));

    return { context, recommendations: ranked };
  }

  /**
   * Build market context from current data
   */
  private async buildMarketContext(symbol: string): Promise<MarketContext> {
    const oiAnalysis = await this.optionsService.getOIAnalysis(symbol);
    const chain = await this.nseData.compileOptionChain(symbol);
    const maxPainResult = await this.optionsService.getMaxPain(symbol);

    // Determine trend from PCR
    let trend: 'bullish' | 'bearish' | 'sideways' = 'sideways';
    if (oiAnalysis.pcrRatio > 1.2) trend = 'bullish';
    else if (oiAnalysis.pcrRatio < 0.7) trend = 'bearish';

    // Determine IV level from ATM options
    const atmOptions = chain.data.filter(
      d => Math.abs(d.strikePrice - chain.underlyingValue) < chain.underlyingValue * 0.01,
    );
    let avgIV = 15;
    if (atmOptions.length > 0) {
      const ivs = atmOptions
        .map(d => d.CE?.impliedVolatility ?? d.PE?.impliedVolatility ?? 0)
        .filter(iv => iv > 0);
      avgIV = ivs.length > 0 ? ivs.reduce((a, b) => a + b, 0) / ivs.length : 15;
    }

    const ivLevel: 'low' | 'medium' | 'high' =
      avgIV < 12 ? 'low' : avgIV > 20 ? 'high' : 'medium';

    const daysToExpiry = this.daysToExpiry(chain.expiryDate);

    return {
      symbol: symbol.toUpperCase(),
      spotPrice: chain.underlyingValue,
      trend,
      pcrRatio: oiAnalysis.pcrRatio,
      ivLevel,
      maxPain: maxPainResult.maxPainStrike,
      support: oiAnalysis.supportLevel,
      resistance: oiAnalysis.resistanceLevel,
      daysToExpiry,
    };
  }

  /**
   * Generate candidate strategies based on market context
   */
  private generateCandidates(
    ctx: MarketContext,
    chain: CompiledOptionChain,
    lotSize: number,
    capital: number,
  ): StrategyRecommendation[] {
    const candidates: StrategyRecommendation[] = [];
    const spot = ctx.spotPrice;

    // Find ATM and nearby strikes
    const atm = chain.atmStrike;
    const otm1CE = this.findStrike(chain.data.map(d => d.strikePrice), atm, 1, 'up');
    const otm2CE = this.findStrike(chain.data.map(d => d.strikePrice), atm, 2, 'up');
    const otm1PE = this.findStrike(chain.data.map(d => d.strikePrice), atm, 1, 'down');
    const otm2PE = this.findStrike(chain.data.map(d => d.strikePrice), atm, 2, 'down');

    // Get premiums from chain data
    const getPremium = (strike: number, type: 'CE' | 'PE'): number => {
      const row = chain.data.find(d => d.strikePrice === strike);
      return row?.[type]?.lastPrice ?? 0;
    };

    const getIV = (strike: number, type: 'CE' | 'PE'): number => {
      const row = chain.data.find(d => d.strikePrice === strike);
      return (row?.[type]?.impliedVolatility ?? 15) / 100;
    };

    // ── Bullish Strategies ─────────────────────────────────

    // Bull Call Spread
    if (ctx.trend === 'bullish' || ctx.trend === 'sideways') {
      const legs: StrategyLeg[] = [
        { strikePrice: atm, optionType: 'CE', action: 'BUY', lots: 1, lotSize, premium: getPremium(atm, 'CE'), impliedVolatility: getIV(atm, 'CE') },
        { strikePrice: otm1CE, optionType: 'CE', action: 'SELL', lots: 1, lotSize, premium: getPremium(otm1CE, 'CE'), impliedVolatility: getIV(otm1CE, 'CE') },
      ];
      const analysis = this.greeksEngine.simulateStrategy(legs, spot);
      candidates.push({
        rank: 0, name: 'Bull Call Spread', type: 'bullish',
        description: `Buy ${atm} CE, Sell ${otm1CE} CE. Limited risk, limited reward.`,
        legs, analysis,
        suitability: 'Moderately bullish, low capital requirement',
      });
    }

    // Bull Put Spread
    if (ctx.trend === 'bullish') {
      const legs: StrategyLeg[] = [
        { strikePrice: otm1PE, optionType: 'PE', action: 'SELL', lots: 1, lotSize, premium: getPremium(otm1PE, 'PE'), impliedVolatility: getIV(otm1PE, 'PE') },
        { strikePrice: otm2PE, optionType: 'PE', action: 'BUY', lots: 1, lotSize, premium: getPremium(otm2PE, 'PE'), impliedVolatility: getIV(otm2PE, 'PE') },
      ];
      const analysis = this.greeksEngine.simulateStrategy(legs, spot);
      candidates.push({
        rank: 0, name: 'Bull Put Spread', type: 'bullish',
        description: `Sell ${otm1PE} PE, Buy ${otm2PE} PE. Credit strategy.`,
        legs, analysis,
        suitability: 'Bullish with credit received upfront',
      });
    }

    // ── Bearish Strategies ─────────────────────────────────

    // Bear Put Spread
    if (ctx.trend === 'bearish' || ctx.trend === 'sideways') {
      const legs: StrategyLeg[] = [
        { strikePrice: atm, optionType: 'PE', action: 'BUY', lots: 1, lotSize, premium: getPremium(atm, 'PE'), impliedVolatility: getIV(atm, 'PE') },
        { strikePrice: otm1PE, optionType: 'PE', action: 'SELL', lots: 1, lotSize, premium: getPremium(otm1PE, 'PE'), impliedVolatility: getIV(otm1PE, 'PE') },
      ];
      const analysis = this.greeksEngine.simulateStrategy(legs, spot);
      candidates.push({
        rank: 0, name: 'Bear Put Spread', type: 'bearish',
        description: `Buy ${atm} PE, Sell ${otm1PE} PE. Limited risk bearish.`,
        legs, analysis,
        suitability: 'Moderately bearish, defined risk',
      });
    }

    // ── Neutral Strategies ─────────────────────────────────

    // Iron Condor (neutral/range-bound)
    if (ctx.trend === 'sideways' || ctx.ivLevel === 'high') {
      const legs: StrategyLeg[] = [
        { strikePrice: otm1PE, optionType: 'PE', action: 'SELL', lots: 1, lotSize, premium: getPremium(otm1PE, 'PE'), impliedVolatility: getIV(otm1PE, 'PE') },
        { strikePrice: otm2PE, optionType: 'PE', action: 'BUY', lots: 1, lotSize, premium: getPremium(otm2PE, 'PE'), impliedVolatility: getIV(otm2PE, 'PE') },
        { strikePrice: otm1CE, optionType: 'CE', action: 'SELL', lots: 1, lotSize, premium: getPremium(otm1CE, 'CE'), impliedVolatility: getIV(otm1CE, 'CE') },
        { strikePrice: otm2CE, optionType: 'CE', action: 'BUY', lots: 1, lotSize, premium: getPremium(otm2CE, 'CE'), impliedVolatility: getIV(otm2CE, 'CE') },
      ];
      const analysis = this.greeksEngine.simulateStrategy(legs, spot);
      candidates.push({
        rank: 0, name: 'Iron Condor', type: 'neutral',
        description: `Range: ${otm1PE}-${otm1CE}. Profits in sideways market.`,
        legs, analysis,
        suitability: 'Sideways market, high IV environment',
      });
    }

    // Short Straddle (neutral, high IV)
    if (ctx.ivLevel === 'high') {
      const legs: StrategyLeg[] = [
        { strikePrice: atm, optionType: 'CE', action: 'SELL', lots: 1, lotSize, premium: getPremium(atm, 'CE'), impliedVolatility: getIV(atm, 'CE') },
        { strikePrice: atm, optionType: 'PE', action: 'SELL', lots: 1, lotSize, premium: getPremium(atm, 'PE'), impliedVolatility: getIV(atm, 'PE') },
      ];
      const analysis = this.greeksEngine.simulateStrategy(legs, spot);
      candidates.push({
        rank: 0, name: 'Short Straddle', type: 'neutral',
        description: `Sell ${atm} CE + PE. Max profit if index stays at ${atm}.`,
        legs, analysis,
        suitability: 'Very high IV, expect contraction, unlimited risk',
      });
    }

    // ── Volatile Strategies ────────────────────────────────

    // Long Straddle (expect big move)
    if (ctx.ivLevel === 'low') {
      const legs: StrategyLeg[] = [
        { strikePrice: atm, optionType: 'CE', action: 'BUY', lots: 1, lotSize, premium: getPremium(atm, 'CE'), impliedVolatility: getIV(atm, 'CE') },
        { strikePrice: atm, optionType: 'PE', action: 'BUY', lots: 1, lotSize, premium: getPremium(atm, 'PE'), impliedVolatility: getIV(atm, 'PE') },
      ];
      const analysis = this.greeksEngine.simulateStrategy(legs, spot);
      candidates.push({
        rank: 0, name: 'Long Straddle', type: 'volatile',
        description: `Buy ${atm} CE + PE. Profits from big move in either direction.`,
        legs, analysis,
        suitability: 'Low IV, expecting big breakout',
      });
    }

    // Long Strangle (cheaper volatile play)
    if (ctx.ivLevel === 'low' || ctx.ivLevel === 'medium') {
      const legs: StrategyLeg[] = [
        { strikePrice: otm1CE, optionType: 'CE', action: 'BUY', lots: 1, lotSize, premium: getPremium(otm1CE, 'CE'), impliedVolatility: getIV(otm1CE, 'CE') },
        { strikePrice: otm1PE, optionType: 'PE', action: 'BUY', lots: 1, lotSize, premium: getPremium(otm1PE, 'PE'), impliedVolatility: getIV(otm1PE, 'PE') },
      ];
      const analysis = this.greeksEngine.simulateStrategy(legs, spot);
      candidates.push({
        rank: 0, name: 'Long Strangle', type: 'volatile',
        description: `Buy ${otm1CE} CE + ${otm1PE} PE. Cheaper than straddle.`,
        legs, analysis,
        suitability: 'Expecting moderate to large move, lower premium',
      });
    }

    return candidates;
  }

  /**
   * Find the Nth OTM strike above or below ATM
   */
  private findStrike(
    strikes: number[],
    atm: number,
    offset: number,
    direction: 'up' | 'down',
  ): number {
    const sorted = [...new Set(strikes)].sort((a, b) => a - b);
    const atmIdx = sorted.findIndex(s => s >= atm);

    if (direction === 'up') {
      const idx = Math.min(atmIdx + offset, sorted.length - 1);
      return sorted[idx];
    } else {
      const idx = Math.max(atmIdx - offset, 0);
      return sorted[idx];
    }
  }

  private daysToExpiry(expiryStr: string): number {
    const expiry = new Date(expiryStr);
    return Math.max(Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)), 0);
  }
}
