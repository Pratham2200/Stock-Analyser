"use strict";
// src/utils/logger-enhanced.ts - Enhanced logger utility with colors and informative messages
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
// ANSI Color codes for terminal output
const Colors = {
    RESET: '\x1b[0m',
    BRIGHT: '\x1b[1m',
    DIM: '\x1b[2m',
    RED: '\x1b[31m',
    GREEN: '\x1b[32m',
    YELLOW: '\x1b[33m',
    BLUE: '\x1b[34m',
    MAGENTA: '\x1b[35m',
    CYAN: '\x1b[36m',
    WHITE: '\x1b[37m',
    LIGHT_BLUE: '\x1b[94m',
    LIGHT_RED: '\x1b[91m',
    LIGHT_GREEN: '\x1b[92m',
    LIGHT_YELLOW: '\x1b[93m',
    LIGHT_CYAN: '\x1b[96m'
};
class Logger {
    constructor(context = 'App') {
        this.levels = {
            ERROR: 0,
            WARN: 1,
            INFO: 2,
            DEBUG: 3
        };
        this.context = context;
        this.logLevel = this.getLogLevel();
    }
    getLogLevel() {
        // Hardcoded log level: 'info'
        return 2; // INFO level
    }
    formatMessage(level, message, data) {
        const timestamp = new Date().toISOString();
        const context = this.context ? `[${this.context}]` : '';
        const dataStr = data ? ` ${JSON.stringify(data, null, 2)}` : '';
        return `${timestamp} ${level} ${context} ${message}${dataStr}`;
    }
    shouldLog(level) {
        return level <= this.logLevel;
    }
    getColorForLevel(level) {
        switch (level) {
            case 'ERROR': return Colors.LIGHT_RED;
            case 'WARN': return Colors.YELLOW;
            case 'INFO': return Colors.LIGHT_BLUE;
            case 'DEBUG': return Colors.CYAN;
            case 'SUCCESS': return Colors.LIGHT_GREEN;
            default: return Colors.WHITE;
        }
    }
    getIconForLevel(level) {
        switch (level) {
            case 'ERROR': return '❌';
            case 'WARN': return '⚠️';
            case 'INFO': return 'ℹ️';
            case 'DEBUG': return '🔍';
            case 'SUCCESS': return '✅';
            default: return '📝';
        }
    }
    log(level, levelNum, message, data) {
        if (!this.shouldLog(levelNum))
            return;
        const timestamp = new Date().toISOString();
        const context = this.context ? `[${this.context}]` : '';
        const icon = this.getIconForLevel(level);
        const color = this.getColorForLevel(level);
        const reset = Colors.RESET;
        // Create colored output
        const coloredMessage = `${color}${timestamp} ${icon} ${level} ${context} ${message}${reset}`;
        const dataStr = data ? `\n${Colors.DIM}${JSON.stringify(data, null, 2)}${reset}` : '';
        if (levelNum === 0) { // ERROR
            console.error(coloredMessage + dataStr);
        }
        else if (levelNum === 1) { // WARN
            console.warn(coloredMessage + dataStr);
        }
        else {
            console.log(coloredMessage + dataStr);
        }
    }
    error(message, data) {
        this.log('ERROR', this.levels.ERROR, message, data);
    }
    warn(message, data) {
        this.log('WARN', this.levels.WARN, message, data);
    }
    info(message, data) {
        this.log('INFO', this.levels.INFO, message, data);
    }
    debug(message, data) {
        this.log('DEBUG', this.levels.DEBUG, message, data);
    }
    success(message, data) {
        this.log('SUCCESS', this.levels.INFO, message, data);
    }
    // Enhanced logging methods with more context
    apiRequest(method, path, statusCode, duration) {
        const message = `${method} ${path}${statusCode ? ` - ${statusCode}` : ''}${duration ? ` (${duration}ms)` : ''}`;
        this.info(message);
    }
    databaseQuery(query, params, duration) {
        const message = `Database query executed${duration ? ` (${duration}ms)` : ''}`;
        this.debug(message, { query: query.substring(0, 100) + '...', params });
    }
    stockAnalysis(symbol, qualified, score, reason) {
        const status = qualified ? 'QUALIFIED' : 'REJECTED';
        const message = `Stock analysis: ${symbol} - ${status}${score ? ` (Score: ${score})` : ''}`;
        if (qualified) {
            this.success(message);
        }
        else {
            this.warn(message, { reason });
        }
    }
    scanProgress(current, total, stage) {
        const percentage = Math.round((current / total) * 100);
        const message = `Scan progress: ${current}/${total} (${percentage}%) - ${stage}`;
        this.info(message);
    }
    performance(operation, duration, details) {
        const message = `${operation} completed in ${duration}ms`;
        this.info(message, details);
    }
    // Static methods for global logging
    static error(message, data) {
        new Logger().error(message, data);
    }
    static warn(message, data) {
        new Logger().warn(message, data);
    }
    static info(message, data) {
        new Logger().info(message, data);
    }
    static debug(message, data) {
        new Logger().debug(message, data);
    }
    static success(message, data) {
        new Logger().success(message, data);
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger-enhanced.js.map