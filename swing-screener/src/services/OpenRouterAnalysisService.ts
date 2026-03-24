// src/services/OpenRouterAnalysisService.ts - AI Analysis using OpenRouter
// Tertiary fallback provider when Gemini and Groq fail

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
    RulesAnalysis
} from '../types/ai';

export class OpenRouterAnalysisService extends BaseService {
    private apiKey: string;
    private modelName: string;

    constructor(apiKey: string, model?: string) {
        super('OpenRouterAnalysisService');
        this.apiKey = apiKey;
        this.modelName = model || 'meta-llama/llama-3.3-70b-instruct:free'; // Confirmed free model on OpenRouter
        this.logger.info(`OpenRouter fallback initialized with model: ${this.modelName}`);
    }

    /**
     * Analyze a stock using OpenRouter as tertiary fallback provider
     */
    async analyzeStock(input: AIAnalysisInput): Promise<AIAnalysisOutput> {
        const startTime = Date.now();
        const requestTimestamp = new Date();

        // Build the same prompt as Gemini/Groq
        const prompt = this.buildPrompt(input.stockData, input.layerType);

        const log: AIApiLog = {
            stockId: input.stockId,
            scanId: input.scanId,
            requestTimestamp,
            provider: 'openrouter',
            model: this.modelName,
            endpoint: 'https://openrouter.ai/api/v1/chat/completions',
            requestPayload: { model: this.modelName, messages: [{ role: 'user', content: prompt }] },
            retryCount: 0,
        };

        try {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://stock-analyser.local', // Required by OpenRouter
                    'X-Title': 'Stock Analyser Pro'
                },
                body: JSON.stringify({
                    model: this.modelName,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a senior swing trading analyst. Follow the response format exactly as instructed.'
                        },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.2,
                    max_tokens: 1024,
                })
            });

            if (!response.ok) {
                const err: any = new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
                err.status = response.status;
                throw err;
            }

            const data = await response.json();
            const responseTimestamp = new Date();
            const text = data.choices?.[0]?.message?.content || '';

            log.responseTimestamp = responseTimestamp;
            log.responseStatus = 200;
            log.responsePayload = { text, usage: data.usage };
            log.promptTokens = data.usage?.prompt_tokens || 0;
            log.completionTokens = data.usage?.completion_tokens || 0;
            log.totalTokens = data.usage?.total_tokens || 0;
            log.latencyMs = Date.now() - startTime;
            log.estimatedCost = 0; // Assuming free models used

            const parsed = this.parseResponse(text, input.layerType);

            const finalStatus = this.determineFinalStatus(
                parsed.decision,
                input.layerType,
                input.sourceDecision
            );

            const result: AIAnalysisResult = {
                stockId: input.stockId,
                scanId: input.scanId,
                configId: input.layerType === 'rejection_review' ? 1 : 2,
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

            this.logger.info(`OpenRouter Analysis complete for stock ${input.stockId}: ${parsed.decision} (${parsed.confidence}% confidence)`);

            return { success: true, result, log };

        } catch (error: any) {
            const statusCode: number = error?.status || error?.statusCode || 500;
            const errorMessage = `${statusCode} ${(error as Error).message || 'OpenRouter request failed'}`;
            log.responseTimestamp = new Date();
            log.responseStatus = statusCode;
            log.errorMessage = errorMessage;
            log.latencyMs = Date.now() - startTime;

            this.logger.error(`OpenRouter Analysis failed for stock ${input.stockId}:`, error);
            return { success: false, log, error: errorMessage };
        }
    }

    /**
     * Build prompt - identical to Gemini/Groq prompts for consistency
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
     * Parse AI response text - same logic as Gemini/Groq
     */
    private parseResponse(text: string, layerType: AILayerType): ParsedAIResponse {
        const decisionMatch = text.match(/DECISION:\s*(PASS|REJECT|FAIL)/i);
        let decision: AIDecision = 'uncertain';
        if (decisionMatch) {
            const d = decisionMatch[1].toUpperCase();
            decision = d === 'PASS' ? 'passed' : 'rejected';
        }

        const confidenceMatch = text.match(/CONFIDENCE:\s*(\d+)/);
        const confidence = parseInt(confidenceMatch?.[1] || '50');

        const reasoningMatch = text.match(/REASONING:\s*(.+?)(?=OBSERVATION_PRIORITY|TRADE_QUALITY|RISK_FACTORS|$)/s);
        const reasoning = reasoningMatch?.[1]?.trim() || 'No reasoning provided';

        const rulesAnalysis = this.parseRulesAnalysis(text);

        return {
            decision,
            confidence,
            rulesAnalysis,
            reasoning,
        };
    }

    private parseRulesAnalysis(text: string): RulesAnalysis {
        const defaultRule = { status: 'FAIL' as const, reason: 'Not analyzed' };

        const parseRule = (ruleNum: number): { status: any; reason: string } => {
            const pattern = new RegExp(`Rule ${ruleNum}[^:]*:\\s*(\\w+)\\s*-\\s*(.+?)(?=\\n|Rule|$)`, 'i');
            const match = text.match(pattern);
            if (match) {
                return { status: match[1].toUpperCase(), reason: match[2].trim() };
            }
            return defaultRule;
        };

        return {
            consolidation: parseRule(1),
            higherLow: parseRule(2),
            volumePump: parseRule(3),
            bearSqueeze: parseRule(4),
        };
    }

    private determineFinalStatus(
        aiDecision: AIDecision,
        layerType: AILayerType,
        sourceDecision: string
    ): FinalStatus {
        if (layerType === 'rejection_review') {
            return aiDecision === 'passed' ? 'observation' : 'rejected';
        } else {
            return aiDecision === 'passed' ? 'selected' : 'observation';
        }
    }
}
