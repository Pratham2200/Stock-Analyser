// src/services/CompoundAlertService.ts — Evaluates multi-leg market conditions for alerts
// PHASE D: Fully persistent via PostgreSQL

import { Pool } from 'pg';
import { BaseService } from './BaseService';
import { MarketDataService } from './MarketDataService';
import { OptionsService } from './OptionsService';
import { FiiDiiService } from './FiiDiiService';
import { NotificationService } from './NotificationService';
import { RSI } from 'technicalindicators';

export type AlertOperator = '>' | '<' | '>=' | '<=' | '==' | '!=' | 'IN' | 'TRENDS';
export type AlertMetric = 'PRICE' | 'RSI' | 'MACD' | 'PCR' | 'FII_NET' | 'DII_NET' | 'MAX_PAIN_DIFF';

export interface AlertCondition {
  metric: AlertMetric;
  operator: AlertOperator;
  value: number | string;
  timeframe?: '1d' | '15m' | '5m';
}

export interface CompoundAlert {
  id: number;
  userId: string;
  symbol: string;
  name: string;
  conditions: AlertCondition[];
  logic: 'AND' | 'OR';
  isActive: boolean;
  lastTriggered?: string;
}

export class CompoundAlertService extends BaseService {
  private marketData: MarketDataService;
  private options: OptionsService;
  private fiidii: FiiDiiService;
  private notifications: NotificationService;
  private pool: Pool;

  constructor(
    marketData: MarketDataService,
    options: OptionsService,
    fiidii: FiiDiiService,
    notifications: NotificationService,
    pool: Pool
  ) {
    super('CompoundAlertService');
    this.marketData = marketData;
    this.options = options;
    this.fiidii = fiidii;
    this.notifications = notifications;
    this.pool = pool;
  }

  /**
   * Register a new compound alert — persisted immediately
   */
  async createAlert(alert: Omit<CompoundAlert, 'id' | 'isActive'>): Promise<CompoundAlert> {
    const res = await this.pool.query(
      `INSERT INTO compound_alerts (user_id, symbol, name, conditions, logic)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [alert.userId, alert.symbol.toUpperCase(), alert.name, JSON.stringify(alert.conditions), alert.logic]
    );
    return this.rowToAlert(res.rows[0]);
  }

  /**
   * Get all alerts for a user
   */
  async getUserAlerts(userId: string): Promise<CompoundAlert[]> {
    const res = await this.pool.query(
      'SELECT * FROM compound_alerts WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return res.rows.map((r: any) => this.rowToAlert(r));
  }

  /**
   * Delete an alert
   */
  async deleteAlert(alertId: number): Promise<boolean> {
    const res = await this.pool.query('DELETE FROM compound_alerts WHERE id = $1', [alertId]);
    return (res.rowCount || 0) > 0;
  }

  /**
   * Toggle alert active/inactive
   */
  async toggleAlert(alertId: number): Promise<CompoundAlert> {
    const res = await this.pool.query(
      'UPDATE compound_alerts SET is_active = NOT is_active WHERE id = $1 RETURNING *',
      [alertId]
    );
    if (res.rows.length === 0) throw new Error(`Alert ${alertId} not found`);
    return this.rowToAlert(res.rows[0]);
  }

  /**
   * Scan all active alerts and evaluate conditions
   */
  async scanAlerts(userId?: string): Promise<{ triggered: CompoundAlert[]; total: number }> {
    let query = 'SELECT * FROM compound_alerts WHERE is_active = TRUE';
    const params: any[] = [];
    if (userId) {
      query += ' AND user_id = $1';
      params.push(userId);
    }

    const res = await this.pool.query(query, params);
    const triggered: CompoundAlert[] = [];

    for (const row of res.rows) {
      const alert = this.rowToAlert(row);
      try {
        const wasTriggered = await this.evaluateAlert(alert);
        if (wasTriggered) {
          triggered.push(alert);

          // Record trigger in history
          await this.pool.query(
            `INSERT INTO alert_trigger_history (alert_id, evaluation_results)
             VALUES ($1, $2)`,
            [alert.id, JSON.stringify({ conditions: alert.conditions, triggeredAt: new Date().toISOString() })]
          );

          // Update last triggered
          await this.pool.query(
            'UPDATE compound_alerts SET last_triggered = NOW() WHERE id = $1',
            [alert.id]
          );
        }
      } catch (e) {
        this.logger.warn(`Failed to evaluate alert ${alert.id}: ${(e as Error).message}`);
      }
    }

    return { triggered, total: res.rows.length };
  }

  /**
   * Evaluate all conditions of a single alert
   */
  private async evaluateAlert(alert: CompoundAlert): Promise<boolean> {
    const results: boolean[] = [];

    for (const condition of alert.conditions) {
      const metricValue = await this.getMetricValue(alert.symbol, condition.metric);
      const passed = this.evaluateCondition(metricValue, condition.operator, condition.value);
      results.push(passed);
    }

    return alert.logic === 'AND'
      ? results.every(r => r)
      : results.some(r => r);
  }

  /**
   * Fetch the current value of a metric
   */
  private async getMetricValue(symbol: string, metric: AlertMetric): Promise<number> {
    switch (metric) {
      case 'PRICE': {
        const quote = await this.marketData.fetchCurrentQuote(symbol);
        return quote?.price || 0;
      }
      case 'RSI': {
        const chartResult = await this.marketData.fetchDailyBars(symbol, 30);
        const closes = chartResult.bars.map((b: any) => b.close);
        const rsiValues = RSI.calculate({ period: 14, values: closes });
        return rsiValues.length > 0 ? rsiValues[rsiValues.length - 1] : 50;
      }
      case 'PCR': {
        const oi = await this.options.getOIAnalysis(symbol);
        return oi.pcrRatio;
      }
      case 'FII_NET': {
        const flows = await this.fiidii.getRecentFlows();
        return flows.fiiNetLast5Days;
      }
      case 'DII_NET': {
        const flows = await this.fiidii.getRecentFlows();
        return flows.diiNetLast5Days;
      }
      case 'MAX_PAIN_DIFF': {
        const mp = await this.options.getMaxPain(symbol);
        const quote = await this.marketData.fetchCurrentQuote(symbol);
        return quote?.price ? ((quote.price - mp.maxPainStrike) / mp.maxPainStrike) * 100 : 0;
      }
      default:
        return 0;
    }
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(metricValue: number, operator: AlertOperator, target: number | string): boolean {
    const numTarget = Number(target);
    switch (operator) {
      case '>': return metricValue > numTarget;
      case '<': return metricValue < numTarget;
      case '>=': return metricValue >= numTarget;
      case '<=': return metricValue <= numTarget;
      case '==': return metricValue === numTarget;
      case '!=': return metricValue !== numTarget;
      default: return false;
    }
  }

  /**
   * Get trigger history for a specific alert
   */
  async getAlertHistory(alertId: number, limit: number = 20): Promise<any[]> {
    const res = await this.pool.query(
      'SELECT * FROM alert_trigger_history WHERE alert_id = $1 ORDER BY triggered_at DESC LIMIT $2',
      [alertId, limit]
    );
    return res.rows;
  }

  private rowToAlert(row: any): CompoundAlert {
    const conditions = typeof row.conditions === 'string' ? JSON.parse(row.conditions) : (row.conditions || []);
    return {
      id: row.id,
      userId: row.user_id,
      symbol: row.symbol,
      name: row.name,
      conditions,
      logic: row.logic,
      isActive: row.is_active,
      lastTriggered: row.last_triggered?.toISOString(),
    };
  }
}
