// src/app.ts - Main application class

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { Pool } from 'pg';
import { Logger } from './utils/logger-enhanced';
import { AppConfig } from './types';
import { createConfig } from './config';
import { createDatabaseConnection } from './database/connection';

// Services
import { ScanService } from './services/ScanService';
import { StockAnalysisService } from './services/StockAnalysisService';
import { ScraperService } from './services/ScraperService';
import { StockDataService } from './services/StockDataService';
import { PriceTrackingService } from './services/PriceTrackingService';

// Repositories
import { StockRepository } from './repositories/StockRepository';
import { PortfolioRepository } from './repositories/PortfolioRepository';
import { PriceTrackingRepository } from './repositories/PriceTrackingRepository';

// Controllers are imported in routes

// Routes
import { createRoutes } from './routes';

export class App {
  private app: express.Application;
  private config: AppConfig;
  private logger: Logger;
  private pool: Pool;
  private server: any;

  constructor() {
    this.app = express();
    this.config = createConfig();
    this.logger = new Logger('App');
    this.pool = createDatabaseConnection(this.config.database);
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing application...');
      
      await this.setupDatabase();
      await this.setupMiddleware();
      await this.setupServices();
      await this.setupRoutes();
      await this.setupErrorHandling();
      
      this.logger.info('Application initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize application:', error);
      throw error;
    }
  }

  private async setupDatabase(): Promise<void> {
    try {
      // Test database connection with timeout
      await Promise.race([
        this.pool.query('SELECT 1'),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Database connection timeout')), 10000)
        )
      ]);
      this.logger.info('Database connection established successfully');
    } catch (error) {
      this.logger.error('Database connection failed:', error);
      throw new Error(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async setupMiddleware(): Promise<void> {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
      credentials: true
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.'
    });
    this.app.use('/api/', limiter);

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req, _res, next) => {
      this.logger.info(`${req.method} ${req.path} - ${req.get('User-Agent') || 'Unknown'}`);
      next();
    });
  }

  private async setupServices(): Promise<void> {
    try {
      // Initialize repositories
      const stockRepository = new StockRepository(this.pool);
      const portfolioRepository = new PortfolioRepository(this.pool);
      const priceTrackingRepository = new PriceTrackingRepository(this.pool);

      // Initialize services
      const stockAnalysisService = new StockAnalysisService();
      const scraperService = new ScraperService();
      const stockDataService = new StockDataService();

      // Initialize scan service
      const scanService = new ScanService(
        stockRepository,
        stockAnalysisService,
        scraperService,
        stockDataService,
        this.config,
        priceTrackingRepository
      );

      // Initialize price tracking service
      const priceTrackingService = new PriceTrackingService(
        stockDataService,
        priceTrackingRepository
      );

      // Store services in app for use in controllers
      this.app.locals.services = {
        scanService,
        stockAnalysisService,
        scraperService,
        priceTrackingService
      };

      this.app.locals.repositories = {
        stockRepository,
        portfolioRepository,
        priceTrackingRepository
      };

      this.logger.info('Services initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize services:', error);
      throw new Error(`Service initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async setupRoutes(): Promise<void> {
    const routes = createRoutes(this.app.locals.services, this.app.locals.repositories, this.pool);
    this.app.use('/api', routes);

    // Serve static files
    this.app.use(express.static('client/dist'));

    // SPA fallback
    this.app.get('*', (req, res) => {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
      }
      return res.sendFile('client/dist/index.html', { root: process.cwd() });
    });

    this.logger.info('Routes configured');
  }

  private async setupErrorHandling(): Promise<void> {
    // 404 handler
    this.app.use((_req, res) => {
      res.status(404).json({
        success: false,
        error: 'Not found',
        timestamp: new Date().toISOString()
      });
    });

    // Global error handler
    this.app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      this.logger.error('Unhandled error:', error);
      
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || 'Internal server error',
        code: error.code,
        timestamp: new Date().toISOString()
      });
    });
  }

  async start(): Promise<void> {
    try {
      const port = this.config.dashboard.port;
      
      this.server = this.app.listen(port, () => {
        this.logger.info(`🚀 Server running on http://localhost:${port}`);
        this.logger.info(`📊 API available at http://localhost:${port}/api`);
        this.logger.info(`🎯 Frontend available at http://localhost:5173`);
      });

      // Graceful shutdown
      process.on('SIGINT', () => this.shutdown());
      process.on('SIGTERM', () => this.shutdown());

    } catch (error) {
      this.logger.error('Failed to start server:', error);
      throw error;
    }
  }

  private async shutdown(): Promise<void> {
    this.logger.info('Shutting down gracefully...');
    
    if (this.server) {
      this.server.close(() => {
        this.logger.info('Server closed');
      });
    }

    if (this.pool) {
      await this.pool.end();
      this.logger.info('Database connection closed');
    }

    process.exit(0);
  }

  getApp(): express.Application {
    return this.app;
  }
}
