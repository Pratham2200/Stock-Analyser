import { Request, Response } from 'express';
import { BaseController } from './BaseController';
import { Pool } from 'pg';
export declare class HealthController extends BaseController {
    private pool;
    constructor(pool: Pool);
    getHealth: (req: Request, res: Response, next: import("express").NextFunction) => void;
}
//# sourceMappingURL=HealthController.d.ts.map