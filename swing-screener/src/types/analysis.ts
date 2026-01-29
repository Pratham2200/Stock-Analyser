// src/types/analysis.ts - Analysis-specific types for 4-Rule Swing Trading Strategy

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
  // Calculated indicators for storage
  calculatedIndicators?: {
    ema10Values: number[];
    ema20Values: number[];
    volumeAvgs: number[];
    volumeRatios: number[];
  };
  // Zone information for storage
  zones?: Array<{
    zoneNumber: number;
    startIndex: number;
    endIndex: number;
    startDate: string;
    endDate: string;
    zoneLow: number;
    barCount: number;
  }>;
}

export interface AnalysisDetails {
  consolidation: ConsolidationResult;
  higherLow: HigherLowResult;
  volumePump: VolumePumpResult;
  bearSqueeze: BearSqueezeResult;
  overall: OverallResult;
}

// Zone represents a period where price closed below the 10 EMA
export interface Zone {
  startIndex: number;
  endIndex: number;
  low: number;
}

// RULE 1: Consolidation Phase - Zone-based analysis
export interface ConsolidationResult {
  pass: boolean;
  status: string;
  reason: string;
  base: number;
  currentPrice: number;
  ema10Current: number;
  percentGain: number;
  zoneCount: number;
  zones: Zone[];
}

// RULE 2: Higher Low Structure - Zone lows comparison
export interface HigherLowResult {
  pass: boolean;
  status: string;
  reason: string;
  latestZoneLow: number;
  previousZoneLow: number;
  currentPrice: number;
  ema10Current: number;
  priceAboveEma?: boolean;
  priceAboveZoneLow?: boolean;
  zoneCount: number;
}

// RULE 3: Volume Pump - Individual bar spike detection
export interface VolumeSpikeDetails {
  barIndex: number;
  barDate: string | Date;
  volume: number;
  avgVolume: number;
  volumeRatio: number;
}

export interface VolumePumpResult {
  pass: boolean;
  status: string;
  reason: string;
  spikeDetails: VolumeSpikeDetails | null;
  threshold: number;
  windowSize: number;
}

// RULE 4: Bear Squeeze Candle - Lower wick analysis
export interface BearSqueezeResult {
  pass: boolean;
  status: string;
  reason: string;
  open: number;
  high: number;
  low: number;
  close: number;
  bodyLow: number;
  lowerWick: number;
  totalRange: number;
  wickPercent: number;
  threshold: number;
}

// Overall result with 4/4 scoring
export interface OverallResult {
  score: number;
  maxScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  recommendation: 'buy' | 'watch' | 'avoid';
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high';
  rulesPassedSummary: {
    consolidation: boolean;
    higherLow: boolean;
    volumePump: boolean;
    bearSqueeze: boolean;
  };
}

export interface StrategyConfig {
  consolidation: {
    windowDays: number;
    maxGainPercent: number;
    emaPeriod: number;
  };
  higherLow: {
    useZoneLows: boolean;
  };
  volumePump: {
    windowDays: number;
    multiplier: number;
  };
  bearSqueeze: {
    wickThresholdPercent: number;
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
