// src/services/CompoundAlertService.ts — Evaluates multi-leg market conditions for alerts

import { BaseService } from './BaseService';
import { MarketDataService } from './MarketDataService';
import { OptionsService } from './OptionsService';
import { FiiDiiService } from './FiiDiiService';
import { NotificationService } from './NotificationService';

export type AlertOperator = '>' | '<' | '>=' | '<=' | '==' | '!=' | 'IN' | 'TRENDS';
export type AlertMetric = 'PRICE' | 'RSI' | 'MACD' | 'PCR' | 'FII_NET' | 'DII_NET' | 'MAX_PAIN_DIFF';

export interface AlertCondition {
  metric: AlertMetric;
  operator: AlertOperator;
  value: number | string;
  timeframe?: '1d' | '15m' | '5m';
}

export interface CompoundAlert {
  id: string;
  userId: string;
  symbol: string; // 'NIFTY' or specific stock
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

  // In-memory store for prototype (will move to DB)
  private activeAlerts: Map<string, CompoundAlert> = new Map();

  constructor(
    marketData: MarketDataService,
    options: OptionsService,
    fiidii: FiiDiiService,
    notifications: NotificationService
  ) {
    super('CompoundAlertService');
    this.marketData = marketData;
    this.options = options;
    this.fiidii = fiidii;
    this.notifications = notifications;
  }

  /**
   * Register a new compound alert
   */
  createAlert(alert: Omit<CompoundAlert, 'id' | 'isActive'>): CompoundAlert {
    const newAlert: CompoundAlert = {
      ...alert,
      id: `alt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      isActive: true,
    };
    
    this.activeAlerts.set(newAlert.id, newAlert);
    this.logger.info(`Created compound alert [${newAlert.name}] for ${newAlert.symbol}`);
    return newAlert;
  }

  /**
   * Delete an alert
   */
  deleteAlert(id: string): boolean {
    return this.activeAlerts.delete(id);
  }

  /**
   * Get all active alerts for a user
   */
  getUserAlerts(userId: string): CompoundAlert[] {
    return Array.from(this.activeAlerts.values()).filter(a => a.userId === userId);
  }

  /**
   * Evaluate all active alerts
   * In production this would be triggered by a Cron job or pub/sub price tick
   */
  async evaluateAllAlerts(): Promise<void> {
    const alertsToCheck = Array.from(this.activeAlerts.values()).filter(a => a.isActive);
    if (alertsToCheck.length === 0) return;

    this.logger.info(`Evaluating ${alertsToCheck.length} compound alerts`);

    // Group by symbol to batch data fetching
    const symbols = [...new Set(alertsToCheck.map(a => a.symbol))];
    const dataCache = new Map<string, any>();

    // Pre-fetch flow data if any alert needs it
    const needsFlows = alertsToCheck.some(a => 
      a.conditions.some(c => c.metric === 'FII_NET' || c.metric === 'DII_NET')
    );
    let flowCache: any = null;
    if (needsFlows) {
      flowCache = await this.fiidii.getRecentFlows();
    }

    // Evaluate
    for (const alert of alertsToCheck) {
      try {
        const isTriggered = await this.evaluateSingleAlert(alert, dataCache, flowCache);
        
        if (isTriggered) {
          await this.triggerAlert(alert);
        }
      } catch (error) {
        this.logger.error(`Failed to evaluate alert ${alert.id}`, error);
      }
    }
  }

  private async evaluateSingleAlert(
    alert: CompoundAlert, 
    dataCache: Map<string, any>,
    flowCache: any
  ): Promise<boolean> {
    let results: boolean[] = [];

    for (const condition of alert.conditions) {
      let currentValue: number | string = 0;

      // 1. Fetch required metric
      if (condition.metric === 'PRICE') {
        if (!dataCache.has(`price_${alert.symbol}`)) {
          const quote = await this.marketData.fetchCurrentQuote(alert.symbol);
          if (quote) dataCache.set(`price_${alert.symbol}`, quote.price);
        }
        currentValue = dataCache.get(`price_${alert.symbol}`) || 0;
      } 
      else if (condition.metric === 'PCR') {
        if (!dataCache.has(`pcr_${alert.symbol}`)) {
          const oi = await this.options.getOIAnalysis(alert.symbol);
          dataCache.set(`pcr_${alert.symbol}`, oi.pcrRatio);
        }
        currentValue = dataCache.get(`pcr_${alert.symbol}`);
      }
      else if (condition.metric === 'FII_NET' && flowCache) {
        currentValue = flowCache.fiiNetLast5Days;
      }

      // 2. Evaluate condition
      const passed = this.compare(currentValue, condition.operator, condition.value);
      results.push(passed);
    }

    // 3. Apply Logic (AND / OR)
    if (alert.logic === 'AND') {
      return results.every(r => r === true);
    } else {
      return results.some(r => r === true);
    }
  }

  private compare(current: any, operator: AlertOperator, target: any): boolean {
    const numC = Number(current);
    const numT = Number(target);

    switch (operator) {
      case '>': return numC > numT;
      case '<': return numC < numT;
      case '>=': return numC >= numT;
      case '<=': return numC <= numT;
      case '==': return current == target;
      case '!=': return current != target;
      case 'TRENDS': return String(current).toLowerCase() === String(target).toLowerCase();
      default: return false;
    }
  }

  private async triggerAlert(alert: CompoundAlert): Promise<void> {
    // Only trigger if it hasn't fired in the last 15 minutes
    const now = new Date();
    if (alert.lastTriggered) {
      const last = new Date(alert.lastTriggered);
      const diffMins = (now.getTime() - last.getTime()) / 60000;
      if (diffMins < 15) return;
    }

    this.logger.info(`🔔 ALERT TRIGGERED: [${alert.name}] for ${alert.symbol}`);
    
    // Update state
    alert.lastTriggered = now.toISOString();

    // Send notification (Email/Telegram/Push)
    await this.notifications.sendCustomEmail(
      'user@example.com', // In prod, map userId to email
      `🚨 ${alert.symbol} Alert: ${alert.name}`,
      `Your compound alert "${alert.name}" regarding ${alert.symbol} has met the specified conditions.\nTime: ${alert.lastTriggered}`
    );
  }
}
