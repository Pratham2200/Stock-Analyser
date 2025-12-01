"use strict";
// src/app.ts - Main application class
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.App = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const logger_enhanced_1 = require("./utils/logger-enhanced");
const config_1 = require("./config");
const connection_1 = require("./database/connection");
// Services
const ScanService_1 = require("./services/ScanService");
const StockAnalysisService_1 = require("./services/StockAnalysisService");
const ScraperService_1 = require("./services/ScraperService");
const StockDataService_1 = require("./services/StockDataService");
const PriceTrackingService_1 = require("./services/PriceTrackingService");
// Repositories
const StockRepository_1 = require("./repositories/StockRepository");
const PortfolioRepository_1 = require("./repositories/PortfolioRepository");
const PriceTrackingRepository_1 = require("./repositories/PriceTrackingRepository");
// Controllers are imported in routes
// Routes
const routes_1 = require("./routes");
class App {
    constructor() {
        this.app = (0, express_1.default)();
        this.config = (0, config_1.createConfig)();
        this.logger = new logger_enhanced_1.Logger('App');
        this.pool = (0, connection_1.createDatabaseConnection)(this.config.database);
    }
    async initialize() {
        try {
            this.logger.info('Initializing application...');
            await this.setupDatabase();
            await this.setupMiddleware();
            await this.setupServices();
            await this.setupRoutes();
            await this.setupErrorHandling();
            this.logger.info('Application initialized successfully');
        }
        catch (error) {
            this.logger.error('Failed to initialize application:', error);
            throw error;
        }
    }
    async setupDatabase() {
        try {
            await this.pool.query('SELECT 1');
            this.logger.info('Database connection established');
        }
        catch (error) {
            this.logger.error('Database connection failed:', error);
            throw error;
        }
    }
    async setupMiddleware() {
        // Trust proxy (required for Render's load balancer)
        this.app.set('trust proxy', 1);
        // Security middleware
        this.app.use((0, helmet_1.default)());
        // CORS configuration - use ALLOWED_ORIGINS for Render, fallback to localhost
        const allowedOrigins = process.env.ALLOWED_ORIGINS
            ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
            : ['http://localhost:3000', 'http://localhost:5173'];
        this.app.use((0, cors_1.default)({
            origin: (origin, callback) => {
                // Allow requests with no origin (like mobile apps or curl requests)
                if (!origin) {
                    return callback(null, true);
                }
                if (allowedOrigins.indexOf(origin) !== -1) {
                    callback(null, true);
                }
                else {
                    callback(new Error('Not allowed by CORS'));
                }
            },
            credentials: true
        }));
        // Rate limiting
        const limiter = (0, express_rate_limit_1.default)({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // limit each IP to 100 requests per windowMs
            message: 'Too many requests from this IP, please try again later.',
            standardHeaders: true,
            legacyHeaders: false
        });
        this.app.use('/api/', limiter);
        // Compression
        this.app.use((0, compression_1.default)());
        // Body parsing
        this.app.use(express_1.default.json({ limit: '10mb' }));
        this.app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
        // Request logging
        this.app.use((req, _res, next) => {
            this.logger.info(`${req.method} ${req.path} - ${req.get('User-Agent') || 'Unknown'}`);
            next();
        });
    }
    async setupServices() {
        // Initialize repositories
        const stockRepository = new StockRepository_1.StockRepository(this.pool);
        const portfolioRepository = new PortfolioRepository_1.PortfolioRepository(this.pool);
        const priceTrackingRepository = new PriceTrackingRepository_1.PriceTrackingRepository(this.pool);
        // Initialize services
        const stockAnalysisService = new StockAnalysisService_1.StockAnalysisService();
        const scraperService = new ScraperService_1.ScraperService();
        const stockDataService = new StockDataService_1.StockDataService();
        // Initialize scan service
        const scanService = new ScanService_1.ScanService(stockRepository, stockAnalysisService, scraperService, stockDataService, this.config, priceTrackingRepository);
        // Initialize price tracking service
        const priceTrackingService = new PriceTrackingService_1.PriceTrackingService(stockDataService, priceTrackingRepository);
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
        this.logger.info('Services initialized');
    }
    async setupRoutes() {
        const routes = (0, routes_1.createRoutes)(this.app.locals.services, this.app.locals.repositories, this.pool);
        this.app.use('/api', routes);
        // Serve static files
        this.app.use(express_1.default.static('client/dist'));
        // SPA fallback
        this.app.get('*', (req, res) => {
            if (req.path.startsWith('/api/')) {
                return res.status(404).json({ error: 'API endpoint not found' });
            }
            return res.sendFile('client/dist/index.html', { root: process.cwd() });
        });
        this.logger.info('Routes configured');
    }
    async setupErrorHandling() {
        // 404 handler
        this.app.use((_req, res) => {
            res.status(404).json({
                success: false,
                error: 'Not found',
                timestamp: new Date().toISOString()
            });
        });
        // Global error handler
        this.app.use((error, _req, res, _next) => {
            this.logger.error('Unhandled error:', error);
            res.status(error.statusCode || 500).json({
                success: false,
                error: error.message || 'Internal server error',
                code: error.code,
                timestamp: new Date().toISOString()
            });
        });
    }
    async start() {
        try {
            // Use PORT from Render (automatically set) or fallback to config
            const port = process.env.PORT ? parseInt(process.env.PORT, 10) : this.config.dashboard.port;
            const host = '0.0.0.0'; // Required for Render
            this.server = this.app.listen(port, host, () => {
                const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
                const baseUrl = `${protocol}://localhost:${port}`;
                this.logger.info(`🚀 Server running on ${host}:${port}`);
                this.logger.info(`📊 API available at ${baseUrl}/api`);
                if (process.env.NODE_ENV !== 'production') {
                    this.logger.info(`🎯 Frontend available at http://localhost:5173`);
                }
            });
            // Graceful shutdown
            process.on('SIGINT', () => this.shutdown());
            process.on('SIGTERM', () => this.shutdown());
        }
        catch (error) {
            this.logger.error('Failed to start server:', error);
            throw error;
        }
    }
    async shutdown() {
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
    getApp() {
        return this.app;
    }
}
exports.App = App;
//# sourceMappingURL=app.js.map