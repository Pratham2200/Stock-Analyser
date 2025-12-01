import { Request, Response } from 'express';
import { BaseController } from './BaseController';
import { ScanService } from '../services/ScanService';
import { PriceTrackingService } from '../services/PriceTrackingService';
export declare class ScanController extends BaseController {
    private scanService;
    private priceTrackingService?;
    constructor(scanService: ScanService, priceTrackingService?: PriceTrackingService);
    getStatus: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getProgress: (req: Request, res: Response, next: import("express").NextFunction) => void;
    startScan: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getResults: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getStocks: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getSelectedStocks: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getRejectedStocks: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getScanHistory: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getStatistics: (req: Request, res: Response, next: import("express").NextFunction) => void;
    analyzeStock: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getQuote: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getLogs: (req: Request, res: Response, next: import("express").NextFunction) => void;
    trackSelectedStocksPrices: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getStockPriceHistory: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getSelectedStocksSummary: (req: Request, res: Response, next: import("express").NextFunction) => void;
}
//# sourceMappingURL=ScanController.d.ts.map