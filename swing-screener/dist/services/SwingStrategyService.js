"use strict";
// src/services/SwingStrategyService.ts - 4-Rule Swing Strategy Analysis
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwingStrategyService = void 0;
const technicalindicators_1 = require("technicalindicators");
const logger_enhanced_1 = require("../utils/logger-enhanced");
// ============================================================================
// SWING STRATEGY SERVICE
// ============================================================================
class SwingStrategyService {
    constructor() {
        this.logger = new logger_enhanced_1.Logger('SwingStrategy');
    }
    // ============================================================================
    // UTILITY FUNCTIONS
    // ============================================================================
    percentChange(from, to) {
        if (!isFinite(from) || !isFinite(to) || from === 0)
            return 0;
        return ((to - from) / from) * 100;
    }
    // ============================================================================
    // RULE 1: CONSOLIDATION PHASE
    // ============================================================================
    // Transcript Requirements:
    // - Consolidation period: 60 days
    // - Stock should not move more than 30% from base during consolidation
    // - Price consolidates below 10 EMA (sometimes 20 EMA, but 10 EMA is primary)
    // - Identifies zones where price is below 10 EMA within 60-day window
    checkConsolidationPhase(closes, dates, percentThreshold = 30, // Transcript: "not move more than 30% from base"
    daysWindow = 60 // Transcript: "Consolidation 60 days"
    ) {
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
        const ema10 = technicalindicators_1.EMA.calculate({ period: 10, values: closes });
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
        let consolidationBase = null;
        let basePrice = null;
        this.logger.info(`📊 Scanning ${daysWindow}-day window for zones`, {
            totalBars: n,
            windowDays: daysWindow
        });
        // Scan for zones and track base
        for (let i = 0; i < n; i++) {
            const date = new Date(dates[i]);
            const daysAgo = (lastDate.getTime() - date.getTime()) / (1000 * 3600 * 24);
            if (daysAgo > daysWindow)
                continue;
            if (ema10[i] === undefined)
                continue;
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
                        if (ema10[j] === undefined)
                            continue;
                        if (closes[j] < ema10[j]) {
                            zoneEnd = j;
                            if (closes[j] < zoneLow) {
                                zoneLow = closes[j];
                            }
                        }
                        else {
                            break;
                        }
                    }
                    this.logger.info(`📍 Zone found: bars ${zoneStart}-${zoneEnd}, low: ${zoneLow.toFixed(2)}`);
                    // Update base if lower
                    // Transcript: Track lowest zone low as base price for 30% threshold check
                    if (basePrice === null || zoneLow < basePrice) {
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
    // Transcript Requirements:
    // - Chart must make "higher lows"
    // - Uses 10 EMA to identify higher lows
    // - Structure should not be broken (price above structure)
    // - Single zone: Current price must be above zone low
    // - Multiple zones: Latest zone low must be ≥ previous zone low
    // NOTE: Currently using original logic (only last 2 zones)
    // Enhanced logic (sequential check of all zones) is commented out below
    checkHigherLowStructure(closes, dates, daysWindow = 60 // Uses same 60-day window as consolidation
    ) {
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
        const ema10 = technicalindicators_1.EMA.calculate({ period: 10, values: closes });
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
        const zones = [];
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
                    if (nextDaysAgo > daysWindow)
                        break;
                    if (ema10[j] === undefined)
                        continue;
                    if (closes[j] < ema10[j]) {
                        zoneEnd = j;
                        if (closes[j] < zoneLow) {
                            zoneLow = closes[j];
                            zoneLowIdx = j;
                        }
                    }
                    else {
                        break;
                    }
                }
                zones.push({ start: zoneStart, end: zoneEnd, low: zoneLow, lowIdx: zoneLowIdx });
                this.logger.info(`📍 Zone ${zones.length}: bars ${zoneStart}-${zoneEnd}, low: ${zoneLow.toFixed(2)}`);
                i = zoneEnd + 1;
            }
            else {
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
            }
            else {
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
        // NEW LOGIC: Check ALL zones sequentially to ensure proper higher low structure
        // Each zone low must be >= previous zone low (equal lows are acceptable)
        // COMMENTED OUT - Reverted to original logic (only check last 2 zones)
        /*
        for (let i = 1; i < zones.length; i++) {
          const prevZone = zones[i - 1];
          const currentZone = zones[i];
          
          this.logger.info(`📊 Comparing zones ${i} and ${i + 1} for higher low structure`, {
            prevZoneLow: prevZone.low.toFixed(2),
            currentZoneLow: currentZone.low.toFixed(2)
          });
          
          // Equal lows are acceptable (>= condition)
          if (currentZone.low < prevZone.low) {
            this.logger.error(`❌ RULE 2 FAILED: No higher low structure - zone ${i + 1} lower than zone ${i}`, {
              prevZoneLow: prevZone.low.toFixed(2),
              currentZoneLow: currentZone.low.toFixed(2),
              zoneIndex: i + 1
            });
            return {
              pass: false,
              status: '❌ NO',
              reason: `Zone ${i + 1} low ${currentZone.low.toFixed(2)} below zone ${i} low ${prevZone.low.toFixed(2)} - higher low structure broken (equal or higher required)`,
              zones: zones
            };
          }
        }
        
        // All zones passed sequential check
        const prevZone = zones[zones.length - 2];
        const lastZone = zones[zones.length - 1];
        
        this.logger.info(`✅ All zones passed sequential higher low check`, {
          totalZones: zones.length,
          prevZoneLow: prevZone.low.toFixed(2),
          lastZoneLow: lastZone.low.toFixed(2)
        });
        */
        // ORIGINAL LOGIC: Only check last two zones (restored)
        const prevZone = zones[zones.length - 2];
        const lastZone = zones[zones.length - 1];
        this.logger.info(`📊 Comparing zones for higher low structure`, {
            prevZoneLow: prevZone.low.toFixed(2),
            lastZoneLow: lastZone.low.toFixed(2)
        });
        // Check if last zone is greater than or equal to previous zone
        // Equal lows are acceptable (consolidation at same level)
        if (lastZone.low < prevZone.low) {
            this.logger.error(`❌ RULE 2 FAILED: No higher low structure`, {
                lastZoneLow: lastZone.low.toFixed(2),
                prevZoneLow: prevZone.low.toFixed(2)
            });
            return {
                pass: false,
                status: '❌ NO',
                reason: `Latest zone low ${lastZone.low.toFixed(2)} below previous ${prevZone.low.toFixed(2)} - no higher low (equal or higher required)`,
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
        // Check if zones are equal or higher
        const isEqual = Math.abs(lastZone.low - prevZone.low) < 3.00; // Consider equal if within 3.00
        const isHigher = lastZone.low > prevZone.low;
        this.logger.success(`✅ RULE 2 PASSED: Higher low structure confirmed`, {
            prevZoneLow: prevZone.low.toFixed(2),
            lastZoneLow: lastZone.low.toFixed(2),
            currentPrice: currentClose.toFixed(2),
            relationship: isEqual ? 'equal' : isHigher ? 'higher' : 'equal/higher'
        });
        const relationshipText = isEqual
            ? `Equal low structure: ${lastZone.low.toFixed(2)} = ${prevZone.low.toFixed(2)}`
            : `Higher low structure: ${lastZone.low.toFixed(2)} > ${prevZone.low.toFixed(2)}`;
        return {
            pass: true,
            status: '✅ YES',
            reason: `${relationshipText}, price above structure`,
            zones: zones,
            scenario: 'multi-zone'
        };
    }
    // ============================================================================
    // RULE 3: VOLUME PUMP
    // ============================================================================
    // Transcript Requirements:
    // - Volume pump in "last 20 to 25 candles/sessions"
    // - Volume pump indicates renewed interest/positive sentiment
    // - Happens within the consolidation period
    // - Significant volume increase (1.8x average used as threshold)
    // - After last volume pump, check for selling candles (volume >2x avg)
    // - If selling pump found, must have buying volume pump after it, otherwise reject
    checkVolumePump(dailyBars, window = 25, // Transcript: "last 20 to 25 candles" - using maximum (25) for best coverage
    avgPeriod = 20, // Standard 20-period average for comparison
    multiplier = 1.8, // Threshold for significant volume pump (reasonable default)
    sellingMultiplier = 2.0 // Threshold for selling volume pump
    ) {
        this.logger.info('🔍 RULE 3: Starting Volume Pump Check');
        if (!dailyBars || dailyBars.length < avgPeriod + 5) {
            this.logger.error('❌ RULE 3 FAILED: Insufficient volume data', {
                barsLength: dailyBars?.length,
                required: avgPeriod + 5
            });
            return {
                pass: false,
                status: '❌ NO',
                reason: `Need at least ${avgPeriod + 5} bars for volume analysis`,
                spikes: []
            };
        }
        const volumes = dailyBars.map(bar => bar.volume);
        const spikes = [];
        const buyingSpikes = [];
        const sellingSpikes = [];
        const startIdx = Math.max(avgPeriod, volumes.length - window);
        this.logger.info(`📊 Scanning last ${window} bars for volume spikes (${multiplier}x threshold)`, {
            window: window,
            avgPeriod: avgPeriod,
            multiplier: multiplier,
            transcriptMatch: '20-25 candles (using 25 for maximum coverage)'
        });
        // Find all volume pumps (buying and selling)
        for (let i = startIdx; i < volumes.length; i++) {
            const avgVol = volumes
                .slice(Math.max(0, i - avgPeriod), i)
                .reduce((sum, vol) => sum + vol, 0) / avgPeriod;
            if (avgVol > 0 && volumes[i] >= multiplier * avgVol) {
                const bar = dailyBars[i];
                const isBuyingCandle = bar.close > bar.open; // Green/up candle = buying
                const isSellingCandle = bar.close < bar.open; // Red/down candle = selling
                const spike = {
                    index: i,
                    volume: volumes[i],
                    average: avgVol,
                    multiple: (volumes[i] / avgVol).toFixed(2),
                    barsAgo: volumes.length - 1 - i
                };
                spikes.push(spike);
                if (isBuyingCandle) {
                    buyingSpikes.push(spike);
                    this.logger.info(`📈 Buying volume spike detected at index ${i}`, spike);
                }
                else if (isSellingCandle) {
                    sellingSpikes.push(spike);
                    this.logger.info(`📉 Selling volume spike detected at index ${i}`, spike);
                }
                else {
                    // Doji/neutral candle - treat as buying for now
                    buyingSpikes.push(spike);
                    this.logger.info(`📊 Neutral volume spike detected at index ${i} (treated as buying)`, spike);
                }
            }
        }
        // Must have at least one volume pump to proceed
        if (spikes.length === 0) {
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
        // Find the last volume pump (most recent) WITHIN the 25-day window
        const lastVolumePump = spikes[spikes.length - 1];
        const lastPumpIndex = lastVolumePump.index;
        // Ensure we only look within the last 25 bars window
        const windowEndIndex = volumes.length - 1;
        const windowStartIndex = Math.max(0, volumes.length - window);
        this.logger.info(`📍 Last volume pump found at index ${lastPumpIndex} (${lastVolumePump.barsAgo} bars ago)`, {
            windowStartIndex: windowStartIndex,
            windowEndIndex: windowEndIndex,
            windowSize: window
        });
        // Check for selling candles with volume > 2x average AFTER the last volume pump
        // BUT only within the 25-day window (from windowStartIndex to windowEndIndex)
        let sellingPumpFound = false;
        let sellingPumpIndex = -1;
        // Only check after last pump AND within the 25-day window
        const checkStartIndex = Math.max(lastPumpIndex + 1, windowStartIndex);
        const checkEndIndex = windowEndIndex;
        for (let i = checkStartIndex; i <= checkEndIndex; i++) {
            const avgVol = volumes
                .slice(Math.max(0, i - avgPeriod), i)
                .reduce((sum, vol) => sum + vol, 0) / avgPeriod;
            const bar = dailyBars[i];
            const isSellingCandle = bar.close < bar.open;
            if (avgVol > 0 && isSellingCandle && volumes[i] >= sellingMultiplier * avgVol) {
                sellingPumpFound = true;
                sellingPumpIndex = i;
                this.logger.warn(`⚠️ Selling volume pump detected after last volume pump (within 25-day window)`, {
                    index: i,
                    volume: volumes[i],
                    average: avgVol,
                    multiple: (volumes[i] / avgVol).toFixed(2),
                    barsAgo: volumes.length - 1 - i
                });
                break; // Found first selling pump, stop searching
            }
        }
        // If no selling pump after last volume pump (within window), stock qualifies
        if (!sellingPumpFound) {
            this.logger.success(`✅ RULE 3 PASSED: No selling pump after last volume pump (within 25-day window)`, {
                spikeCount: spikes.length,
                lastPump: lastVolumePump,
                checkedUpToBar: checkEndIndex
            });
            return {
                pass: true,
                status: '✅ YES',
                reason: `Volume spike found: ${lastVolumePump.multiple}x average (${lastVolumePump.barsAgo} bars ago), no selling pump after within 25-day window`,
                spikes: spikes
            };
        }
        // Selling pump found - must have buying volume pump AFTER the selling pump
        // BUT only within the 25-day window
        this.logger.info(`🔍 Selling pump found. Checking for buying volume pump after selling pump (within 25-day window)...`, {
            sellingPumpIndex: sellingPumpIndex,
            barsAgo: volumes.length - 1 - sellingPumpIndex,
            windowEndIndex: windowEndIndex
        });
        let buyingPumpAfterSelling = false;
        let buyingPumpAfterSellingIndex = -1;
        // Only check after selling pump AND within the 25-day window
        const buyingCheckStartIndex = Math.max(sellingPumpIndex + 1, windowStartIndex);
        const buyingCheckEndIndex = windowEndIndex;
        for (let i = buyingCheckStartIndex; i <= buyingCheckEndIndex; i++) {
            const avgVol = volumes
                .slice(Math.max(0, i - avgPeriod), i)
                .reduce((sum, vol) => sum + vol, 0) / avgPeriod;
            const bar = dailyBars[i];
            const isBuyingCandle = bar.close > bar.open;
            if (avgVol > 0 && isBuyingCandle && volumes[i] >= multiplier * avgVol) {
                buyingPumpAfterSelling = true;
                buyingPumpAfterSellingIndex = i;
                this.logger.success(`✅ Buying volume pump found after selling pump (within 25-day window)`, {
                    index: i,
                    volume: volumes[i],
                    average: avgVol,
                    multiple: (volumes[i] / avgVol).toFixed(2),
                    barsAgo: volumes.length - 1 - i
                });
                break; // Found buying pump, stop searching
            }
        }
        if (buyingPumpAfterSelling) {
            this.logger.success(`✅ RULE 3 PASSED: Buying volume pump found after selling pump`, {
                spikeCount: spikes.length,
                sellingPumpIndex: sellingPumpIndex,
                buyingPumpAfterSellingIndex: buyingPumpAfterSellingIndex
            });
            return {
                pass: true,
                status: '✅ YES',
                reason: `Volume pump found. Selling pump at ${volumes.length - 1 - sellingPumpIndex} bars ago, but buying pump found after`,
                spikes: spikes
            };
        }
        else {
            this.logger.error(`❌ RULE 3 FAILED: No buying volume pump after selling pump`, {
                sellingPumpIndex: sellingPumpIndex,
                barsAfterSelling: volumes.length - 1 - sellingPumpIndex
            });
            return {
                pass: false,
                status: '❌ NO',
                reason: `Selling volume pump found after last volume pump (${volumes.length - 1 - sellingPumpIndex} bars ago), but no buying pump after selling`,
                spikes: spikes
            };
        }
    }
    // ============================================================================
    // RULE 4: BEAR SQUEEZE CANDLE
    // ============================================================================
    // Transcript Requirements:
    // - Need a bear squeeze candle (latest/most recent candle)
    // - Bear squeeze candle has a large lower wick
    // - Lower wick should be 40% or more of the total candle range
    // - Shows rejection of lower prices (bears squeezed out)
    checkBearSqueezeCandle(dailyBars, wickThreshold = 40 // Transcript: "40% or more" of total candle range
    ) {
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
    async analyzeSwingStock(params) {
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
        const details = {};
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
        // RULE 3: Volume Pump (needs dailyBars to check buying vs selling candles)
        const volumePump = this.checkVolumePump(dailyBars);
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
exports.SwingStrategyService = SwingStrategyService;
//# sourceMappingURL=SwingStrategyService.js.map