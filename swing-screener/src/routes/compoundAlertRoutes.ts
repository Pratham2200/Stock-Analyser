// src/routes/compoundAlertRoutes.ts — REST API for Smart Compound Alerts

import { Router, Request, Response } from 'express';
import { CompoundAlertService } from '../services/CompoundAlertService';

export function createCompoundAlertRoutes(
  alertService: CompoundAlertService
): Router {
  const router = Router();

  // POST /api/alerts — Create a new compound alert
  router.post('/', (req: Request, res: Response) => {
    try {
      const { userId, symbol, name, conditions, logic } = req.body;

      if (!userId || !symbol || !conditions || !logic) {
        res.status(400).json({
          success: false,
          error: 'Required: userId, symbol, conditions, logic',
        });
        return;
      }

      const result = alertService.createAlert({
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
  router.get('/:userId', (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const result = alertService.getUserAlerts(userId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // DELETE /api/alerts/:id — Delete an alert
  router.delete('/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const success = alertService.deleteAlert(id);
      res.json({ success });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/alerts/trigger-evaluation — Manually force an evaluation (For Testing)
  router.post('/trigger-evaluation', async (req: Request, res: Response) => {
    try {
      await alertService.evaluateAllAlerts();
      res.json({ success: true, message: 'Evaluation completed' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
