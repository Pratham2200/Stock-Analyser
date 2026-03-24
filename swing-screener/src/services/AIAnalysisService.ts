// src/services/AIAnalysisService.ts - AI Analysis using Google Gemini
// Implements 2-layer AI verification for stock analysis

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { BaseService } from './BaseService';
import {
    AILayerType,
    AIDecision,
    FinalStatus,
    AIAnalysisInput,
    AIAnalysisOutput,
    AIAnalysisResult,
    AIApiLog,
    ParsedAIResponse,
    StockDataForAI,
    RulesAnalysis,
    AIAnalysisConfig
} from '../types/ai';

export class AIAnalysisService extends BaseService {
    private genAI: GoogleGenerativeAI;
    private model: GenerativeModel;
    private readonly MODEL_NAME = 'gemini-2.0-flash';

    constructor(apiKey?: string) {
        super('AIAnalysisService');

        const key = apiKey || process.env.GEMINI_API_KEY;
        if (!key) {
            throw new Error('GEMINI_API_KEY is required');
        }

        this.genAI = new GoogleGenerativeAI(key);
        this.model = this.genAI.getGenerativeModel({
            model: this.MODEL_NAME,
            generationConfig: {
                temperature: 0.2,
                topP: 0.8,
                topK: 40,
                maxOutputTokens: 1024,
            },
        });
    }

    /**
     * Generic content generation using Gemini Fast Flash
     */
    async generateContent(prompt: string, messages?: Array<{role: string, content: string}>): Promise<string> {
        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            this.logger.error('Error generating AI content:', error);
            throw error;
        }
    }

    /**
     * Analyze a stock using AI layer 1 or layer 2
     */
    async analyzeStock(input: AIAnalysisInput): Promise<AIAnalysisOutput> {
        const startTime = Date.now();
        const requestTimestamp = new Date();

        // Build the prompt
        const prompt = this.buildPrompt(input.stockData, input.layerType);

        // Create request payload for logging
        const requestPayload = {
            model: this.MODEL_NAME,
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.2,
                topP: 0.8,
                topK: 40,
                maxOutputTokens: 1024,
            },
        };

        // Initialize log entry
        const log: AIApiLog = {
            stockId: input.stockId,
            scanId: input.scanId,
            requestTimestamp,
            provider: 'google_gemini',
            model: this.MODEL_NAME,
            endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
            requestPayload,
            retryCount: 0,
        };

        try {
            // Call Gemini API
            const response = await this.model.generateContent(prompt);
            const responseTimestamp = new Date();
            const text = response.response.text();

            // Update log with response
            log.responseTimestamp = responseTimestamp;
            log.responseStatus = 200;
            log.responsePayload = {
                text,
                candidates: response.response.candidates,
                usageMetadata: response.response.usageMetadata,
            };
            log.promptTokens = response.response.usageMetadata?.promptTokenCount || 0;
            log.completionTokens = response.response.usageMetadata?.candidatesTokenCount || 0;
            log.totalTokens = response.response.usageMetadata?.totalTokenCount || 0;
            log.latencyMs = Date.now() - startTime;
            log.estimatedCost = this.calculateCost(log.promptTokens, log.completionTokens);

            // Parse the AI response
            const parsed = this.parseResponse(text, input.layerType);

            // Determine final status based on decision and layer type
            const finalStatus = this.determineFinalStatus(
                parsed.decision,
                input.layerType,
                input.sourceDecision
            );

            // Create the result
            const result: AIAnalysisResult = {
                stockId: input.stockId,
                scanId: input.scanId,
                configId: input.layerType === 'rejection_review' ? 1 : 2, // Will be overridden by getActiveConfig() in orchestrator
                layerType: input.layerType,
                sourceDecision: input.sourceDecision,
                aiDecision: parsed.decision,
                confidenceScore: parsed.confidence,
                reasoning: parsed.reasoning,
                keyFactors: parsed.rulesAnalysis,
                finalStatus,
                tokensUsed: log.totalTokens || 0,
                processingTimeMs: log.latencyMs,
                rawResponse: log.responsePayload,
            };

            this.logger.info(`AI Analysis complete for stock ${input.stockId}: ${parsed.decision} (${parsed.confidence}% confidence)`);

            return {
                success: true,
                result,
                log,
            };

        } catch (error: any) {
            // Extract real HTTP status code — Gemini SDK throws objects with .status
            const statusCode: number = error?.status || error?.statusCode || error?.error?.status || 500;
            const errorMessage = `${statusCode} ${(error as Error).message || JSON.stringify(error?.error || error)}`;
            log.responseTimestamp = new Date();
            log.responseStatus = statusCode;
            log.errorMessage = errorMessage;
            log.latencyMs = Date.now() - startTime;

            this.logger.error(`AI Analysis failed for stock ${input.stockId}:`, error);

            return {
                success: false,
                log,
                error: errorMessage,
            };
        }
    }

    /**
     * Build prompt based on layer type and stock data
     */
    private buildPrompt(stockData: StockDataForAI, layerType: AILayerType): string {
        const stockDataJson = JSON.stringify(stockData, null, 2);

        if (layerType === 'rejection_review') {
            return `You are a senior swing trading analyst using the 4-RULE STRATEGY. A stock was rejected by the automated screener. Your job is to determine if it deserves manual observation.

=== THE 4-RULE SWING TRADING STRATEGY ===

RULE 1: CONSOLIDATION PHASE
- Detect "zones" where daily close < 10 EMA (within last 60 days)
- Base = minimum of all zone lows
- PASS if currentPrice < base + 30%
- FAIL if no zones exist OR gain >= 30%

RULE 2: HIGHER LOW STRUCTURE  
- Compare latest zone low vs previous zone low
- PASS if latestZoneLow >= previousZoneLow
- FAIL if price < EMA AND price < latestZoneLow (breakdown)
- Single zone: PASS if currentPrice > zoneLow

RULE 3: VOLUME PUMP
- Scan last 20 bars
- For each bar, calculate its preceding 20-bar volume average
- PASS if ANY bar has volume >= 1.8x its preceding average
- FAIL if no volume spike found

RULE 4: BEAR SQUEEZE CANDLE (TODAY'S BAR ONLY)
- bodyLow = min(open, close)
- lowerWick = bodyLow - low
- totalRange = high - low
- wickPercent = (lowerWick / totalRange) * 100
- PASS if wickPercent >= 40%

=== YOUR TASK ===
The code REJECTED this stock, but some rules may have narrowly failed. Analyze if:
1. Any failed rule is close to passing (marginal failure)
2. The overall pattern still looks promising for a swing trade
3. There are external factors the code might have missed

=== STOCK DATA ===
${stockDataJson}

=== RESPOND IN THIS EXACT FORMAT ===
DECISION: [PASS | REJECT]
CONFIDENCE: [0-100]%
RULES_ANALYSIS:
- Rule 1 (Consolidation): [PASS/CLOSE/FAIL] - [brief reason]
- Rule 2 (Higher Low): [PASS/CLOSE/FAIL] - [brief reason]
- Rule 3 (Volume Pump): [PASS/CLOSE/FAIL] - [brief reason]
- Rule 4 (Bear Squeeze): [PASS/CLOSE/FAIL] - [brief reason]
REASONING: [2-3 sentences explaining your overall decision]
OBSERVATION_PRIORITY: [HIGH | MEDIUM | LOW] (if PASS)`;
        } else {
            return `You are a senior swing trading analyst using the 4-RULE STRATEGY. A stock PASSED all 4 rules in the automated screener. Your job is to validate it's truly a high-quality trade setup.

=== THE 4-RULE SWING TRADING STRATEGY ===

RULE 1: CONSOLIDATION PHASE
- Detect "zones" where daily close < 10 EMA (within last 60 days)
- Base = minimum of all zone lows
- PASS if currentPrice < base + 30%
- FAIL if no zones exist OR gain >= 30%

RULE 2: HIGHER LOW STRUCTURE  
- Compare latest zone low vs previous zone low
- PASS if latestZoneLow >= previousZoneLow
- FAIL if price < EMA AND price < latestZoneLow (breakdown)
- Single zone: PASS if currentPrice > zoneLow

RULE 3: VOLUME PUMP
- Scan last 20 bars
- For each bar, calculate its preceding 20-bar volume average
- PASS if ANY bar has volume >= 1.8x its preceding average
- FAIL if no volume spike found

RULE 4: BEAR SQUEEZE CANDLE (TODAY'S BAR ONLY)
- bodyLow = min(open, close)
- lowerWick = bodyLow - low
- totalRange = high - low
- wickPercent = (lowerWick / totalRange) * 100
- PASS if wickPercent >= 40%

=== VALIDATION CHECKLIST ===
1. All 4 rules genuinely passed (not edge cases)
2. Consolidation base is a true support level
3. Higher low structure is clear and well-defined
4. Volume spike was on an UP day (bullish)
5. Bear squeeze shows genuine buying pressure
6. No major resistance above current price
7. Risk/Reward ratio looks favorable (>2:1)

=== STOCK DATA ===
${stockDataJson}

=== RESPOND IN THIS EXACT FORMAT ===
DECISION: [PASS | FAIL]
CONFIDENCE: [0-100]%
RULES_QUALITY:
- Rule 1 (Consolidation): [STRONG/WEAK] - [brief reason]
- Rule 2 (Higher Low): [STRONG/WEAK] - [brief reason]
- Rule 3 (Volume Pump): [STRONG/WEAK] - [brief reason]
- Rule 4 (Bear Squeeze): [STRONG/WEAK] - [brief reason]
TRADE_QUALITY: [EXCELLENT | GOOD | MARGINAL]
RISK_FACTORS: [List any concerns]
REASONING: [2-3 sentences explaining your validation]`;
        }
    }

    /**
     * Parse AI response text into structured data
     */
    private parseResponse(text: string, layerType: AILayerType): ParsedAIResponse {
        // Extract decision
        const decisionMatch = text.match(/DECISION:\s*(PASS|REJECT|FAIL)/i);
        let decision: AIDecision = 'uncertain';
        if (decisionMatch) {
            const d = decisionMatch[1].toUpperCase();
            decision = d === 'PASS' ? 'passed' : 'rejected';
        }

        // Extract confidence
        const confidenceMatch = text.match(/CONFIDENCE:\s*(\d+)/);
        const confidence = parseInt(confidenceMatch?.[1] || '50');

        // Extract reasoning
        const reasoningMatch = text.match(/REASONING:\s*(.+?)(?=OBSERVATION_PRIORITY|TRADE_QUALITY|RISK_FACTORS|$)/s);
        const reasoning = reasoningMatch?.[1]?.trim() || 'No reasoning provided';

        // Extract rules analysis
        const rulesAnalysis = this.parseRulesAnalysis(text, layerType);

        // Extract trade quality (layer 2 only)
        const tradeQualityMatch = text.match(/TRADE_QUALITY:\s*(EXCELLENT|GOOD|MARGINAL)/i);
        const tradeQuality = tradeQualityMatch?.[1]?.toUpperCase() as 'EXCELLENT' | 'GOOD' | 'MARGINAL' | undefined;

        // Extract observation priority (layer 1 only)
        const priorityMatch = text.match(/OBSERVATION_PRIORITY:\s*(HIGH|MEDIUM|LOW)/i);
        const observationPriority = priorityMatch?.[1]?.toUpperCase() as 'HIGH' | 'MEDIUM' | 'LOW' | undefined;

        // Extract risk factors
        const riskMatch = text.match(/RISK_FACTORS:\s*(.+?)(?=REASONING|$)/s);
        const riskFactors = riskMatch?.[1]?.split(',').map(r => r.trim()).filter(r => r) || [];

        return {
            decision,
            confidence,
            rulesAnalysis,
            reasoning,
            tradeQuality,
            observationPriority,
            riskFactors,
        };
    }

    /**
     * Parse rules analysis from AI response
     */
    private parseRulesAnalysis(text: string, layerType: AILayerType): RulesAnalysis {
        const defaultRule = { status: 'FAIL' as const, reason: 'Not analyzed' };

        const parseRule = (ruleNum: number, ruleName: string): { status: any; reason: string } => {
            const pattern = new RegExp(`Rule ${ruleNum}[^:]*:\\s*(\\w+)\\s*-\\s*(.+?)(?=\\n|Rule|$)`, 'i');
            const match = text.match(pattern);
            if (match) {
                return {
                    status: match[1].toUpperCase(),
                    reason: match[2].trim(),
                };
            }
            return defaultRule;
        };

        return {
            consolidation: parseRule(1, 'Consolidation'),
            higherLow: parseRule(2, 'Higher Low'),
            volumePump: parseRule(3, 'Volume Pump'),
            bearSqueeze: parseRule(4, 'Bear Squeeze'),
        };
    }

    /**
     * Determine final status based on AI decision and layer type
     */
    private determineFinalStatus(
        aiDecision: AIDecision,
        layerType: AILayerType,
        sourceDecision: string
    ): FinalStatus {
        if (layerType === 'rejection_review') {
            // Layer 1: Reviewing rejected stocks
            if (aiDecision === 'passed') {
                return 'observation'; // AI thinks it deserves a second look
            } else {
                return 'rejected'; // AI confirms rejection
            }
        } else {
            // Layer 2: Validating selected stocks
            if (aiDecision === 'passed') {
                return 'selected'; // AI confirms selection
            } else {
                return 'observation'; // AI thinks it needs manual review
            }
        }
    }

    /**
     * Calculate estimated cost based on Gemini pricing
     * Flash: $0.10/1M input tokens, $0.40/1M output tokens
     */
    private calculateCost(promptTokens: number, completionTokens: number): number {
        const inputCost = (promptTokens / 1_000_000) * 0.10;
        const outputCost = (completionTokens / 1_000_000) * 0.40;
        return inputCost + outputCost;
    }

    /**
     * Convert existing analysis details to StockDataForAI format
     */
    static convertToAIFormat(
        symbol: string,
        name: string,
        analysisDetails: any
    ): StockDataForAI {
        return {
            symbol,
            name,
            currentPrice: analysisDetails.consolidation?.currentPrice || 0,
            ema10: analysisDetails.consolidation?.ema10Current || 0,
            ema20: 0, // Not in current analysis

            consolidation: {
                pass: analysisDetails.consolidation?.pass || false,
                base: analysisDetails.consolidation?.base || 0,
                percentGain: analysisDetails.consolidation?.percentGain || 0,
                zoneCount: analysisDetails.consolidation?.zoneCount || 0,
                zones: (analysisDetails.consolidation?.zones || []).map((z: any) => ({
                    startDate: z.startDate || '',
                    endDate: z.endDate || '',
                    low: z.low || z.zoneLow || 0,
                })),
            },

            higherLow: {
                pass: analysisDetails.higherLow?.pass || false,
                latestZoneLow: analysisDetails.higherLow?.latestZoneLow || 0,
                previousZoneLow: analysisDetails.higherLow?.previousZoneLow || 0,
                priceAboveEma: analysisDetails.higherLow?.priceAboveEma || false,
                priceAboveZoneLow: analysisDetails.higherLow?.priceAboveZoneLow || false,
            },

            volumePump: {
                pass: analysisDetails.volumePump?.pass || false,
                volumeRatio: analysisDetails.volumePump?.spikeDetails?.volumeRatio,
                spikeDate: analysisDetails.volumePump?.spikeDetails?.barDate,
            },

            bearSqueeze: {
                pass: analysisDetails.bearSqueeze?.pass || false,
                wickPercent: analysisDetails.bearSqueeze?.wickPercent || 0,
                open: analysisDetails.bearSqueeze?.open || 0,
                high: analysisDetails.bearSqueeze?.high || 0,
                low: analysisDetails.bearSqueeze?.low || 0,
                close: analysisDetails.bearSqueeze?.close || 0,
            },

            score: analysisDetails.overall?.score || 0,
            failReason: analysisDetails.overall?.recommendation === 'avoid'
                ? 'Not all rules passed'
                : undefined,
        };
    }
}
