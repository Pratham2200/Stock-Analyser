export interface ScanRecord {
    id: string;
    scanDate: string;
    totalStocksScraped: number;
    stocksAnalyzed: number;
    stocksPassed: number;
    scanDurationSeconds: number;
}
export interface StockRecord {
    id: string;
    scanId: string;
    symbol: string;
    name: string;
    createdAt: string;
}
export interface AnalysisRecord {
    id: string;
    stockId: string;
    scanId: string;
    qualified: boolean;
    failStep: number;
    failReason: string;
    currentPrice?: number;
    ema10?: number;
    ema20?: number;
    strategyDetails: Record<string, any>;
    analysisDurationMs: number;
    dataPointsDaily: number;
    dataPointsIntraday: number;
    createdAt: string;
}
export interface SelectedStockRecord {
    id: string;
    stockId: string;
    scanId: string;
    entryPrice: number;
    stopLoss: number;
    target1: number;
    target2: number;
    target3: number;
    positionSize: number;
    positionValue: number;
    createdAt: string;
}
export interface PortfolioPositionRecord {
    id: string;
    symbol: string;
    name: string;
    entryPrice: number;
    currentPrice: number;
    quantity: number;
    stopLoss: number;
    targetPrice: number;
    status: 'active' | 'closed' | 'partial';
    createdAt: string;
    updatedAt: string;
}
export interface DatabaseQueryResult<T = any> {
    rows: T[];
    rowCount: number;
    command: string;
}
export interface TransactionOptions {
    isolationLevel?: 'READ_UNCOMMITTED' | 'READ_COMMITTED' | 'REPEATABLE_READ' | 'SERIALIZABLE';
    timeout?: number;
}
export interface QueryOptions {
    timeout?: number;
    retries?: number;
    retryDelay?: number;
}
//# sourceMappingURL=database.d.ts.map