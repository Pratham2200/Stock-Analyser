// src/services/SwingStrategyService.ts - 4-Rule Swing Strategy Analysis

import { EMA } from 'technicalindicators';
import { Logger } from '../utils/logger-enhanced';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface DailyBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Zone {
  start: number;
  end: number;
  low: number;
  lowIdx: number;
}

interface RuleResult {
  pass: boolean;
  status: string;
  reason: string;
  details?: any;
}

interface ConsolidationResult extends RuleResult {
  basePrice: number | null;
  currentMove: number;
}

interface HigherLowResult extends RuleResult {
  zones: Zone[];
  scenario?: string;
}

interface VolumePumpResult extends RuleResult {
  spikes: Array<{
    index: number;
    volume: number;
    average: number;
    multiple: string;
    barsAgo: number;
  }>;
}

interface BearSqueezeResult extends RuleResult {
  wickData: {
    totalRange: string;
    lowerWick: string;
    wickPercent: string;
    bodyLow: string;
    threshold: number;
  } | null;
}

interface AnalysisResult {
  qualified: boolean;
  score: number;
  failedAt: string | null;
  reason: string;
  details: {
    consolidation?: ConsolidationResult;
    higherLow?: HigherLowResult;
    volumePump?: VolumePumpResult;
    bearSqueeze?: BearSqueezeResult;
  };
  summary?: {
    consolidationBase: number | null;
    currentMove: number;
    zonesFound: number;
    volumeSpikes: number;
    wickStrength: number;
    signal: string;
  };
}

// ============================================================================
// SWING STRATEGY SERVICE
// ============================================================================

export class SwingStrategyService {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('SwingStrategy');
  }

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  private percentChange(from: number, to: number): number {
    if (!isFinite(from) || !isFinite(to) || from === 0) return 0;
    return ((to - from) / from) * 100;
  }

  // ============================================================================
  // RULE 1: CONSOLIDATION PHASE
  // ============================================================================

  private checkConsolidationPhase(
    closes: number[],
    dates: string[],
    percentThreshold: number = 30,
    daysWindow: number = 60
  ): ConsolidationResult {
    this.logger.info('🔍 RULE 1: Starting Consolidation Phase Check');

    if (!closes || !dates || closes.length < 20 || closes.length !== dates.length) {
      this.logger.error('❌ RULE 1 FAILED: Insufficient data', {
        closesLength: closes?.length,
        datesLength: dates?.length
      });
      return {
        pass: false,
        status: '❌ NO',
        reason: 'Insufficient data for consolidation analysis',
        basePrice: null,
        currentMove: 0
      };
    }

    const ema10 = EMA.calculate({ period: 10, values: closes });
    if (!ema10 || ema10.length < 10) {
      this.logger.error('❌ RULE 1 FAILED: Unable to calculate EMA10');
      return {
        pass: false,
        status: '❌ NO',
        reason: 'Unable to calculate EMA10',
        basePrice: null,
        currentMove: 0
      };
    }

    const n = closes.length;
    const lastDate = new Date(dates[n - 1]);
    let consolidationBase: number | null = null;
    let basePrice: number | null = null;

    this.logger.info(`📊 Scanning ${daysWindow}-day window for zones`, {
      totalBars: n,
      windowDays: daysWindow
    });

    // Scan for zones and track base
    for (let i = 0; i < n; i++) {
      const date = new Date(dates[i]);
      const daysAgo = (lastDate.getTime() - date.getTime()) / (1000 * 3600 * 24);

      if (daysAgo > daysWindow) continue;
      if (ema10[i] === undefined) continue;

      const belowEMA = closes[i] < ema10[i];

      if (belowEMA) {
        let isNewZone = true;
        if (i > 0 && ema10[i - 1] !== undefined) {
          isNewZone = closes[i - 1] >= ema10[i - 1];
        }

        if (isNewZone) {
          let zoneStart = i;
          let zoneLow = closes[i];
          let zoneEnd = i;

          // Find complete zone
          for (let j = i + 1; j < n; j++) {
            if (ema10[j] === undefined) continue;
            if (closes[j] < ema10[j]) {
              zoneEnd = j;
              if (closes[j] < zoneLow) {
                zoneLow = closes[j];
              }
            } else {
              break;
            }
          }

          this.logger.info(`📍 Zone found: bars ${zoneStart}-${zoneEnd}, low: ${zoneLow.toFixed(2)}`);

          // Update base if lower
          if (consolidationBase === null || zoneLow < basePrice!) {
            const oldBase = basePrice;
            consolidationBase = zoneStart;
            basePrice = zoneLow;
            this.logger.info(`🔄 Base ${oldBase ? 'reset' : 'set'} to ${basePrice.toFixed(2)}`, {
              oldBase: oldBase?.toFixed(2),
              newBase: basePrice.toFixed(2)
            });
          }

          i = zoneEnd;
        }
      }

      // Check for 30% move from current base
      if (basePrice !== null) {
        const movePercent = this.percentChange(basePrice, closes[i]);
        if (movePercent >= percentThreshold) {
          this.logger.error(`❌ RULE 1 FAILED: 30% threshold exceeded`, {
            basePrice: basePrice.toFixed(2),
            currentPrice: closes[i].toFixed(2),
            movePercent: movePercent.toFixed(2)
          });
          return {
            pass: false,
            status: '❌ NO',
            reason: `${movePercent.toFixed(2)}% move from base ${basePrice.toFixed(2)} exceeds ${percentThreshold}% threshold`,
            basePrice: basePrice,
            currentMove: movePercent
          };
        }
      }
    }

    if (basePrice === null) {
      this.logger.error('❌ RULE 1 FAILED: No below-EMA zones found');
      return {
        pass: false,
        status: '❌ NO',
        reason: 'No below-EMA zones found in consolidation period',
        basePrice: null,
        currentMove: 0
      };
    }

    const currentMove = this.percentChange(basePrice, closes[n - 1]);
    this.logger.success(`✅ RULE 1 PASSED: Consolidation valid`, {
      basePrice: basePrice.toFixed(2),
      currentPrice: closes[n - 1].toFixed(2),
      currentMove: currentMove.toFixed(2)
    });

    return {
      pass: true,
      status: '✅ YES',
      reason: `Consolidating within ${currentMove.toFixed(2)}% of base ${basePrice.toFixed(2)}`,
      basePrice: basePrice,
      currentMove: currentMove
    };
  }

  // ============================================================================
  // RULE 2: HIGHER LOW STRUCTURE
  // ============================================================================

  private checkHigherLowStructure(
    closes: number[],
    dates: string[],
    daysWindow: number = 60
  ): HigherLowResult {
    this.logger.info('🔍 RULE 2: Starting Higher Low Structure Check');

    if (!closes || !dates || closes.length < 20) {
      this.logger.error('❌ RULE 2 FAILED: Insufficient data');
      return {
        pass: false,
        status: '❌ NO',
        reason: 'Insufficient data for higher low analysis',
        zones: []
      };
    }

    const ema10 = EMA.calculate({ period: 10, values: closes });
    if (!ema10 || ema10.length < 10) {
      this.logger.error('❌ RULE 2 FAILED: Unable to calculate EMA10');
      return {
        pass: false,
        status: '❌ NO',
        reason: 'Unable to calculate EMA10 for higher low analysis',
        zones: []
      };
    }

    const n = closes.length;
    const lastDate = new Date(dates[n - 1]);
    const zones: Zone[] = [];

    this.logger.info(`📊 Detecting zones within ${daysWindow}-day consolidation window`);

    // Find all zones within consolidation period
    let i = 0;
    while (i < n) {
      const date = new Date(dates[i]);
      const daysAgo = (lastDate.getTime() - date.getTime()) / (1000 * 3600 * 24);

      if (daysAgo > daysWindow) {
        i++;
        continue;
      }

      if (ema10[i] === undefined) {
        i++;
        continue;
      }

      if (closes[i] < ema10[i]) {
        let zoneStart = i;
        let zoneLow = closes[i];
        let zoneLowIdx = i;
        let zoneEnd = i;

        // Find complete zone
        for (let j = i + 1; j < n; j++) {
          const nextDate = new Date(dates[j]);
          const nextDaysAgo = (lastDate.getTime() - nextDate.getTime()) / (1000 * 3600 * 24);
          if (nextDaysAgo > daysWindow) break;
          if (ema10[j] === undefined) continue;

          if (closes[j] < ema10[j]) {
            zoneEnd = j;
            if (closes[j] < zoneLow) {
              zoneLow = closes[j];
              zoneLowIdx = j;
            }
          } else {
            break;
          }
        }

        zones.push({ start: zoneStart, end: zoneEnd, low: zoneLow, lowIdx: zoneLowIdx });
        this.logger.info(`📍 Zone ${zones.length}: bars ${zoneStart}-${zoneEnd}, low: ${zoneLow.toFixed(2)}`);
        i = zoneEnd + 1;
      } else {
        i++;
      }
    }

    if (zones.length === 0) {
      this.logger.error('❌ RULE 2 FAILED: No zones found in consolidation period');
      return {
        pass: false,
        status: '❌ NO',
        reason: 'No below-EMA zones found within consolidation period',
        zones: []
      };
    }

    const currentClose = closes[n - 1];
    const currentEMA = ema10[n - 1];

    this.logger.info(`📊 Found ${zones.length} zone(s), analyzing structure`);

    // Single zone scenario
    if (zones.length === 1) {
      const zone = zones[0];
      if (currentClose > zone.low) {
        this.logger.success(`✅ RULE 2 PASSED: Single zone scenario - price above zone low`, {
          currentPrice: currentClose.toFixed(2),
          zoneLow: zone.low.toFixed(2)
        });
        return {
          pass: true,
          status: '✅ YES',
          reason: `Current price ${currentClose.toFixed(2)} above single zone low ${zone.low.toFixed(2)}`,
          zones: zones,
          scenario: 'single-zone'
        };
      } else {
        this.logger.error(`❌ RULE 2 FAILED: Current price below single zone low`, {
          currentPrice: currentClose.toFixed(2),
          zoneLow: zone.low.toFixed(2)
        });
        return {
          pass: false,
          status: '❌ NO',
          reason: `Current price ${currentClose.toFixed(2)} not above zone low ${zone.low.toFixed(2)}`,
          zones: zones
        };
      }
    }

    // Multiple zones scenario
    const prevZone = zones[zones.length - 2];
    const lastZone = zones[zones.length - 1];

    this.logger.info(`📊 Comparing zones for higher low structure`, {
      prevZoneLow: prevZone.low.toFixed(2),
      lastZoneLow: lastZone.low.toFixed(2)
    });

    if (lastZone.low < prevZone.low) {
      this.logger.error(`❌ RULE 2 FAILED: No higher low structure`, {
        lastZoneLow: lastZone.low.toFixed(2),
        prevZoneLow: prevZone.low.toFixed(2)
      });
      return {
        pass: false,
        status: '❌ NO',
        reason: `Latest zone low ${lastZone.low.toFixed(2)} below previous ${prevZone.low.toFixed(2)} - no higher low`,
        zones: zones
      };
    }

    const belowEMA = currentClose < currentEMA;
    const belowLastZoneLow = currentClose < lastZone.low;

    if (belowEMA && belowLastZoneLow) {
      this.logger.error(`❌ RULE 2 FAILED: Structure broken`, {
        currentPrice: currentClose.toFixed(2),
        currentEMA: currentEMA.toFixed(2),
        lastZoneLow: lastZone.low.toFixed(2)
      });
      return {
        pass: false,
        status: '❌ NO',
        reason: `Price ${currentClose.toFixed(2)} below EMA and below latest zone low ${lastZone.low.toFixed(2)} - structure broken`,
        zones: zones
      };
    }

    this.logger.success(`✅ RULE 2 PASSED: Higher low structure confirmed`, {
      prevZoneLow: prevZone.low.toFixed(2),
      lastZoneLow: lastZone.low.toFixed(2),
      currentPrice: currentClose.toFixed(2)
    });

    return {
      pass: true,
      status: '✅ YES',
      reason: `Higher low structure: ${lastZone.low.toFixed(2)} ≥ ${prevZone.low.toFixed(2)}, price above structure`,
      zones: zones,
      scenario: 'multi-zone'
    };
  }

  // ============================================================================
  // RULE 3: VOLUME PUMP
  // ============================================================================

  private checkVolumePump(
    volumes: number[],
    window: number = 20,
    avgPeriod: number = 20,
    multiplier: number = 1.8
  ): VolumePumpResult {
    this.logger.info('🔍 RULE 3: Starting Volume Pump Check');

    if (!volumes || volumes.length < avgPeriod + 5) {
      this.logger.error('❌ RULE 3 FAILED: Insufficient volume data', {
        volumeLength: volumes?.length,
        required: avgPeriod + 5
      });
      return {
        pass: false,
        status: '❌ NO',
        reason: `Need at least ${avgPeriod + 5} bars for volume analysis`,
        spikes: []
      };
    }

    const spikes: VolumePumpResult['spikes'] = [];
    const startIdx = Math.max(avgPeriod, volumes.length - window);

    this.logger.info(`📊 Scanning last ${window} bars for volume spikes (${multiplier}x threshold)`);

    for (let i = startIdx; i < volumes.length; i++) {
      const avgVol = volumes
        .slice(Math.max(0, i - avgPeriod), i)
        .reduce((sum, vol) => sum + vol, 0) / avgPeriod;

      if (avgVol > 0 && volumes[i] >= multiplier * avgVol) {
        const spike = {
          index: i,
          volume: volumes[i],
          average: avgVol,
          multiple: (volumes[i] / avgVol).toFixed(2),
          barsAgo: volumes.length - 1 - i
        };
        spikes.push(spike);
        this.logger.info(`📈 Volume spike detected at index ${i}`, spike);
      }
    }

    if (spikes.length > 0) {
      const firstSpike = spikes[0];
      this.logger.success(`✅ RULE 3 PASSED: Volume spike(s) found`, {
        spikeCount: spikes.length,
        firstSpike: firstSpike
      });
      return {
        pass: true,
        status: '✅ YES',
        reason: `Volume spike found: ${firstSpike.multiple}x average (${firstSpike.barsAgo} bars ago)`,
        spikes: spikes
      };
    }

    this.logger.error(`❌ RULE 3 FAILED: No volume spikes found`, {
      multiplier: multiplier,
      barsScanned: window
    });

    return {
      pass: false,
      status: '❌ NO',
      reason: `No volume spikes ≥${multiplier}x average in last ${window} bars`,
      spikes: []
    };
  }

  // ============================================================================
  // RULE 4: BEAR SQUEEZE CANDLE
  // ============================================================================

  private checkBearSqueezeCandle(
    dailyBars: DailyBar[],
    wickThreshold: number = 40
  ): BearSqueezeResult {
    this.logger.info('🔍 RULE 4: Starting Bear Squeeze Candle Check');

    if (!dailyBars || dailyBars.length === 0) {
      this.logger.error('❌ RULE 4 FAILED: No daily bars provided');
      return {
        pass: false,
        status: '❌ NO',
        reason: 'No daily bars provided',
        wickData: null
      };
    }

    const latestBar = dailyBars[dailyBars.length - 1];
    const { open, high, low, close } = latestBar;

    if ([open, high, low, close].some(val => val == null || !isFinite(val))) {
      this.logger.error('❌ RULE 4 FAILED: Invalid OHLC data', latestBar);
      return {
        pass: false,
        status: '❌ NO',
        reason: 'Invalid OHLC data in latest bar',
        wickData: null
      };
    }

    const totalRange = high - low;

    if (totalRange <= 0) {
      this.logger.error('❌ RULE 4 FAILED: Zero or negative price range', {
        high,
        low,
        totalRange
      });
      return {
        pass: false,
        status: '❌ NO',
        reason: 'Zero or negative price range in latest bar',
        wickData: {
          totalRange: totalRange.toFixed(4),
          lowerWick: '0',
          wickPercent: '0',
          bodyLow: Math.min(open, close).toFixed(4),
          threshold: wickThreshold
        }
      };
    }

    const bodyLow = Math.min(open, close);
    const lowerWick = Math.max(0, bodyLow - low);
    const wickPercent = (lowerWick / totalRange) * 100;

    const wickData = {
      totalRange: totalRange.toFixed(4),
      lowerWick: lowerWick.toFixed(4),
      wickPercent: wickPercent.toFixed(2),
      bodyLow: bodyLow.toFixed(4),
      threshold: wickThreshold
    };

    this.logger.info(`📊 Candle analysis complete`, wickData);

    if (wickPercent >= wickThreshold) {
      this.logger.success(`✅ RULE 4 PASSED: Bear squeeze detected`, {
        wickPercent: wickPercent.toFixed(2),
        threshold: wickThreshold
      });
      return {
        pass: true,
        status: '✅ YES',
        reason: `Bear squeeze: ${wickPercent.toFixed(1)}% wick ≥ ${wickThreshold}% threshold`,
        wickData: wickData
      };
    }

    this.logger.error(`❌ RULE 4 FAILED: Insufficient wick percentage`, {
      wickPercent: wickPercent.toFixed(2),
      threshold: wickThreshold
    });

    return {
      pass: false,
      status: '❌ NO',
      reason: `Insufficient wick: ${wickPercent.toFixed(1)}% < ${wickThreshold}% required`,
      wickData: wickData
    };
  }

  // ============================================================================
  // MAIN ANALYSIS FUNCTION
  // ============================================================================

  async analyzeSwingStock(params: { dailyBars: DailyBar[] }): Promise<AnalysisResult> {
    const { dailyBars } = params;

    this.logger.info('🚀 Starting 4-Rule Swing Strategy Analysis', {
      barsCount: dailyBars?.length
    });

    // Input validation
    if (!Array.isArray(dailyBars) || dailyBars.length < 80) {
      this.logger.error('❌ ANALYSIS FAILED: Insufficient data', {
        provided: dailyBars?.length,
        required: 80
      });
      return {
        qualified: false,
        score: 0,
        failedAt: 'validation',
        reason: 'Insufficient data: need at least 80 bars for proper analysis',
        details: {}
      };
    }

    const closes = dailyBars.map(bar => bar.close);
    const volumes = dailyBars.map(bar => bar.volume);
    const dates = dailyBars.map(bar => bar.date);

    // Validate data integrity
    if (closes.some(c => c == null || !isFinite(c)) || 
        volumes.some(v => v == null || !isFinite(v) || v < 0)) {
      this.logger.error('❌ ANALYSIS FAILED: Invalid price or volume data');
      return {
        qualified: false,
        score: 0,
        failedAt: 'validation',
        reason: 'Invalid price or volume data detected',
        details: {}
      };
    }

    const details: AnalysisResult['details'] = {};
    let score = 0;

    // RULE 1: Consolidation Phase
    const consolidation = this.checkConsolidationPhase(closes, dates);
    details.consolidation = consolidation;

    if (!consolidation.pass) {
      this.logger.error('🛑 ANALYSIS STOPPED: Failed at Rule 1 (Consolidation)', {
        score: 0,
        reason: consolidation.reason
      });
      return {
        qualified: false,
        score: 0,
        failedAt: 'consolidation',
        reason: consolidation.reason,
        details: details
      };
    }
    score++;

    // RULE 2: Higher Low Structure
    const higherLow = this.checkHigherLowStructure(closes, dates);
    details.higherLow = higherLow;

    if (!higherLow.pass) {
      this.logger.error('🛑 ANALYSIS STOPPED: Failed at Rule 2 (Higher Low)', {
        score: score,
        reason: higherLow.reason
      });
      return {
        qualified: false,
        score: score,
        failedAt: 'higher-low',
        reason: higherLow.reason,
        details: details
      };
    }
    score++;

    // RULE 3: Volume Pump
    const volumePump = this.checkVolumePump(volumes);
    details.volumePump = volumePump;

    if (!volumePump.pass) {
      this.logger.error('🛑 ANALYSIS STOPPED: Failed at Rule 3 (Volume Pump)', {
        score: score,
        reason: volumePump.reason
      });
      return {
        qualified: false,
        score: score,
        failedAt: 'volume',
        reason: volumePump.reason,
        details: details
      };
    }
    score++;

    // RULE 4: Bear Squeeze Candle
    const bearSqueeze = this.checkBearSqueezeCandle(dailyBars);
    details.bearSqueeze = bearSqueeze;

    if (!bearSqueeze.pass) {
      this.logger.error('🛑 ANALYSIS STOPPED: Failed at Rule 4 (Bear Squeeze)', {
        score: score,
        reason: bearSqueeze.reason
      });
      return {
        qualified: false,
        score: score,
        failedAt: 'bear-squeeze',
        reason: bearSqueeze.reason,
        details: details
      };
    }
    score++;

    // All rules passed!
    this.logger.success('🎉 ALL RULES PASSED - QUALIFIED SWING SETUP', {
      score: '4/4',
      consolidationBase: consolidation.basePrice?.toFixed(2),
      currentMove: consolidation.currentMove.toFixed(2),
      zonesFound: higherLow.zones.length,
      volumeSpikes: volumePump.spikes.length
    });

    return {
      qualified: true,
      score: 4,
      failedAt: null,
      reason: 'All swing criteria met - strong setup detected',
      details: details,
      summary: {
        consolidationBase: consolidation.basePrice,
        currentMove: consolidation.currentMove,
        zonesFound: higherLow.zones.length,
        volumeSpikes: volumePump.spikes.length,
        wickStrength: parseFloat(bearSqueeze.wickData?.wickPercent || '0'),
        signal: '🔥 QUALIFIED SWING SETUP 🔥'
      }
    };
  }
}

export { DailyBar, AnalysisResult };
