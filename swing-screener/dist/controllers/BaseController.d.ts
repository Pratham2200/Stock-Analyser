import { Request, Response, NextFunction } from 'express';
import { BaseService } from '../services/BaseService';
export declare abstract class BaseController extends BaseService {
    constructor(controllerName: string);
    protected success<T>(res: Response, data: T, message?: string, statusCode?: number): void;
    protected error(res: Response, error: string, statusCode?: number, code?: string): void;
    protected handleAsync(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): (req: Request, res: Response, next: NextFunction) => void;
    protected validateQuery(req: Request, fields: string[]): void;
    protected sanitizeRequest(req: Request): void;
    protected getPaginationParams(req: Request): {
        page: number;
        limit: number;
        offset: number;
    };
    protected createPaginatedResponse<T>(data: T[], total: number, page: number, limit: number): any;
    protected extractUserAgent(req: Request): string;
    protected getClientIP(req: Request): string;
    protected logRequest(req: Request, method: string, endpoint: string): void;
}
//# sourceMappingURL=BaseController.d.ts.map