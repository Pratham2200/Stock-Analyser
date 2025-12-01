import { BaseService } from './BaseService';
import { AnalysisInput, AnalysisOutput } from '../types/analysis';
export declare class StockAnalysisService extends BaseService {
    private swingStrategyService;
    constructor();
    analyzeStock(input: AnalysisInput): Promise<AnalysisOutput>;
    private analyzeWithSwingStrategy;
    private mapFailureStep;
    private convertSwingDetailsToAnalysisDetails;
    private performAnalysis;
    private checkConsolidationPhase;
    private checkHigherLowStructure;
    private checkVolumePump;
    private checkBearSqueeze;
    private calculateOverallScore;
    private determineQualification;
    private getFailureStep;
    private getFailureReason;
    private calculateOverallResult;
    private calculateTrend;
    private calculateTrendStrength;
    private calculateVolumeTrend;
    private calculateBearishPressure;
    private calculateBullishMomentum;
    private createRejectedResult;
}
//# sourceMappingURL=StockAnalysisService.d.ts.map