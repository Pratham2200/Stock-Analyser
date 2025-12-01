"use strict";
// src/controllers/BaseController.ts - Base controller class
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseController = void 0;
const BaseService_1 = require("../services/BaseService");
class BaseController extends BaseService_1.BaseService {
    constructor(controllerName) {
        super(controllerName);
    }
    success(res, data, message, statusCode = 200) {
        const response = {
            success: true,
            data,
            message,
            timestamp: new Date().toISOString()
        };
        res.status(statusCode).json(response);
    }
    error(res, error, statusCode = 500, code) {
        const response = {
            success: false,
            error,
            code,
            timestamp: new Date().toISOString()
        };
        res.status(statusCode).json(response);
    }
    handleAsync(fn) {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(next);
        };
    }
    // validateRequired is inherited from BaseService
    validateQuery(req, fields) {
        const missing = fields.filter(field => !req.query[field]);
        if (missing.length > 0) {
            throw this.createAppError(new Error(`Missing required query parameters: ${missing.join(', ')}`), 'Validation failed');
        }
    }
    sanitizeRequest(req) {
        if (req.body) {
            req.body = this.sanitizeInput(req.body);
        }
        if (req.query) {
            req.query = this.sanitizeInput(req.query);
        }
        if (req.params) {
            req.params = this.sanitizeInput(req.params);
        }
    }
    getPaginationParams(req) {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
        const offset = (page - 1) * limit;
        return { page, limit, offset };
    }
    createPaginatedResponse(data, total, page, limit) {
        const totalPages = Math.ceil(total / limit);
        return {
            success: true,
            data,
            timestamp: new Date().toISOString(),
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        };
    }
    extractUserAgent(req) {
        return req.get('User-Agent') || 'Unknown';
    }
    getClientIP(req) {
        return req.ip ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            req.connection.socket?.remoteAddress ||
            'Unknown';
    }
    logRequest(req, method, endpoint) {
        this.logger.info(`${method} ${endpoint} - ${this.extractUserAgent(req)} - ${this.getClientIP(req)}`);
    }
}
exports.BaseController = BaseController;
//# sourceMappingURL=BaseController.js.map