// src/utils/logger-enhanced.ts - Enhanced logger utility

interface LogLevel {
  ERROR: number;
  WARN: number;
  INFO: number;
  DEBUG: number;
}

// LogEntry interface removed as it's not used

class Logger {
  private context: string;
  private logLevel: number;
  private levels: LogLevel = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
  };

  constructor(context: string = 'App') {
    this.context = context;
    this.logLevel = this.getLogLevel();
  }

  private getLogLevel(): number {
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    switch (envLevel) {
      case 'ERROR': return 0;
      case 'WARN': return 1;
      case 'INFO': return 2;
      case 'DEBUG': return 3;
      default: return 2; // Default to INFO
    }
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const context = this.context ? `[${this.context}]` : '';
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    return `${timestamp} ${level} ${context} ${message}${dataStr}`;
  }

  private shouldLog(level: number): boolean {
    return level <= this.logLevel;
  }

  private log(level: string, levelNum: number, message: string, data?: any): void {
    if (!this.shouldLog(levelNum)) return;

    const formattedMessage = this.formatMessage(level, message, data);
    
    if (levelNum === 0) { // ERROR
      console.error(formattedMessage);
    } else if (levelNum === 1) { // WARN
      console.warn(formattedMessage);
    } else {
      console.log(formattedMessage);
    }
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

  // Static methods for global logging
  static error(message: string, data?: any): void {
    new Logger().error(message, data);
  }

  static warn(message: string, data?: any): void {
    new Logger().warn(message, data);
  }

  static info(message: string, data?: any): void {
    new Logger().info(message, data);
  }

  static debug(message: string, data?: any): void {
    new Logger().debug(message, data);
  }

  static success(message: string, data?: any): void {
    new Logger().success(message, data);
  }
}

export { Logger };