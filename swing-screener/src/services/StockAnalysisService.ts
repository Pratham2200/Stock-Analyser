// src/services/StockAnalysisService.ts - Stock analysis business logic

import { BaseService } from './BaseService';
import { AnalysisInput, AnalysisOutput, AnalysisDetails, DailyBar } from '../types/analysis';
import { SwingStrategyService, DailyBar as SwingDailyBar, AnalysisResult as SwingAnalysisResult } from './SwingStrategyService';
import { EMA } from 'technicalindicators';

export class StockAnalysisService extends BaseService {
  private swingStrategyService: SwingStrategyService;

  constructor() {
    super('StockAnalysisService');
    this.swingStrategyService = new SwingStrategyService();
  }

  async analyzeStock(input: AnalysisInput): Promise<AnalysisOutput> {
    const startTime = Date.now();
    
    try {
      this.validateRequired(input, ['symbol', 'dailyBars']);
      
      if (input.dailyBars.length < 80) {
        return this.createRejectedResult(
          'Insufficient data',
          'Need at least 80 days of data for reliable analysis',
          startTime,
          input.dailyBars.length,
          input.intradayBars?.length || 0
        );
      }

      // Use the new 4-rule swing strategy
      const swingResult = await this.analyzeWithSwingStrategy(input);
      
      if (swingResult) {
        return swingResult;
      }

      // Fallback to original analysis if swing strategy fails
      this.logger.warn('Swing strategy analysis failed, falling back to original analysis');
      const analysisDetails = await this.performAnalysis(input.dailyBars);
      const overallScore = this.calculateOverallScore(analysisDetails);
      const qualified = this.determineQualification(analysisDetails, overallScore);

      return {
        qualified,
        score: overallScore,
        failedAt: qualified ? 0 : this.getFailureStep(analysisDetails),
        reason: qualified ? 'All criteria passed' : this.getFailureReason(analysisDetails),
        currentPrice: input.dailyBars[input.dailyBars.length - 1]?.close || 0,
        ema10: analysisDetails.consolidation.basePrice || 0,
        ema20: analysisDetails.higherLow.recentLows[0] || 0,
        details: analysisDetails,
        analysisDurationMs: Date.now() - startTime,
        dataPointsDaily: input.dailyBars.length,
        dataPointsIntraday: input.intradayBars?.length || 0
      };

    } catch (error) {
      this.logger.error('Stock analysis failed:', error);
      return this.createRejectedResult(
        'Analysis error',
        (error as Error).message,
        startTime,
        input.dailyBars.length,
        input.intradayBars?.length || 0
      );
    }
  }

  private async analyzeWithSwingStrategy(input: AnalysisInput): Promise<AnalysisOutput | null> {
    try {
      this.logger.info(`🎯 Starting 4-Rule Swing Strategy Analysis for ${input.symbol}`);
      
      // Convert DailyBar format to SwingDailyBar format
      const swingDailyBars: SwingDailyBar[] = input.dailyBars.map(bar => ({
        date: typeof bar.date === 'string' ? bar.date : bar.date.toISOString().split('T')[0],
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume
      }));

      // Run the 4-rule swing strategy analysis
      const swingResult = await this.swingStrategyService.analyzeSwingStock({
        dailyBars: swingDailyBars
      });

      // Convert swing result to AnalysisOutput format
      const analysisOutput: AnalysisOutput = {
        qualified: swingResult.qualified,
        score: swingResult.score,
        failedAt: swingResult.failedAt === null ? 0 : this.mapFailureStep(swingResult.failedAt),
        reason: swingResult.reason,
        currentPrice: input.dailyBars[input.dailyBars.length - 1]?.close || 0,
        ema10: swingResult.details.consolidation?.basePrice || 0,
        ema20: swingResult.details.higherLow?.zones?.[0]?.low || 0,
        details: this.convertSwingDetailsToAnalysisDetails(swingResult.details),
        analysisDurationMs: 0, // Will be set by caller
        dataPointsDaily: input.dailyBars.length,
        dataPointsIntraday: input.intradayBars?.length || 0
      };

      this.logger.stockAnalysis(
        input.symbol,
        swingResult.qualified,
        swingResult.score,
        swingResult.qualified ? undefined : swingResult.reason
      );

      return analysisOutput;

    } catch (error) {
      this.logger.error(`❌ Swing strategy analysis failed for ${input.symbol}:`, error);
      return null;
    }
  }

  private mapFailureStep(failedAt: string | null): number {
    if (!failedAt) return 0;
    
    switch (failedAt) {
      case 'validation': return 0;
      case 'consolidation': return 1;
      case 'higher-low': return 2;
      case 'volume': return 3;
      case 'bear-squeeze': return 4;
      default: return 0;
    }
  }

  private convertSwingDetailsToAnalysisDetails(swingDetails: SwingAnalysisResult['details']): AnalysisDetails {
    const allPassed = swingDetails.consolidation?.pass && swingDetails.higherLow?.pass && 
                     swingDetails.volumePump?.pass && swingDetails.bearSqueeze?.pass;

    return {
      consolidation: {
        pass: swingDetails.consolidation?.pass || false,
        status: swingDetails.consolidation?.status || '❌ NO',
        reason: swingDetails.consolidation?.reason || 'Failed',
        basePrice: swingDetails.consolidation?.basePrice || null,
        currentMove: swingDetails.consolidation?.currentMove || 0,
        consolidationDays: 20, // Default value
        range: {
          high: swingDetails.consolidation?.basePrice ? swingDetails.consolidation.basePrice * 1.1 : 0,
          low: swingDetails.consolidation?.basePrice ? swingDetails.consolidation.basePrice * 0.9 : 0,
          range: swingDetails.consolidation?.basePrice ? swingDetails.consolidation.basePrice * 0.2 : 0,
          rangePercent: 20
        }
      },
      higherLow: {
        pass: swingDetails.higherLow?.pass || false,
        status: swingDetails.higherLow?.status || '❌ NO',
        reason: swingDetails.higherLow?.reason || 'Failed',
        higherLowCount: swingDetails.higherLow?.zones?.length || 0,
        recentLows: swingDetails.higherLow?.zones?.map(z => z.low) || [],
        trend: swingDetails.higherLow?.pass ? 'up' : 'down',
        strength: swingDetails.higherLow?.pass ? 0.8 : 0.2
      },
      volumePump: {
        pass: swingDetails.volumePump?.pass || false,
        status: swingDetails.volumePump?.status || '❌ NO',
        reason: swingDetails.volumePump?.reason || 'Failed',
        volumeRatio: swingDetails.volumePump?.spikes?.[0]?.multiple ? parseFloat(swingDetails.volumePump.spikes[0].multiple) : 1.0,
        averageVolume: swingDetails.volumePump?.spikes?.[0]?.average || 0,
        currentVolume: swingDetails.volumePump?.spikes?.[0]?.volume || 0,
        volumeTrend: swingDetails.volumePump?.pass ? 'increasing' : 'stable'
      },
      bearSqueeze: {
        pass: swingDetails.bearSqueeze?.pass || false,
        status: swingDetails.bearSqueeze?.status || '❌ NO',
        reason: swingDetails.bearSqueeze?.reason || 'Failed',
        squeezeCount: swingDetails.bearSqueeze?.pass ? 1 : 0,
        recentSqueezes: swingDetails.bearSqueeze?.pass ? [1] : [],
        bearishPressure: swingDetails.bearSqueeze?.pass ? 0.3 : 0.7,
        bullishMomentum: swingDetails.bearSqueeze?.pass ? 0.7 : 0.3
      },
      overall: {
        score: allPassed ? 4 : 0,
        grade: allPassed ? 'A' : 'F',
        recommendation: allPassed ? 'strong_buy' : 'sell',
        confidence: allPassed ? 0.9 : 0.1,
        riskLevel: 'medium'
      }
    };
  }

  private async performAnalysis(dailyBars: DailyBar[]): Promise<AnalysisDetails> {
    const [consolidation, higherLow, volumePump, bearSqueeze] = await Promise.all([
      this.checkConsolidationPhase(dailyBars),
      this.checkHigherLowStructure(dailyBars),
      this.checkVolumePump(dailyBars),
      this.checkBearSqueeze(dailyBars)
    ]);

    const overall = this.calculateOverallResult(consolidation, higherLow, volumePump, bearSqueeze);

    return {
      consolidation,
      higherLow,
      volumePump,
      bearSqueeze,
      overall
    };
  }

  private async checkConsolidationPhase(bars: DailyBar[]): Promise<any> {
    try {
      const closes = bars.map(bar => bar.close);
      const ema10 = EMA.calculate({ values: closes, period: 10 }) as number[];
      const ema20 = EMA.calculate({ values: closes, period: 20 }) as number[];

      if (ema10.length < 20) {
        return { pass: false, status: 'insufficient_data', reason: 'Need more data for EMA calculation' };
      }

      const recentBars = bars.slice(-20);
      const high = Math.max(...recentBars.map(bar => bar.high));
      const low = Math.min(...recentBars.map(bar => bar.low));
      const range = high - low;
      const rangePercent = (range / low) * 100;

      const currentPrice = closes[closes.length - 1];
      const basePrice = ema20[ema20.length - 1];
      const currentMove = ((currentPrice - basePrice) / basePrice) * 100;

      const pass = rangePercent < 15 && currentMove > 0 && currentMove < 5;

      return {
        pass,
        status: pass ? 'consolidated' : 'not_consolidated',
        reason: pass ? 'Stock is in consolidation phase' : 'Stock is not in consolidation phase',
        basePrice,
        currentMove,
        consolidationDays: 20,
        range: { high, low, range, rangePercent }
      };
    } catch (error) {
      return { pass: false, status: 'error', reason: (error as Error).message };
    }
  }

  private async checkHigherLowStructure(bars: DailyBar[]): Promise<any> {
    try {
      const recentBars = bars.slice(-30);
      const lows = recentBars.map(bar => bar.low);
      const higherLows = [];

      for (let i = 1; i < lows.length - 1; i++) {
        if (lows[i] > lows[i - 1] && lows[i] < lows[i + 1]) {
          higherLows.push(lows[i]);
        }
      }

      const pass = higherLows.length >= 2;
      const trend = this.calculateTrend(lows);
      const strength = this.calculateTrendStrength(lows);

      return {
        pass,
        status: pass ? 'higher_low' : 'no_higher_low',
        reason: pass ? 'Higher low structure detected' : 'No higher low structure found',
        higherLowCount: higherLows.length,
        recentLows: higherLows,
        trend,
        strength
      };
    } catch (error) {
      return { pass: false, status: 'error', reason: (error as Error).message };
    }
  }

  private async checkVolumePump(bars: DailyBar[]): Promise<any> {
    try {
      const recentBars = bars.slice(-10);
      const volumes = recentBars.map(bar => bar.volume);
      const avgVol = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
      const currentVol = volumes[volumes.length - 1];
      const volumeRatio = avgVol > 0 ? currentVol / avgVol : 0;

      const pass = volumeRatio > 1.5 && avgVol > 0;

      return {
        pass,
        status: pass ? 'volume_pump' : 'no_volume_pump',
        reason: pass ? 'Volume pump detected' : 'No significant volume increase',
        volumeRatio,
        averageVolume: avgVol,
        currentVolume: currentVol,
        volumeTrend: this.calculateVolumeTrend(volumes)
      };
    } catch (error) {
      return { pass: false, status: 'error', reason: (error as Error).message };
    }
  }

  private async checkBearSqueeze(bars: DailyBar[]): Promise<any> {
    try {
      const recentBars = bars.slice(-15);
      const bearSqueezes = [];

      for (let i = 1; i < recentBars.length - 1; i++) {
        const prev = recentBars[i - 1];
        const current = recentBars[i];
        const next = recentBars[i + 1];

        if (prev.close > current.close && current.close < next.close) {
          bearSqueezes.push(current.low);
        }
      }

      const pass = bearSqueezes.length >= 1;
      const bearishPressure = this.calculateBearishPressure(recentBars);
      const bullishMomentum = this.calculateBullishMomentum(recentBars);

      return {
        pass,
        status: pass ? 'bear_squeeze' : 'no_bear_squeeze',
        reason: pass ? 'Bear squeeze pattern detected' : 'No bear squeeze pattern found',
        squeezeCount: bearSqueezes.length,
        recentSqueezes: bearSqueezes,
        bearishPressure,
        bullishMomentum
      };
    } catch (error) {
      return { pass: false, status: 'error', reason: (error as Error).message };
    }
  }

  private calculateOverallScore(details: AnalysisDetails): number {
    let score = 0;
    
    if (details.consolidation.pass) score += 25;
    if (details.higherLow.pass) score += 25;
    if (details.volumePump.pass) score += 25;
    if (details.bearSqueeze.pass) score += 25;

    return score;
  }

  private determineQualification(details: AnalysisDetails, score: number): boolean {
    return score >= 75 && details.consolidation.pass && details.higherLow.pass;
  }

  private getFailureStep(details: AnalysisDetails): number {
    if (!details.consolidation.pass) return 1;
    if (!details.higherLow.pass) return 2;
    if (!details.volumePump.pass) return 3;
    if (!details.bearSqueeze.pass) return 4;
    return 0;
  }

  private getFailureReason(details: AnalysisDetails): string {
    if (!details.consolidation.pass) return 'Consolidation phase not detected';
    if (!details.higherLow.pass) return 'Higher low structure not found';
    if (!details.volumePump.pass) return 'Volume pump not detected';
    if (!details.bearSqueeze.pass) return 'Bear squeeze pattern not found';
    return 'Unknown failure';
  }

  private calculateOverallResult(consolidation: any, higherLow: any, volumePump: any, bearSqueeze: any): any {
    const score = this.calculateOverallScore({ consolidation, higherLow, volumePump, bearSqueeze, overall: {} as any });
    
    let grade: 'A' | 'B' | 'C' | 'D' | 'F';
    if (score >= 90) grade = 'A';
    else if (score >= 75) grade = 'B';
    else if (score >= 60) grade = 'C';
    else if (score >= 40) grade = 'D';
    else grade = 'F';

    return {
      score,
      grade,
      recommendation: score >= 75 ? 'buy' : score >= 50 ? 'hold' : 'sell',
      confidence: Math.min(score, 100),
      riskLevel: score >= 80 ? 'low' : score >= 60 ? 'medium' : 'high'
    };
  }

  private calculateTrend(lows: number[]): 'up' | 'down' | 'sideways' {
    if (lows.length < 3) return 'sideways';
    
    const first = lows[0];
    const last = lows[lows.length - 1];
    const change = (last - first) / first;
    
    if (change > 0.05) return 'up';
    if (change < -0.05) return 'down';
    return 'sideways';
  }

  private calculateTrendStrength(lows: number[]): number {
    if (lows.length < 3) return 0;
    
    let strength = 0;
    for (let i = 1; i < lows.length; i++) {
      if (lows[i] > lows[i - 1]) strength++;
    }
    
    return (strength / (lows.length - 1)) * 100;
  }

  private calculateVolumeTrend(volumes: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (volumes.length < 3) return 'stable';
    
    const first = volumes[0];
    const last = volumes[volumes.length - 1];
    const change = (last - first) / first;
    
    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'stable';
  }

  private calculateBearishPressure(bars: DailyBar[]): number {
    let pressure = 0;
    for (const bar of bars) {
      if (bar.close < bar.open) pressure++;
    }
    return (pressure / bars.length) * 100;
  }

  private calculateBullishMomentum(bars: DailyBar[]): number {
    let momentum = 0;
    for (const bar of bars) {
      if (bar.close > bar.open) momentum++;
    }
    return (momentum / bars.length) * 100;
  }

  private createRejectedResult(
    reason: string,
    details: string,
    startTime: number,
    dailyCount: number,
    intradayCount: number
  ): AnalysisOutput {
    return {
      qualified: false,
      score: 0,
      failedAt: 1,
      reason: `${reason}: ${details}`,
      details: {
        consolidation: { pass: false, status: 'failed', reason, basePrice: 0, currentMove: 0, consolidationDays: 0, range: { high: 0, low: 0, range: 0, rangePercent: 0 } },
        higherLow: { pass: false, status: 'failed', reason, higherLowCount: 0, recentLows: [], trend: 'down' as const, strength: 0 },
        volumePump: { pass: false, status: 'failed', reason, volumeRatio: 0, averageVolume: 0, currentVolume: 0, volumeTrend: 'decreasing' as const },
        bearSqueeze: { pass: false, status: 'failed', reason, squeezeCount: 0, recentSqueezes: [], bearishPressure: 0, bullishMomentum: 0 },
        overall: { score: 0, grade: 'F', recommendation: 'sell', confidence: 0, riskLevel: 'high' }
      },
      analysisDurationMs: Date.now() - startTime,
      dataPointsDaily: dailyCount,
      dataPointsIntraday: intradayCount
    };
  }
}
