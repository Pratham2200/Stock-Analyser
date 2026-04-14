// src/services/MultiTimeframeService.ts — Aggregates signals across daily, weekly, monthly timeframes

import { BaseService } from './BaseService';
import { MarketDataService } from './MarketDataService';
import { RSI, EMA, MACD, BollingerBands } from 'technicalindicators';

export interface TimeframeSignal {
  timeframe: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  rsi: number;
  emaFast: number;
  emaSlow: number;
  macdHistogram: number;
  priceVsEma: 'ABOVE' | 'BELOW';
}

export interface MultiTimeframeAnalysis {
  symbol: string;
  currentPrice: number;
  signals: TimeframeSignal[];
  overallBias: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
  confluenceScore: number; // 0-100
}

export class MultiTimeframeService extends BaseService {
  private marketData: MarketDataService;

  constructor(marketData: MarketDataService) {
    super('MultiTimeframeService');
    this.marketData = marketData;
  }

  async analyze(symbol: string): Promise<MultiTimeframeAnalysis> {
    const symbolUpper = symbol.toUpperCase();

    // Fetch enough data for monthly analysis (252 trading days ~ 1 year)
    const chartResult = await this.marketData.fetchDailyBarsWithQuote(symbolUpper, 252);
    const bars = chartResult.bars;

    if (bars.length < 60) {
      throw new Error(`Insufficient data for multi-timeframe analysis of ${symbolUpper}`);
    }

    const dailyCloses = bars.map(b => b.close);
    const currentPrice = dailyCloses[dailyCloses.length - 1];

    // Daily signal (last 30 bars)
    const dailySignal = this.computeSignal(dailyCloses, 'DAILY');

    // Weekly signal (aggregate to weekly bars)
    const barsWithStringDate = bars.map(b => ({ date: String(b.date), close: b.close }));
    const weeklyCloses = this.aggregateToWeekly(barsWithStringDate);
    const weeklySignal = this.computeSignal(weeklyCloses, 'WEEKLY');

    // Monthly signal (aggregate to monthly bars)
    const monthlyCloses = this.aggregateToMonthly(barsWithStringDate);
    const monthlySignal = this.computeSignal(monthlyCloses, 'MONTHLY');

    const signals = [dailySignal, weeklySignal, monthlySignal];

    // Calculate confluence score
    const trendScores: number[] = signals.map(s =>
      s.trend === 'BULLISH' ? 1 : s.trend === 'BEARISH' ? -1 : 0
    );
    const totalScore = trendScores.reduce((a, b) => a + b, 0);
    const confluenceScore = Math.round(((totalScore + 3) / 6) * 100); // Normalize to 0-100

    let overallBias: MultiTimeframeAnalysis['overallBias'] = 'NEUTRAL';
    if (totalScore === 3) overallBias = 'STRONG_BUY';
    else if (totalScore === 2) overallBias = 'BUY';
    else if (totalScore === -2) overallBias = 'SELL';
    else if (totalScore === -3) overallBias = 'STRONG_SELL';

    return {
      symbol: symbolUpper,
      currentPrice,
      signals,
      overallBias,
      confluenceScore,
    };
  }

  private computeSignal(closes: number[], timeframe: TimeframeSignal['timeframe']): TimeframeSignal {
    const currentPrice = closes[closes.length - 1];

    // RSI(14)
    const rsiValues = RSI.calculate({ period: 14, values: closes });
    const rsi = rsiValues.length > 0 ? Math.round(rsiValues[rsiValues.length - 1] * 100) / 100 : 50;

    // EMA(10) and EMA(20)
    const emaFastValues = EMA.calculate({ period: 10, values: closes });
    const emaSlowValues = EMA.calculate({ period: 20, values: closes });
    const emaFast = emaFastValues.length > 0 ? Math.round(emaFastValues[emaFastValues.length - 1] * 100) / 100 : currentPrice;
    const emaSlow = emaSlowValues.length > 0 ? Math.round(emaSlowValues[emaSlowValues.length - 1] * 100) / 100 : currentPrice;

    // MACD
    const macdValues = MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });
    const macdHistogram = macdValues.length > 0 ? (macdValues[macdValues.length - 1].histogram ?? 0) : 0;

    const priceVsEma: 'ABOVE' | 'BELOW' = currentPrice > emaSlow ? 'ABOVE' : 'BELOW';

    // Determine trend
    let bullishPoints = 0;
    if (rsi > 50) bullishPoints++;
    if (emaFast > emaSlow) bullishPoints++;
    if (macdHistogram > 0) bullishPoints++;
    if (priceVsEma === 'ABOVE') bullishPoints++;

    const trend: TimeframeSignal['trend'] =
      bullishPoints >= 3 ? 'BULLISH' :
      bullishPoints <= 1 ? 'BEARISH' : 'NEUTRAL';

    return { timeframe, trend, rsi, emaFast, emaSlow, macdHistogram: Math.round(macdHistogram * 100) / 100, priceVsEma };
  }

  private aggregateToWeekly(bars: { date: string; close: number }[]): number[] {
    const weekly: number[] = [];
    let weekEnd = -1;
    for (const bar of bars) {
      const dayOfWeek = new Date(bar.date).getDay();
      if (dayOfWeek <= weekEnd && weekly.length > 0) {
        weekly[weekly.length - 1] = bar.close; // Update current week's close
      } else {
        weekly.push(bar.close);
      }
      weekEnd = dayOfWeek;
    }
    return weekly;
  }

  private aggregateToMonthly(bars: { date: string; close: number }[]): number[] {
    const monthly: number[] = [];
    let currentMonth = '';
    for (const bar of bars) {
      const month = bar.date.substring(0, 7); // YYYY-MM
      if (month !== currentMonth) {
        monthly.push(bar.close);
        currentMonth = month;
      } else {
        monthly[monthly.length - 1] = bar.close;
      }
    }
    return monthly;
  }
}
