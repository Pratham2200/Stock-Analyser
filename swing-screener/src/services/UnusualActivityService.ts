// src/services/UnusualActivityService.ts — Detects abnormal volume, OI spikes, and price-volume divergences

import { BaseService } from './BaseService';
import { MarketDataService } from './MarketDataService';
import { OptionsService } from './OptionsService';

export interface UnusualAlert {
  symbol: string;
  alertType: 'VOLUME_SPIKE' | 'OI_SURGE' | 'PRICE_VOLUME_DIVERGENCE' | 'DELIVERY_SPIKE';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  metric: string;   // e.g., "Volume 4.2x above 20D avg"
  currentValue: number;
  baselineValue: number;
  multiplier: number;
  detectedAt: string;
  interpretation: string;
}

export class UnusualActivityService extends BaseService {
  private marketData: MarketDataService;
  private optionsService: OptionsService;

  constructor(marketData: MarketDataService, optionsService: OptionsService) {
    super('UnusualActivityService');
    this.marketData = marketData;
    this.optionsService = optionsService;
  }

  /**
   * Scan a symbol for unusual activity signals
   */
  async scanSymbol(symbol: string): Promise<UnusualAlert[]> {
    const symbolUpper = symbol.toUpperCase();
    const alerts: UnusualAlert[] = [];

    // 1. Volume Spike Detection
    try {
      const chartResult = await this.marketData.fetchDailyBarsWithQuote(symbolUpper, 30);
      const bars = chartResult.bars;
      if (bars.length >= 20) {
        const recentBar = bars[bars.length - 1];
        const avg20Volume = bars.slice(-21, -1).reduce((s, b) => s + b.volume, 0) / 20;

        if (avg20Volume > 0) {
          const volumeMultiplier = recentBar.volume / avg20Volume;

          if (volumeMultiplier >= 3) {
            alerts.push({
              symbol: symbolUpper,
              alertType: 'VOLUME_SPIKE',
              severity: volumeMultiplier >= 5 ? 'HIGH' : volumeMultiplier >= 3 ? 'MEDIUM' : 'LOW',
              metric: `Volume ${volumeMultiplier.toFixed(1)}x above 20D avg`,
              currentValue: recentBar.volume,
              baselineValue: Math.round(avg20Volume),
              multiplier: Math.round(volumeMultiplier * 10) / 10,
              detectedAt: new Date().toISOString(),
              interpretation: volumeMultiplier >= 5
                ? 'Extremely high volume — possible institutional accumulation or block deal activity'
                : 'Elevated volume suggests growing interest — monitor for breakout or breakdown',
            });
          }

          // Price-Volume Divergence: price drops but volume surges (or vice versa)
          if (bars.length >= 2) {
            const prevBar = bars[bars.length - 2];
            const priceChange = ((recentBar.close - prevBar.close) / prevBar.close) * 100;
            const isVolumeSurge = volumeMultiplier >= 2;
            const isPriceDrop = priceChange < -1;
            const isPriceFlat = Math.abs(priceChange) < 0.5;

            if (isVolumeSurge && (isPriceDrop || isPriceFlat)) {
              alerts.push({
                symbol: symbolUpper,
                alertType: 'PRICE_VOLUME_DIVERGENCE',
                severity: isPriceDrop && volumeMultiplier >= 3 ? 'HIGH' : 'MEDIUM',
                metric: `Price ${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}% but Volume ${volumeMultiplier.toFixed(1)}x`,
                currentValue: priceChange,
                baselineValue: volumeMultiplier,
                multiplier: volumeMultiplier,
                detectedAt: new Date().toISOString(),
                interpretation: isPriceDrop
                  ? 'Heavy selling pressure with high volume — potential distribution or panic exit'
                  : 'Flat price with high volume — potential accumulation before a move',
              });
            }
          }
        }
      }
    } catch (error) {
      this.logger.debug(`Volume analysis failed for ${symbolUpper}`);
    }

    // 2. OI Surge Detection (for F&O stocks)
    try {
      const analysis = await this.optionsService.getOIAnalysis(symbolUpper);
      // Check if call or put OI at max strike is abnormally concentrated
      if (analysis.maxCallOI.oi > 0 && analysis.maxPutOI.oi > 0) {
        const oiRatio = analysis.maxCallOI.oi / analysis.maxPutOI.oi;
        if (oiRatio > 3 || oiRatio < 0.33) {
          alerts.push({
            symbol: symbolUpper,
            alertType: 'OI_SURGE',
            severity: oiRatio > 5 || oiRatio < 0.2 ? 'HIGH' : 'MEDIUM',
            metric: oiRatio > 1
              ? `Call OI ${oiRatio.toFixed(1)}x Put OI at max strike`
              : `Put OI ${(1 / oiRatio).toFixed(1)}x Call OI at max strike`,
            currentValue: analysis.maxCallOI.oi,
            baselineValue: analysis.maxPutOI.oi,
            multiplier: Math.round(Math.max(oiRatio, 1 / oiRatio) * 10) / 10,
            detectedAt: new Date().toISOString(),
            interpretation: oiRatio > 1
              ? 'Heavy call writing at resistance — market makers expect range-bound or downward move'
              : 'Massive put OI at support — strong floor expected, potential bounce zone',
          });
        }
      }
    } catch {
      this.logger.debug(`OI analysis not available for ${symbolUpper}`);
    }

    return alerts;
  }

  /**
   * Scan multiple symbols for unusual activity
   */
  async scanMarket(symbols: string[]): Promise<UnusualAlert[]> {
    const allAlerts: UnusualAlert[] = [];

    for (const sym of symbols) {
      try {
        const symbolAlerts = await this.scanSymbol(sym);
        allAlerts.push(...symbolAlerts);
      } catch {
        continue;
      }
    }

    // Sort by severity (HIGH first)
    const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    allAlerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return allAlerts;
  }
}
