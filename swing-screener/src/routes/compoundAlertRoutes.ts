// src/routes/compoundAlertRoutes.ts — REST API for Smart Compound Alerts
// PHASE D: Updated to match async PostgreSQL-based service

import { Router, Request, Response } from 'express';
import { CompoundAlertService } from '../services/CompoundAlertService';

export function createCompoundAlertRoutes(
  alertService: CompoundAlertService
): Router {
  const router = Router();

  // POST /api/alerts — Create a new compound alert
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { userId, symbol, name, conditions, logic } = req.body;

      if (!userId || !symbol || !conditions || !logic) {
        res.status(400).json({
          success: false,
          error: 'Required: userId, symbol, conditions, logic',
        });
        return;
      }

      const result = await alertService.createAlert({
        userId,
        symbol: symbol.toUpperCase(),
        name: name || `${symbol} Alert`,
        conditions,
        logic,
      });

      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/alerts/:userId — Get all active alerts for a user
  router.get('/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const result = await alertService.getUserAlerts(userId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // DELETE /api/alerts/:id — Delete an alert
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, error: 'Invalid alert ID' });
        return;
      }
      const success = await alertService.deleteAlert(id);
      res.json({ success });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/alerts/trigger-evaluation — Manually trigger alert scan
  router.post('/trigger-evaluation', async (req: Request, res: Response) => {
    try {
      const result = await alertService.scanAlerts();
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
