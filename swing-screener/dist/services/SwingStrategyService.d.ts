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
export declare class SwingStrategyService {
    private logger;
    constructor();
    private percentChange;
    private checkConsolidationPhase;
    private checkHigherLowStructure;
    private checkVolumePump;
    private checkBearSqueezeCandle;
    analyzeSwingStock(params: {
        dailyBars: DailyBar[];
    }): Promise<AnalysisResult>;
}
export { DailyBar, AnalysisResult };
//# sourceMappingURL=SwingStrategyService.d.ts.map