// src/utils/logger-enhanced.ts - Enhanced logger utility
// PHASE D: Dual output — console + PostgreSQL system_logs table

import { Pool } from 'pg';

interface LogLevel {
  ERROR: number;
  WARN: number;
  INFO: number;
  DEBUG: number;
}

class Logger {
  private context: string;
  private logLevel: number;
  private levels: LogLevel = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
  };

  // Shared pool across all Logger instances
  private static dbPool: Pool | null = null;

  constructor(context: string = 'App') {
    this.context = context;
    this.logLevel = this.getLogLevel();
  }

  /**
   * Set the database pool for persistent logging (called once at app startup)
   */
  static setPool(pool: Pool): void {
    Logger.dbPool = pool;
  }

  private getLogLevel(): number {
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    switch (envLevel) {
      case 'ERROR': return 0;
      case 'WARN': return 1;
      case 'INFO': return 2;
      case 'DEBUG': return 3;
      default: return 2;
    }
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const context = this.context ? `[${this.context}]` : '';
    const dataStr = data ? ` ${typeof data === 'string' ? data : JSON.stringify(data)}` : '';
    return `${timestamp} ${level} ${context} ${message}${dataStr}`;
  }

  private shouldLog(level: number): boolean {
    return level <= this.logLevel;
  }

  private log(level: string, levelNum: number, message: string, data?: any): void {
    if (!this.shouldLog(levelNum)) return;

    const formattedMessage = this.formatMessage(level, message, data);

    if (levelNum === 0) {
      console.error(formattedMessage);
    } else if (levelNum === 1) {
      console.warn(formattedMessage);
    } else {
      console.log(formattedMessage);
    }

    // Persist ERROR and WARN to database (non-blocking)
    if (Logger.dbPool && levelNum <= 1) {
      this.persistLog(level, message, data);
    }
  }

  /**
   * Persist log entry to system_logs table (fire-and-forget)
   */
  private persistLog(level: string, message: string, data?: any): void {
    if (!Logger.dbPool) return;

    const meta = data ? (typeof data === 'string' ? { detail: data } : data) : null;

    Logger.dbPool.query(
      `INSERT INTO system_logs (level, service, message, meta) VALUES ($1, $2, $3, $4)`,
      [level, this.context, message, meta ? JSON.stringify(meta) : null]
    ).catch(() => {
      // Silently fail — never let logging crash the app
    });
  }

  error(message: string, data?: any): void {
    this.log('ERROR', this.levels.ERROR, message, data);
  }

  warn(message: string, data?: any): void {
    this.log('WARN', this.levels.WARN, message, data);
  }

  info(message: string, data?: any): void {
    this.log('INFO', this.levels.INFO, message, data);
  }

  debug(message: string, data?: any): void {
    this.log('DEBUG', this.levels.DEBUG, message, data);
  }

  success(message: string, data?: any): void {
    this.log('SUCCESS', this.levels.INFO, `✅ ${message}`, data);
  }

  /**
   * Log an API request/response (used by Express middleware)
   */
  static logRequest(method: string, path: string, status: number, durationMs: number, service: string = 'Express'): void {
    if (!Logger.dbPool) return;

    Logger.dbPool.query(
      `INSERT INTO system_logs (level, service, message, request_method, request_path, response_status, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['INFO', service, `${method} ${path} → ${status} (${durationMs}ms)`, method, path, status, durationMs]
    ).catch(() => {});
  }

  // Static convenience methods
  static error(message: string, data?: any): void { new Logger().error(message, data); }
  static warn(message: string, data?: any): void { new Logger().warn(message, data); }
  static info(message: string, data?: any): void { new Logger().info(message, data); }
  static debug(message: string, data?: any): void { new Logger().debug(message, data); }
  static success(message: string, data?: any): void { new Logger().success(message, data); }
}

export { Logger };