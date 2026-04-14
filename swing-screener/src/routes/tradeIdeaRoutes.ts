// src/routes/tradeIdeaRoutes.ts

import { Router, Request, Response } from 'express';
import { TradeIdeaService } from '../services/TradeIdeaService';

export function createTradeIdeaRoutes(tradeIdeaService: TradeIdeaService): Router {
  const router = Router();

  // POST /api/ideas/generate — Generate a new trade idea
  router.post('/generate', async (req: Request, res: Response) => {
    try {
      const { symbol } = req.body;
      if (!symbol) { res.status(400).json({ success: false, error: 'Required: symbol' }); return; }
      const idea = await tradeIdeaService.generateIdea(symbol);
      res.json({ success: true, data: idea });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/ideas — Get recent ideas
  router.get('/', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const ideas = tradeIdeaService.getRecentIdeas(limit);
      res.json({ success: true, data: ideas });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/ideas/:id/vote — Vote on an idea
  router.post('/:id/vote', (req: Request, res: Response) => {
    try {
      const { direction } = req.body;
      if (direction !== 'up' && direction !== 'down') {
        res.status(400).json({ success: false, error: 'direction must be "up" or "down"' });
        return;
      }
      const idea = tradeIdeaService.vote(req.params.id, direction);
      res.json({ success: true, data: idea });
    } catch (error: any) {
      res.status(404).json({ success: false, error: error.message });
    }
  });

  return router;
}
