// src/services/CorrelationMatrixService.ts — Computes price correlation between stocks

import { BaseService } from './BaseService';
import { MarketDataService } from './MarketDataService';

export interface CorrelationPair {
  symbolA: string;
  symbolB: string;
  correlation: number; // -1 to +1
  strength: 'strong_positive' | 'positive' | 'neutral' | 'negative' | 'strong_negative';
}

export interface CorrelationMatrix {
  symbols: string[];
  period: number;
  matrix: number[][]; // [i][j] = correlation between symbols[i] and symbols[j]
  topCorrelated: CorrelationPair[];
  topInverse: CorrelationPair[];
}

export class CorrelationMatrixService extends BaseService {
  private marketData: MarketDataService;

  constructor(marketData: MarketDataService) {
    super('CorrelationMatrixService');
    this.marketData = marketData;
  }

  /**
   * Calculate Pearson correlation coefficient between two arrays
   */
  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 5) return 0;

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += x[i];
      sumY += y[i];
      sumXY += x[i] * y[i];
      sumX2 += x[i] * x[i];
      sumY2 += y[i] * y[i];
    }

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    if (denominator === 0) return 0;

    return Math.round((numerator / denominator) * 10000) / 10000;
  }

  /**
   * Convert daily closing prices to daily returns (percentage change)
   */
  private toReturns(closes: number[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
    return returns;
  }

  private classifyStrength(corr: number): CorrelationPair['strength'] {
    if (corr >= 0.7) return 'strong_positive';
    if (corr >= 0.3) return 'positive';
    if (corr <= -0.7) return 'strong_negative';
    if (corr <= -0.3) return 'negative';
    return 'neutral';
  }

  async computeMatrix(symbols: string[], days: number = 60): Promise<CorrelationMatrix> {
    if (symbols.length < 2) throw new Error('Need at least 2 symbols for correlation');
    if (symbols.length > 15) throw new Error('Maximum 15 symbols for performance');

    // 1. Fetch price data for all symbols in parallel
    const priceData = await Promise.all(
      symbols.map(async (sym) => {
        try {
          const result = await this.marketData.fetchDailyBars(sym, days);
          return { symbol: sym.toUpperCase(), closes: result.bars.map(b => b.close) };
        } catch {
          return { symbol: sym.toUpperCase(), closes: [] as number[] };
        }
      })
    );

    // 2. Convert to returns
    const returnsMap = new Map<string, number[]>();
    for (const pd of priceData) {
      if (pd.closes.length > 5) {
        returnsMap.set(pd.symbol, this.toReturns(pd.closes));
      }
    }

    const validSymbols = priceData.filter(p => returnsMap.has(p.symbol)).map(p => p.symbol);
    const n = validSymbols.length;

    // 3. Build correlation matrix
    const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    const pairs: CorrelationPair[] = [];

    for (let i = 0; i < n; i++) {
      matrix[i][i] = 1; // Self-correlation
      for (let j = i + 1; j < n; j++) {
        const returnsA = returnsMap.get(validSymbols[i])!;
        const returnsB = returnsMap.get(validSymbols[j])!;
        const corr = this.pearsonCorrelation(returnsA, returnsB);

        matrix[i][j] = corr;
        matrix[j][i] = corr;

        pairs.push({
          symbolA: validSymbols[i],
          symbolB: validSymbols[j],
          correlation: corr,
          strength: this.classifyStrength(corr),
        });
      }
    }

    // 4. Sort for insights
    const sorted = [...pairs].sort((a, b) => b.correlation - a.correlation);
    const topCorrelated = sorted.filter(p => p.correlation > 0).slice(0, 5);
    const topInverse = sorted.filter(p => p.correlation < 0).sort((a, b) => a.correlation - b.correlation).slice(0, 5);

    return {
      symbols: validSymbols,
      period: days,
      matrix,
      topCorrelated,
      topInverse,
    };
  }
}
