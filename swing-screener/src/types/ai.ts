// src/types/ai.ts - Type definitions for AI analysis layers

/**
 * AI Layer Types
 */
export type AILayerType = 'rejection_review' | 'selection_validation';
export type AIDecision = 'passed' | 'rejected' | 'uncertain';
export type FinalStatus = 'selected' | 'observation' | 'rejected';
export type ObservationStatus = 'pending' | 'in_review' | 'completed' | 'expired';
export type UserDecision = 'approved' | 'rejected' | 'pending';
export type RuleQuality = 'STRONG' | 'WEAK' | 'PASS' | 'CLOSE' | 'FAIL';
export type TradeQuality = 'EXCELLENT' | 'GOOD' | 'MARGINAL';
export type ObservationPriority = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * AI Configuration stored in database
 */
export interface AIAnalysisConfig {
    id: number;
    layerType: AILayerType;
    provider: string;
    modelName: string;
    apiEndpoint?: string;
    promptTemplate: string;
    temperature: number;
    maxTokens: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * AI Analysis Result stored in database
 */
export interface AIAnalysisResult {
    id?: number;
    stockId: number;
    scanId: number;
    configId: number;
    layerType: AILayerType;
    sourceDecision: string;
    aiDecision: AIDecision;
    confidenceScore: number;
    reasoning: string;
    keyFactors: RulesAnalysis;
    finalStatus: FinalStatus;
    tokensUsed: number;
    processingTimeMs: number;
    rawResponse: object;
    createdAt?: Date;
}

/**
 * Observation Queue Entry
 */
export interface ObservationQueueEntry {
    id?: number;
    stockId: number;
    scanId: number;
    aiAnalysisId: number;
    source: string;
    priority: number;
    userDecision?: UserDecision;
    userNotes?: string;
    reviewedBy?: string;
    reviewedAt?: Date;
    status: ObservationStatus;
    expiresAt?: Date;
    createdAt?: Date;
    updatedAt?: Date;
}

/**
 * AI API Log Entry for request/response tracking
 */
export interface AIApiLog {
    id?: number;
    stockId: number;
    scanId: number;
    aiResultId?: number;
    requestTimestamp: Date;
    provider: string;
    model: string;
    endpoint?: string;
    requestPayload: object;
    promptTokens?: number;
    responseTimestamp?: Date;
    responseStatus?: number;
    responsePayload?: object;
    completionTokens?: number;
    totalTokens?: number;
    latencyMs?: number;
    estimatedCost?: number;
    errorCode?: string;
    errorMessage?: string;
    retryCount: number;
    createdAt?: Date;
}

/**
 * Parsed AI Response
 */
export interface ParsedAIResponse {
    decision: AIDecision;
    confidence: number;
    rulesAnalysis: RulesAnalysis;
    reasoning: string;
    tradeQuality?: TradeQuality;
    riskFactors?: string[];
    observationPriority?: ObservationPriority;
}

/**
 * Rules Analysis from AI
 */
export interface RulesAnalysis {
    consolidation: {
        status: RuleQuality;
        reason: string;
    };
    higherLow: {
        status: RuleQuality;
        reason: string;
    };
    volumePump: {
        status: RuleQuality;
        reason: string;
    };
    bearSqueeze: {
        status: RuleQuality;
        reason: string;
    };
}

/**
 * Stock data to send to AI for analysis
 */
export interface StockDataForAI {
    symbol: string;
    name: string;
    currentPrice: number;
    ema10: number;
    ema20: number;

    // Rule 1: Consolidation
    consolidation: {
        pass: boolean;
        base: number;
        percentGain: number;
        zoneCount: number;
        zones: Array<{
            startDate: string;
            endDate: string;
            low: number;
        }>;
    };

    // Rule 2: Higher Low
    higherLow: {
        pass: boolean;
        latestZoneLow: number;
        previousZoneLow: number;
        priceAboveEma: boolean;
        priceAboveZoneLow: boolean;
    };

    // Rule 3: Volume Pump
    volumePump: {
        pass: boolean;
        volumeRatio?: number;
        spikeDate?: string;
    };

    // Rule 4: Bear Squeeze
    bearSqueeze: {
        pass: boolean;
        wickPercent: number;
        open: number;
        high: number;
        low: number;
        close: number;
    };

    // Overall
    score: number;
    failReason?: string;
}

/**
 * Input for AI analysis service
 */
export interface AIAnalysisInput {
    stockId: number;
    scanId: number;
    stockData: StockDataForAI;
    layerType: AILayerType;
    sourceDecision: 'code_rejected' | 'code_selected';
}

/**
 * Output from AI analysis service
 */
export interface AIAnalysisOutput {
    success: boolean;
    result?: AIAnalysisResult;
    log: AIApiLog;
    error?: string;
}

/**
 * Gemini API Request format
 */
export interface GeminiRequest {
    contents: Array<{
        parts: Array<{
            text: string;
        }>;
    }>;
    generationConfig: {
        temperature: number;
        topP: number;
        topK: number;
        maxOutputTokens: number;
    };
}

/**
 * Gemini API Response format
 */
export interface GeminiResponse {
    candidates: Array<{
        content: {
            parts: Array<{
                text: string;
            }>;
        };
        finishReason: string;
    }>;
    usageMetadata: {
        promptTokenCount: number;
        candidatesTokenCount: number;
        totalTokenCount: number;
    };
}
