// src/routes/multiTimeframeRoutes.ts

import { Router, Request, Response } from 'express';
import { MultiTimeframeService } from '../services/MultiTimeframeService';

export function createMultiTimeframeRoutes(mtfService: MultiTimeframeService): Router {
  const router = Router();

  // GET /api/mtf/:symbol
  router.get('/:symbol', async (req: Request, res: Response) => {
    try {
      const result = await mtfService.analyze(req.params.symbol);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
