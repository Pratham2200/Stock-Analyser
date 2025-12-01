import express from 'express';
export declare class App {
    private app;
    private config;
    private logger;
    private pool;
    private server;
    constructor();
    initialize(): Promise<void>;
    private setupDatabase;
    private setupMiddleware;
    private setupServices;
    private setupRoutes;
    private setupErrorHandling;
    start(): Promise<void>;
    private shutdown;
    getApp(): express.Application;
}
//# sourceMappingURL=app.d.ts.map