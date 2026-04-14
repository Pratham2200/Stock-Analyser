// src/routes/eventCalendarRoutes.ts

import { Router, Request, Response } from 'express';
import { EventCalendarService } from '../services/EventCalendarService';

export function createEventCalendarRoutes(eventService: EventCalendarService): Router {
  const router = Router();

  // GET /api/events/:year/:month
  router.get('/:year/:month', async (req: Request, res: Response) => {
    try {
      const year = parseInt(req.params.year);
      const month = parseInt(req.params.month);
      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        res.status(400).json({ success: false, error: 'Invalid year or month' });
        return;
      }
      const result = await eventService.getMonthlyCalendar(year, month);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
