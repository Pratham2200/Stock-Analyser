export interface ApiRequest {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: any;
    query?: Record<string, any>;
    params?: Record<string, any>;
}
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
    timestamp: string;
    requestId?: string;
}
export interface PaginatedRequest {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    filters?: Record<string, any>;
}
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}
export interface ErrorResponse extends ApiResponse {
    success: false;
    error: string;
    code?: string;
    details?: any;
}
export interface StatusResponse {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    version: string;
    timestamp: string;
    services: {
        database: ServiceStatus;
        email: ServiceStatus;
        scheduler: ServiceStatus;
        scraper: ServiceStatus;
    };
}
export interface ServiceStatus {
    status: 'up' | 'down' | 'degraded';
    lastCheck: string;
    responseTime?: number;
    error?: string;
}
export interface ScanStatusResponse {
    running: boolean;
    lastScan: {
        start: string | null;
        end: string | null;
        count: number;
        error: string | null;
    };
    nextScan: string | null;
    cronTime: string;
    timezone: string;
}
export interface StockAnalysisRequest {
    symbol: string;
    lookbackDays?: number;
    includeIntraday?: boolean;
}
export interface PortfolioSummaryResponse {
    totalValue: number;
    totalPnl: number;
    totalPnlPercent: number;
    activePositions: number;
    closedPositions: number;
    realizedPnl: number;
    unrealizedPnl: number;
}
export interface PerformanceMetricsResponse {
    daily: {
        pnl: number;
        pnlPercent: number;
    };
    weekly: {
        pnl: number;
        pnlPercent: number;
    };
    monthly: {
        pnl: number;
        pnlPercent: number;
    };
    yearly: {
        pnl: number;
        pnlPercent: number;
    };
}
//# sourceMappingURL=api.d.ts.map