// src/services/OptionsPainMapService.ts — Computes structure for Options Pain Map (Visual Heatmap)

import { BaseService } from './BaseService';
import { OptionsService } from './OptionsService';
import { NseDataService } from './NseDataService';

export interface PainMapStrike {
  strikePrice: number;
  callOI: number;
  putOI: number;
  callVol: number;
  putVol: number;
  isMaxPain: boolean;
  isCallResistance: boolean;
  isPutSupport: boolean;
  painValue: number; // For opacity mapping in frontend
  distanceFromSpot: number; // Percentage
}

export interface PainMapData {
  symbol: string;
  expiryDate: string;
  spotPrice: number;
  maxPainStrike: number;
  bullishSupportStrike: number;
  bearishResistanceStrike: number;
  totalCallOI: number;
  totalPutOI: number;
  pcr: number;
  heatmap: PainMapStrike[];
}

export class OptionsPainMapService extends BaseService {
  private optionsService: OptionsService;
  private nseDataService: NseDataService;

  constructor(optionsService: OptionsService, nseDataService: NseDataService) {
    super('OptionsPainMapService');
    this.optionsService = optionsService;
    this.nseDataService = nseDataService;
  }

  /**
   * Generates a structural heatmap array for frontend rendering.
   * Strips out empty strikes and calculates localized support/resistance.
   */
  async generatePainMap(symbol: string, expiry?: string): Promise<PainMapData> {
    // Single API call — getOIAnalysis internally calls compileOptionChain
    const analysis = await this.optionsService.getOIAnalysis(symbol, expiry);
    // We still need the raw chain data for per-strike iteration
    const chain = await this.nseDataService.compileOptionChain(symbol, expiry);
    const underlying = chain.underlyingValue;
    const maxPainStrike = chain.maxPain;
    
    // Narrow down to sensible strikes (+/- 15% from spot)
    const minStrike = underlying * 0.85;
    const maxStrike = underlying * 1.15;

    let maxCallOInear = 0;
    let maxPutOInear = 0;
    let callResStrike = 0;
    let putSupStrike = 0;

    // Filter strikes and find local maxes
    const validStrikes = chain.data.filter(
      (s: any) => s.strikePrice >= minStrike && s.strikePrice <= maxStrike
    );

    for (const s of validStrikes) {
      const ceOI = s.CE?.openInterest || 0;
      const peOI = s.PE?.openInterest || 0;

      if (ceOI > maxCallOInear && s.strikePrice > underlying) {
        maxCallOInear = ceOI;
        callResStrike = s.strikePrice;
      }

      if (peOI > maxPutOInear && s.strikePrice < underlying) {
        maxPutOInear = peOI;
        putSupStrike = s.strikePrice;
      }
    }

    // Build Heatmap dataset
    const denominator = (maxCallOInear + maxPutOInear) || 1; // Guard against division by zero
    const heatmap: PainMapStrike[] = validStrikes.map((s: any) => {
      const callOI = s.CE?.openInterest || 0;
      const putOI = s.PE?.openInterest || 0;
      const strike = s.strikePrice;
      const isMaxPain = strike === maxPainStrike;

      const totalOI = callOI + putOI;
      const painValue = Math.round((totalOI / denominator) * 100);
      const distanceFromSpot = Math.round(((strike - underlying) / underlying) * 10000) / 100;

      return {
        strikePrice: strike,
        callOI,
        putOI,
        callVol: s.CE?.totalTradedVolume || 0,
        putVol: s.PE?.totalTradedVolume || 0,
        isMaxPain,
        isCallResistance: strike === callResStrike || strike === analysis.maxCallOI.strike,
        isPutSupport: strike === putSupStrike || strike === analysis.maxPutOI.strike,
        painValue,
        distanceFromSpot,
      };
    });

    return {
      symbol: symbol.toUpperCase(),
      expiryDate: chain.expiryDate,
      spotPrice: underlying,
      maxPainStrike,
      bullishSupportStrike: analysis.maxPutOI.strike,
      bearishResistanceStrike: analysis.maxCallOI.strike,
      totalCallOI: analysis.totalCallOI,
      totalPutOI: analysis.totalPutOI,
      pcr: analysis.pcrRatio,
      heatmap
    };
  }
}
