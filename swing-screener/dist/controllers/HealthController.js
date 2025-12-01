"use strict";
// src/controllers/HealthController.ts - Health check controller
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthController = void 0;
const BaseController_1 = require("./BaseController");
class HealthController extends BaseController_1.BaseController {
    constructor(pool) {
        super('HealthController');
        this.getHealth = this.handleAsync(async (req, res) => {
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
                }
                catch (error) {
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
            }
            catch (error) {
                this.error(res, error.message, 500);
            }
        });
        this.pool = pool;
    }
}
exports.HealthController = HealthController;
//# sourceMappingURL=HealthController.js.map