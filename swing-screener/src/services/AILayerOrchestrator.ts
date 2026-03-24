// src/services/AILayerOrchestrator.ts - Orchestrates AI analysis layers
// Uses AIRateLimitService (DB-backed) to skip providers that are rate-limited,
// and records 429s + successes so the state persists across restarts.

import { Pool } from 'pg';
import { BaseService } from './BaseService';
import { AIAnalysisService } from './AIAnalysisService';
import { GroqAnalysisService } from './GroqAnalysisService';
import { OpenRouterAnalysisService } from './OpenRouterAnalysisService';
import { AIRateLimitService } from './AIRateLimitService';
import { AIRepository } from '../repositories/AIRepository';
import { AppConfig } from '../types';
import {
    AILayerType,
    AIAnalysisInput,
    AIAnalysisOutput,
    StockDataForAI,
    FinalStatus
} from '../types/ai';

interface StockAnalysisData {
    stockId: number;
    scanId: number;
    symbol: string;
    name: string;
    qualified: boolean;
    analysisDetails: any;
}

interface AIOrchestrationResult {
    stockId: number;
    symbol: string;
    originalDecision: 'selected' | 'rejected';
    aiLayerProcessed: AILayerType | null;
    aiDecision: string | null;
    confidence: number | null;
    finalStatus: FinalStatus;
    addedToObservation: boolean;
    error?: string;
}

export class AILayerOrchestrator extends BaseService {
    private aiService: AIAnalysisService | null = null;
    private groqService: GroqAnalysisService | null = null;
    private openRouterService: OpenRouterAnalysisService | null = null;
    private aiRepository: AIRepository | null = null;
    private rateLimitService: AIRateLimitService;
    private enabled: boolean;
    private config: AppConfig;

    constructor(pool: Pool, config: AppConfig) {
        super('AILayerOrchestrator');

        this.config = config;
        this.rateLimitService = new AIRateLimitService(pool);

        this.enabled = config.ai.enabled && (
            !!config.ai.apiKey ||
            !!config.ai.groqApiKey ||
            !!config.ai.openRouterApiKey
        );

        if (this.enabled) {
            this.aiRepository = new AIRepository(pool);

            // Initialize Gemini (primary)
            if (config.ai.apiKey) {
                this.aiService = new AIAnalysisService(config.ai.apiKey);
                this.logger.info(`Primary AI: Gemini (${config.ai.model})`);
            }

            // Initialize Groq (secondary)
            if (config.ai.groqApiKey) {
                this.groqService = new GroqAnalysisService(config.ai.groqApiKey, config.ai.groqModel);
                this.logger.info(`Secondary AI: Groq (${config.ai.groqModel})`);
            }

            // Initialize OpenRouter (tertiary)
            if (config.ai.openRouterApiKey) {
                this.openRouterService = new OpenRouterAnalysisService(config.ai.openRouterApiKey, config.ai.openRouterModel);
                this.logger.info(`Tertiary AI: OpenRouter (${config.ai.openRouterModel})`);
            }

            if (!this.aiService && !this.groqService && !this.openRouterService) {
                this.enabled = false;
                this.logger.info('AI Layer disabled - no API keys configured');
            }
        } else {
            this.logger.info('AI Layer Orchestrator disabled (ENABLE_AI_LAYER=false or no API keys)');
        }
    }

    /**
     * Check if AI layers are enabled
     */
    isEnabled(): boolean {
        return this.enabled;
    }

    /**
     * Analyze a stock with automatic provider fallback.
     * Chain: Gemini → Groq → OpenRouter → failure (code-only fallback in processStock).
     *
     * Before calling each provider, checks the DB-backed rate limit state.
     * On 429, records the block window to the DB so subsequent runs skip the provider.
     */
    private async analyzeWithFallback(input: AIAnalysisInput): Promise<AIAnalysisOutput> {
        const sym = input.stockData.symbol;

        // ── Gemini (primary) ──────────────────────────────────────────────
        if (this.aiService && !(await this.rateLimitService.isBlocked('gemini'))) {
            const result = await this.aiService.analyzeStock(input);

            if (result.success) {
                await this.rateLimitService.recordSuccess('gemini', result.log?.totalTokens);
                return result;
            }

            if (this.is429(result)) {
                this.logger.warn(`⚠️ Gemini rate limited for ${sym} — recording block`);
                const retryAfter = this.extractRetryAfter(result);
                await this.rateLimitService.record429('gemini', retryAfter);
                // Fall through to Groq
            } else {
                // Non-429 error — don't attempt fallback, return as-is
                return result;
            }
        } else if (this.aiService) {
            this.logger.info(`⏭️  Skipping Gemini for ${sym} (rate-limited in DB)`);
        }

        // ── Groq (secondary) ─────────────────────────────────────────────
        if (this.groqService && !(await this.rateLimitService.isBlocked('groq'))) {
            this.logger.info(`🔄 Trying Groq for ${sym}...`);
            const result = await this.groqService.analyzeStock(input);

            if (result.success) {
                await this.rateLimitService.recordSuccess('groq', result.log?.totalTokens);
                this.logger.info(`✅ Groq succeeded for ${sym}`);
                return result;
            }

            if (this.is429(result)) {
                this.logger.warn(`⚠️ Groq rate limited for ${sym} — recording block`);
                const retryAfter = this.extractRetryAfter(result);
                await this.rateLimitService.record429('groq', retryAfter);
                // Fall through to OpenRouter
            } else {
                return result;
            }
        } else if (this.groqService) {
            this.logger.info(`⏭️  Skipping Groq for ${sym} (rate-limited in DB)`);
        }

        // ── OpenRouter (tertiary) ─────────────────────────────────────────
        if (this.openRouterService && !(await this.rateLimitService.isBlocked('openrouter'))) {
            this.logger.info(`🔄 Trying OpenRouter for ${sym}...`);
            const result = await this.openRouterService.analyzeStock(input);

            if (result.success) {
                await this.rateLimitService.recordSuccess('openrouter', result.log?.totalTokens);
                this.logger.info(`✅ OpenRouter succeeded for ${sym}`);
                return result;
            }

            if (this.is429(result)) {
                this.logger.warn(`⚠️ OpenRouter rate limited for ${sym} — recording block`);
                const retryAfter = this.extractRetryAfter(result);
                await this.rateLimitService.record429('openrouter', retryAfter);
            } else {
                this.logger.error(`❌ OpenRouter failed for ${sym}: ${result.error}`);
            }
            return result; // All providers exhausted
        } else if (this.openRouterService) {
            this.logger.info(`⏭️  Skipping OpenRouter for ${sym} (rate-limited in DB)`);
        }

        // All providers unavailable / blocked
        this.logger.warn(`🚫 All AI providers are blocked for ${sym}. Falling back to code-only.`);
        return {
            success: false,
            log: {
                stockId: input.stockId,
                scanId: input.scanId,
                requestTimestamp: new Date(),
                provider: 'none',
                model: 'none',
                endpoint: 'none',
                requestPayload: {},
                retryCount: 0,
                responseTimestamp: new Date(),
                responseStatus: 503,
                errorMessage: 'All AI providers are currently rate-limited',
                latencyMs: 0,
            },
            error: 'All AI providers are currently rate-limited',
        };
    }

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------

    /** Returns true if the AI output represents a 429 rate-limit error */
    private is429(output: AIAnalysisOutput): boolean {
        return !!(
            output.error?.includes('429') ||
            output.error?.includes('Too Many Requests') ||
            output.error?.includes('quota') ||
            output.error?.includes('RESOURCE_EXHAUSTED') ||
            output.error?.includes('rate_limit_exceeded') ||
            output.log?.responseStatus === 429
        );
    }

    /**
     * Try to extract a Retry-After seconds value from the error message.
     * Groq puts e.g. "Please try again in 14m35.232s" in the error.
     * OpenRouter sometimes sends a `retry-after` header value in the response.
     */
    private extractRetryAfter(output: AIAnalysisOutput): number | undefined {
        // Check log.responsePayload for a retry-after header value
        const payload = output.log?.responsePayload as any;
        const headerRetry = payload?.headers?.['retry-after'];
        if (headerRetry) {
            const secs = parseInt(headerRetry, 10);
            if (!isNaN(secs) && secs > 0) return secs;
        }

        // Parse Groq-style "Please try again in 14m35.232s"
        if (output.error) {
            const minsMatch = output.error.match(/(\d+)m(\d+(?:\.\d+)?)s/);
            if (minsMatch) {
                return Math.ceil(parseInt(minsMatch[1], 10) * 60 + parseFloat(minsMatch[2]));
            }
            // Plain seconds e.g. "retry in 25s"
            const secsMatch = output.error.match(/retry.*?in\s+(\d+)s/i);
            if (secsMatch) return parseInt(secsMatch[1], 10);
        }

        return undefined;
    }

    // ---------------------------------------------------------------
    // Public processStock / batch API (unchanged logic)
    // ---------------------------------------------------------------

    /**
     * Process a stock through the appropriate AI layer
     *
     * Flow:
     * - Rejected stocks → Layer 1 (rejection_review)
     *   - If AI PASSES → Observation queue
     *   - If AI REJECTS → Final rejected
     *
     * - Selected stocks → Layer 2 (selection_validation)
     *   - If AI PASSES → Final selected
     *   - If AI FAILS → Observation queue
     */
    async processStock(data: StockAnalysisData): Promise<AIOrchestrationResult> {
        if (!this.enabled) {
            return {
                stockId: data.stockId,
                symbol: data.symbol,
                originalDecision: data.qualified ? 'selected' : 'rejected',
                aiLayerProcessed: null,
                aiDecision: null,
                confidence: null,
                finalStatus: data.qualified ? 'selected' : 'rejected',
                addedToObservation: false,
                error: 'AI layers disabled'
            };
        }

        const layerType: AILayerType = data.qualified
            ? 'selection_validation'
            : 'rejection_review';

        const sourceDecision = data.qualified ? 'code_selected' : 'code_rejected';

        try {
            const stockData = AIAnalysisService.convertToAIFormat(
                data.symbol,
                data.name,
                data.analysisDetails
            );

            const aiInput: AIAnalysisInput = {
                stockId: data.stockId,
                scanId: data.scanId,
                stockData,
                layerType,
                sourceDecision
            };

            this.logger.info(`Running AI ${layerType} for ${data.symbol}`);
            const aiOutput = await this.analyzeWithFallback(aiInput);

            // Always save the API log
            let logId: number | null = null;
            if (aiOutput.log) {
                try {
                    logId = await this.aiRepository!.saveApiLog(aiOutput.log);
                } catch (logError) {
                    this.logger.error('Failed to save AI API log:', logError);
                }
            }

            if (!aiOutput.success || !aiOutput.result) {
                return {
                    stockId: data.stockId,
                    symbol: data.symbol,
                    originalDecision: data.qualified ? 'selected' : 'rejected',
                    aiLayerProcessed: layerType,
                    aiDecision: null,
                    confidence: null,
                    finalStatus: data.qualified ? 'selected' : 'rejected',
                    addedToObservation: false,
                    error: aiOutput.error || 'AI analysis failed (all providers exhausted)'
                };
            }

            // Get config ID for the layer type
            const config = await this.aiRepository!.getActiveConfig(layerType);
            if (config) {
                aiOutput.result.configId = config.id;
            }

            // Save AI result
            const resultId = await this.aiRepository!.saveAnalysisResult(aiOutput.result);
            if (logId) {
                await this.aiRepository!.updateApiLogResultId(logId, resultId);
            }

            const addedToObservation = aiOutput.result.finalStatus === 'observation';
            if (addedToObservation) {
                const priority = this.calculatePriority(aiOutput.result.confidenceScore, layerType);
                await this.aiRepository!.addToObservationQueue({
                    stockId: data.stockId,
                    scanId: data.scanId,
                    aiAnalysisId: resultId,
                    source: layerType === 'rejection_review'
                        ? 'ai_layer_1_passed'
                        : 'ai_layer_2_failed',
                    priority,
                    status: 'pending'
                });
                this.logger.info(`Added ${data.symbol} to observation queue (priority: ${priority})`);
            }

            const logMessage = data.qualified
                ? (aiOutput.result.aiDecision === 'passed'
                    ? `✅ AI validated ${data.symbol} → SELECTED`
                    : `⚠️ AI flagged ${data.symbol} → OBSERVATION`)
                : (aiOutput.result.aiDecision === 'passed'
                    ? `🔄 AI recovered ${data.symbol} → OBSERVATION`
                    : `❌ AI confirmed rejection of ${data.symbol}`);
            this.logger.info(logMessage);

            return {
                stockId: data.stockId,
                symbol: data.symbol,
                originalDecision: data.qualified ? 'selected' : 'rejected',
                aiLayerProcessed: layerType,
                aiDecision: aiOutput.result.aiDecision,
                confidence: aiOutput.result.confidenceScore,
                finalStatus: aiOutput.result.finalStatus,
                addedToObservation
            };

        } catch (error) {
            const errorMessage = (error as Error).message;
            this.logger.error(`AI processing failed for ${data.symbol}:`, error);
            return {
                stockId: data.stockId,
                symbol: data.symbol,
                originalDecision: data.qualified ? 'selected' : 'rejected',
                aiLayerProcessed: layerType,
                aiDecision: null,
                confidence: null,
                finalStatus: data.qualified ? 'selected' : 'rejected',
                addedToObservation: false,
                error: errorMessage
            };
        }
    }

    /**
     * Process multiple stocks in batch
     */
    async processBatch(stocks: StockAnalysisData[]): Promise<AIOrchestrationResult[]> {
        const results: AIOrchestrationResult[] = [];

        // Log rate-limit status at start of each batch
        const summary = await this.rateLimitService.getSummary();
        for (const [provider, state] of Object.entries(summary)) {
            if (state.blocked) {
                this.logger.warn(
                    `⏭️  ${provider} is blocked until ${state.blockedUntil?.toISOString()} — will skip`
                );
            }
        }

        for (const stock of stocks) {
            const result = await this.processStock(stock);
            results.push(result);
            // Small delay between requests (4 s) to stay within per-minute limits
            await this.waitMs(4000);
        }

        return results;
    }

    /**
     * Manually unblock a provider (useful via admin endpoint or CLI)
     */
    async unblockProvider(provider: 'gemini' | 'groq' | 'openrouter'): Promise<void> {
        await this.rateLimitService.unblock(provider);
    }

    /**
     * Reset daily counters (call from a scheduled job at midnight)
     */
    async resetDailyCounters(): Promise<void> {
        await this.rateLimitService.resetDailyCounters();
    }

    /**
     * Calculate priority for observation queue based on confidence and layer
     */
    private calculatePriority(confidence: number, layerType: AILayerType): number {
        let priority = 5;
        if (confidence >= 80) priority += 2;
        else if (confidence >= 60) priority += 1;
        else if (confidence < 40) priority -= 1;
        if (layerType === 'selection_validation') priority += 1;
        return Math.max(1, Math.min(10, priority));
    }

    /**
     * Get observation queue for manual review
     */
    async getObservationQueue(limit: number = 50): Promise<any[]> {
        if (!this.enabled) return [];
        return this.aiRepository!.getPendingObservations(limit);
    }

    /**
     * Process user decision on an observation
     */
    async processUserDecision(
        observationId: number,
        decision: 'approved' | 'rejected',
        notes?: string,
        reviewedBy?: string
    ): Promise<void> {
        if (!this.enabled) throw new Error('AI layers are not enabled');
        await this.aiRepository!.updateObservationDecision(observationId, decision, notes, reviewedBy);
        this.logger.info(`User ${decision} observation ${observationId}`);
    }

    /**
     * Get AI statistics
     */
    async getAIStats(): Promise<any> {
        if (!this.enabled) return { enabled: false, message: 'AI layers not enabled' };
        const stats = await this.aiRepository!.getAIStats();
        const rateLimitSummary = await this.rateLimitService.getSummary();
        return { enabled: true, ...stats, rateLimits: rateLimitSummary };
    }

    private waitMs(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
