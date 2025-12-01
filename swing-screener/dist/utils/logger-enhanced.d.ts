declare class Logger {
    private context;
    private logLevel;
    private levels;
    constructor(context?: string);
    private getLogLevel;
    private formatMessage;
    private shouldLog;
    private getColorForLevel;
    private getIconForLevel;
    private log;
    error(message: string, data?: any): void;
    warn(message: string, data?: any): void;
    info(message: string, data?: any): void;
    debug(message: string, data?: any): void;
    success(message: string, data?: any): void;
    apiRequest(method: string, path: string, statusCode?: number, duration?: number): void;
    databaseQuery(query: string, params?: any[], duration?: number): void;
    stockAnalysis(symbol: string, qualified: boolean, score?: number, reason?: string): void;
    scanProgress(current: number, total: number, stage: string): void;
    performance(operation: string, duration: number, details?: any): void;
    static error(message: string, data?: any): void;
    static warn(message: string, data?: any): void;
    static info(message: string, data?: any): void;
    static debug(message: string, data?: any): void;
    static success(message: string, data?: any): void;
}
export { Logger };
//# sourceMappingURL=logger-enhanced.d.ts.map