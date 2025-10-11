// src/types/analysis.ts - Analysis-specific types

export interface DailyBar {
  date: string | Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface AnalysisInput {
  symbol: string;
  dailyBars: DailyBar[];
  intradayBars?: DailyBar[];
}

export interface AnalysisOutput {
  qualified: boolean;
  score: number;
  failedAt: number;
  reason: string;
  currentPrice?: number;
  ema10?: number;
  ema20?: number;
  details: AnalysisDetails;
  analysisDurationMs: number;
  dataPointsDaily: number;
  dataPointsIntraday: number;
}

export interface AnalysisDetails {
  consolidation: ConsolidationResult;
  higherLow: HigherLowResult;
  volumePump: VolumePumpResult;
  bearSqueeze: BearSqueezeResult;
  overall: OverallResult;
}

export interface ConsolidationResult {
  pass: boolean;
  status: string;
  reason: string;
  basePrice: number | null;
  currentMove: number;
  consolidationDays: number;
  range: {
    high: number;
    low: number;
    range: number;
    rangePercent: number;
  };
}

export interface HigherLowResult {
  pass: boolean;
  status: string;
  reason: string;
  higherLowCount: number;
  recentLows: number[];
  trend: 'up' | 'down' | 'sideways';
  strength: number;
}

export interface VolumePumpResult {
  pass: boolean;
  status: string;
  reason: string;
  volumeRatio: number;
  averageVolume: number;
  currentVolume: number;
  volumeTrend: 'increasing' | 'decreasing' | 'stable';
}

export interface BearSqueezeResult {
  pass: boolean;
  status: string;
  reason: string;
  squeezeCount: number;
  recentSqueezes: number[];
  bearishPressure: number;
  bullishMomentum: number;
}

export interface OverallResult {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface StrategyConfig {
  consolidation: {
    minDays: number;
    maxRangePercent: number;
    minVolume: number;
  };
  higherLow: {
    minCount: number;
    maxDays: number;
    minStrength: number;
  };
  volumePump: {
    minRatio: number;
    minVolume: number;
    trendDays: number;
  };
  bearSqueeze: {
    minCount: number;
    maxDays: number;
    minPressure: number;
  };
}

export interface AnalysisMetrics {
  totalAnalyzed: number;
  qualified: number;
  rejected: number;
  successRate: number;
  averageScore: number;
  averageDuration: number;
  failureReasons: Record<string, number>;
}

export interface BatchAnalysisResult {
  results: AnalysisOutput[];
  metrics: AnalysisMetrics;
  duration: number;
  errors: string[];
}
