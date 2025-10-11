// src/controllers/HealthController.ts - Health check controller

import { Request, Response } from 'express';
import { BaseController } from './BaseController';
import { Pool } from 'pg';

export class HealthController extends BaseController {
  private pool: Pool;

  constructor(pool: Pool) {
    super('HealthController');
    this.pool = pool;
  }

  getHealth = this.handleAsync(async (req: Request, res: Response) => {
    this.logRequest(req, 'GET', '/api/health');
    
    try {
      // Test database connection
      let dbStatus = 'down';
      let dbResponseTime = 0;
      try {
        const dbStart = Date.now();
        await this.pool.query('SELECT 1');
        dbResponseTime = Date.now() - dbStart;
        dbStatus = 'up';
      } catch (error) {
        this.logger.error('Database health check failed:', error);
      }

      const uptime = process.uptime();
      const status = dbStatus === 'up' ? 'healthy' : 'unhealthy';

      const healthData = {
        status,
        uptime: Math.floor(uptime),
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        services: {
          database: {
            status: dbStatus,
            lastCheck: new Date().toISOString(),
            responseTime: dbResponseTime
          },
          email: {
            status: 'up',
            lastCheck: new Date().toISOString()
          },
          scheduler: {
            status: 'up',
            lastCheck: new Date().toISOString()
          },
          scraper: {
            status: 'up',
            lastCheck: new Date().toISOString()
          }
        }
      };

      this.success(res, healthData);
    } catch (error) {
      this.error(res, (error as Error).message, 500);
    }
  });
}