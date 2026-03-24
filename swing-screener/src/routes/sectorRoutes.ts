// src/routes/sectorRoutes.ts — REST API for Sector Rotation Radar

import { Router, Request, Response } from 'express';
import { SectorRotationService } from '../services/SectorRotationService';

export function createSectorRoutes(
  sectorRotationService: SectorRotationService
): Router {
  const router = Router();

  // GET /api/sectors/rotation — Get realtime sector relative strength map
  router.get('/rotation', async (req: Request, res: Response) => {
    try {
      const result = await sectorRotationService.getRotationMap();
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
