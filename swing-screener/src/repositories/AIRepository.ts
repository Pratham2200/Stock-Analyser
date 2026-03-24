// src/repositories/AIRepository.ts - Database operations for AI analysis

import { Pool } from 'pg';
import {
  AIAnalysisConfig,
  AIAnalysisResult,
  AIApiLog,
  ObservationQueueEntry,
  AILayerType,
  FinalStatus,
  ObservationStatus
} from '../types/ai';
import { Logger } from '../utils/logger-enhanced';

export class AIRepository {
  private pool: Pool;
  private logger: Logger;

  constructor(pool: Pool) {
    this.pool = pool;
    this.logger = new Logger('AIRepository');
  }

  // ============================================
  // AI ANALYSIS CONFIG
  // ============================================

  /**
   * Get active AI config for a specific layer type
   */
  async getActiveConfig(layerType: AILayerType): Promise<AIAnalysisConfig | null> {
    const query = `
      SELECT 
        id,
        layer_type as "layerType",
        provider,
        model_name as "modelName",
        api_endpoint as "apiEndpoint",
        prompt_template as "promptTemplate",
        temperature,
        max_tokens as "maxTokens",
        is_active as "isActive",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM ai_analysis_config
      WHERE layer_type = $1 AND is_active = true
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    try {
      const result = await this.pool.query(query, [layerType]);
      return result.rows[0] || null;
    } catch (error) {
      this.logger.error('Failed to get AI config:', error);
      throw error;
    }
  }

  /**
   * Get all AI configs
   */
  async getAllConfigs(): Promise<AIAnalysisConfig[]> {
    const query = `
      SELECT 
        id,
        layer_type as "layerType",
        provider,
        model_name as "modelName",
        api_endpoint as "apiEndpoint",
        prompt_template as "promptTemplate",
        temperature,
        max_tokens as "maxTokens",
        is_active as "isActive",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM ai_analysis_config
      ORDER BY layer_type, created_at DESC
    `;

    const result = await this.pool.query(query);
    return result.rows;
  }

  // ============================================
  // AI ANALYSIS RESULTS
  // ============================================

  /**
   * Save AI analysis result
   */
  async saveAnalysisResult(result: AIAnalysisResult): Promise<number> {
    const query = `
      INSERT INTO ai_analysis_results (
        stock_id, scan_id, config_id, layer_type, source_decision,
        ai_decision, confidence_score, reasoning, key_factors,
        final_status, tokens_used, processing_time_ms, raw_response
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (stock_id, scan_id, layer_type) 
      DO UPDATE SET
        ai_decision = EXCLUDED.ai_decision,
        confidence_score = EXCLUDED.confidence_score,
        reasoning = EXCLUDED.reasoning,
        key_factors = EXCLUDED.key_factors,
        final_status = EXCLUDED.final_status,
        tokens_used = EXCLUDED.tokens_used,
        processing_time_ms = EXCLUDED.processing_time_ms,
        raw_response = EXCLUDED.raw_response,
        created_at = CURRENT_TIMESTAMP
      RETURNING id
    `;

    const values = [
      result.stockId,
      result.scanId,
      result.configId,
      result.layerType,
      result.sourceDecision,
      result.aiDecision,
      result.confidenceScore,
      result.reasoning,
      JSON.stringify(result.keyFactors),
      result.finalStatus,
      result.tokensUsed,
      result.processingTimeMs,
      JSON.stringify(result.rawResponse)
    ];

    try {
      const dbResult = await this.pool.query(query, values);
      this.logger.info(`Saved AI analysis result for stock ${result.stockId}`);
      return dbResult.rows[0].id;
    } catch (error) {
      this.logger.error('Failed to save AI analysis result:', error);
      throw error;
    }
  }

  /**
   * Get AI analysis results for a scan
   */
  async getResultsByScan(scanId: number): Promise<AIAnalysisResult[]> {
    const query = `
      SELECT 
        id, stock_id as "stockId", scan_id as "scanId", config_id as "configId",
        layer_type as "layerType", source_decision as "sourceDecision",
        ai_decision as "aiDecision", confidence_score as "confidenceScore",
        reasoning, key_factors as "keyFactors", final_status as "finalStatus",
        tokens_used as "tokensUsed", processing_time_ms as "processingTimeMs",
        raw_response as "rawResponse", created_at as "createdAt"
      FROM ai_analysis_results
      WHERE scan_id = $1
      ORDER BY created_at DESC
    `;

    const result = await this.pool.query(query, [scanId]);
    return result.rows;
  }

  /**
   * Get AI analysis result for a specific stock in a scan
   */
  async getResultByStock(stockId: number, scanId: number, layerType: AILayerType): Promise<AIAnalysisResult | null> {
    const query = `
      SELECT 
        id, stock_id as "stockId", scan_id as "scanId", config_id as "configId",
        layer_type as "layerType", source_decision as "sourceDecision",
        ai_decision as "aiDecision", confidence_score as "confidenceScore",
        reasoning, key_factors as "keyFactors", final_status as "finalStatus",
        tokens_used as "tokensUsed", processing_time_ms as "processingTimeMs",
        raw_response as "rawResponse", created_at as "createdAt"
      FROM ai_analysis_results
      WHERE stock_id = $1 AND scan_id = $2 AND layer_type = $3
    `;

    const result = await this.pool.query(query, [stockId, scanId, layerType]);
    return result.rows[0] || null;
  }

  // ============================================
  // AI API LOGS
  // ============================================

  /**
   * Save AI API log
   */
  async saveApiLog(log: AIApiLog): Promise<number> {
    const query = `
      INSERT INTO ai_api_logs (
        stock_id, scan_id, ai_result_id, request_timestamp,
        provider, model, endpoint, request_payload, prompt_tokens,
        response_timestamp, response_status, response_payload,
        completion_tokens, total_tokens, latency_ms, estimated_cost,
        error_code, error_message, retry_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING id
    `;

    const values = [
      log.stockId,
      log.scanId,
      log.aiResultId || null,
      log.requestTimestamp,
      log.provider,
      log.model,
      log.endpoint || null,
      JSON.stringify(log.requestPayload),
      log.promptTokens || null,
      log.responseTimestamp || null,
      log.responseStatus || null,
      log.responsePayload ? JSON.stringify(log.responsePayload) : null,
      log.completionTokens || null,
      log.totalTokens || null,
      log.latencyMs || null,
      log.estimatedCost || null,
      log.errorCode || null,
      log.errorMessage || null,
      log.retryCount
    ];

    try {
      const result = await this.pool.query(query, values);
      return result.rows[0].id;
    } catch (error) {
      this.logger.error('Failed to save AI API log:', error);
      throw error;
    }
  }

  /**
   * Update API log with result ID
   */
  async updateApiLogResultId(logId: number, resultId: number): Promise<void> {
    const query = `UPDATE ai_api_logs SET ai_result_id = $1 WHERE id = $2`;
    try {
      await this.pool.query(query, [resultId, logId]);
    } catch (error) {
      this.logger.error('Failed to update AI API log result ID:', error);
    }
  }

  /**
   * Get API logs for a scan
   */
  async getLogsByScan(scanId: number): Promise<AIApiLog[]> {
    const query = `
      SELECT 
        id, stock_id as "stockId", scan_id as "scanId", ai_result_id as "aiResultId",
        request_timestamp as "requestTimestamp", provider, model, endpoint,
        request_payload as "requestPayload", prompt_tokens as "promptTokens",
        response_timestamp as "responseTimestamp", response_status as "responseStatus",
        response_payload as "responsePayload", completion_tokens as "completionTokens",
        total_tokens as "totalTokens", latency_ms as "latencyMs",
        estimated_cost as "estimatedCost", error_code as "errorCode",
        error_message as "errorMessage", retry_count as "retryCount",
        created_at as "createdAt"
      FROM ai_api_logs
      WHERE scan_id = $1
      ORDER BY request_timestamp DESC
    `;

    const result = await this.pool.query(query, [scanId]);
    return result.rows;
  }

  // ============================================
  // OBSERVATION QUEUE
  // ============================================

  /**
   * Add stock to observation queue
   */
  async addToObservationQueue(entry: ObservationQueueEntry): Promise<number> {
    const query = `
      INSERT INTO observation_queue (
        stock_id, scan_id, ai_analysis_id, source, priority,
        user_decision, status, expires_at
      ) VALUES ($1, $2, $3, $4, $5, 'pending', 'pending', $6)
      ON CONFLICT (stock_id, scan_id)
      DO UPDATE SET
        ai_analysis_id = EXCLUDED.ai_analysis_id,
        source = EXCLUDED.source,
        priority = EXCLUDED.priority,
        status = 'pending',
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `;

    // Default expiry: 7 days from now
    const expiresAt = entry.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const values = [
      entry.stockId,
      entry.scanId,
      entry.aiAnalysisId,
      entry.source,
      entry.priority || 5,
      expiresAt
    ];

    try {
      const result = await this.pool.query(query, values);
      this.logger.info(`Added stock ${entry.stockId} to observation queue`);
      return result.rows[0].id;
    } catch (error) {
      this.logger.error('Failed to add to observation queue:', error);
      throw error;
    }
  }

  /**
   * Get pending observation queue entries
   */
  async getPendingObservations(limit: number = 50): Promise<ObservationQueueEntry[]> {
    const query = `
      SELECT 
        oq.id, oq.stock_id as "stockId", oq.scan_id as "scanId",
        oq.ai_analysis_id as "aiAnalysisId", oq.source, oq.priority,
        oq.user_decision as "userDecision", oq.user_notes as "userNotes",
        oq.reviewed_by as "reviewedBy", oq.reviewed_at as "reviewedAt",
        oq.status, oq.expires_at as "expiresAt",
        oq.created_at as "createdAt", oq.updated_at as "updatedAt",
        s.symbol, s.name,
        ar.layer_type as layer_type,
        ar.source_decision as source_decision,
        ar.ai_decision as ai_decision,
        ar.confidence_score as confidence_score,
        ar.reasoning,
        ar.key_factors as key_factors,
        ar.final_status as final_status,
        ar.tokens_used as tokens_used,
        ar.processing_time_ms as processing_time_ms
      FROM observation_queue oq
      JOIN stocks s ON s.id = oq.stock_id
      LEFT JOIN ai_analysis_results ar ON ar.id = oq.ai_analysis_id
      WHERE oq.status = 'pending' AND (oq.expires_at IS NULL OR oq.expires_at > NOW())
      ORDER BY oq.priority DESC, oq.created_at ASC
      LIMIT $1
    `;

    const result = await this.pool.query(query, [limit]);
    return result.rows;
  }

  /**
   * Update observation queue entry with user decision
   */
  async updateObservationDecision(
    id: number,
    decision: 'approved' | 'rejected',
    notes?: string,
    reviewedBy?: string
  ): Promise<void> {
    const query = `
      UPDATE observation_queue
      SET 
        user_decision = $1,
        user_notes = $2,
        reviewed_by = $3,
        reviewed_at = NOW(),
        status = 'completed',
        updated_at = NOW()
      WHERE id = $4
    `;

    await this.pool.query(query, [decision, notes || null, reviewedBy || null, id]);
    this.logger.info(`Updated observation ${id} to ${decision}`);
  }

  // ============================================
  // AI ANALYSIS HISTORY
  // ============================================

  /**
   * Save analysis history for tracking
   */
  async saveAnalysisHistory(
    stockSymbol: string,
    scanDate: Date,
    codeDecision: string,
    aiLayer1Decision?: string,
    aiLayer2Decision?: string,
    userDecision?: string,
    finalOutcome?: string
  ): Promise<number> {
    const query = `
      INSERT INTO ai_analysis_history (
        stock_symbol, scan_date, code_decision,
        ai_layer_1_decision, ai_layer_2_decision,
        user_decision, final_outcome
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;

    const values = [
      stockSymbol,
      scanDate,
      codeDecision,
      aiLayer1Decision || null,
      aiLayer2Decision || null,
      userDecision || null,
      finalOutcome || null
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0].id;
  }

  /**
   * Update analysis history with actual performance
   */
  async updateHistoryPerformance(
    id: number,
    actualPerformance: object,
    wasPredictionCorrect: boolean
  ): Promise<void> {
    const query = `
      UPDATE ai_analysis_history
      SET 
        actual_performance = $1,
        was_prediction_correct = $2
      WHERE id = $3
    `;

    await this.pool.query(query, [JSON.stringify(actualPerformance), wasPredictionCorrect, id]);
  }

  // ============================================
  // STATISTICS
  // ============================================

  /**
   * Get AI analysis statistics
   */
  async getAIStats(): Promise<{
    totalAnalyzed: number;
    passedCount: number;
    rejectedCount: number;
    avgConfidence: number;
    avgProcessingTime: number;
    totalTokensUsed: number;
    totalEstimatedCost: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as "totalAnalyzed",
        SUM(CASE WHEN ai_decision = 'passed' THEN 1 ELSE 0 END) as "passedCount",
        SUM(CASE WHEN ai_decision = 'rejected' THEN 1 ELSE 0 END) as "rejectedCount",
        AVG(confidence_score) as "avgConfidence",
        AVG(processing_time_ms) as "avgProcessingTime",
        SUM(tokens_used) as "totalTokensUsed"
      FROM ai_analysis_results
    `;

    const costQuery = `
      SELECT COALESCE(SUM(estimated_cost), 0) as "totalEstimatedCost"
      FROM ai_api_logs
    `;

    const [statsResult, costResult] = await Promise.all([
      this.pool.query(query),
      this.pool.query(costQuery)
    ]);

    return {
      totalAnalyzed: parseInt(statsResult.rows[0].totalAnalyzed) || 0,
      passedCount: parseInt(statsResult.rows[0].passedCount) || 0,
      rejectedCount: parseInt(statsResult.rows[0].rejectedCount) || 0,
      avgConfidence: parseFloat(statsResult.rows[0].avgConfidence) || 0,
      avgProcessingTime: parseFloat(statsResult.rows[0].avgProcessingTime) || 0,
      totalTokensUsed: parseInt(statsResult.rows[0].totalTokensUsed) || 0,
      totalEstimatedCost: parseFloat(costResult.rows[0].totalEstimatedCost) || 0,
    };
  }
}
