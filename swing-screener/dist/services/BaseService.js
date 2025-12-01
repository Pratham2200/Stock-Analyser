"use strict";
// src/services/BaseService.ts - Base service class
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseService = void 0;
const logger_enhanced_1 = require("../utils/logger-enhanced");
class BaseService {
    constructor(serviceName) {
        this.serviceName = serviceName;
        this.logger = new logger_enhanced_1.Logger(serviceName);
    }
    handleError(error, context) {
        const appError = this.createAppError(error, context);
        this.logger.error(`[${this.serviceName}] ${context}:`, appError.message);
        throw appError;
    }
    createAppError(error, context) {
        if (error instanceof Error) {
            return {
                ...error,
                name: 'AppError',
                code: 'SERVICE_ERROR',
                statusCode: 500,
                isOperational: true,
                message: `${this.serviceName} - ${context}: ${error.message}`
            };
        }
        return {
            name: 'AppError',
            message: `${this.serviceName} - ${context}: Unknown error`,
            code: 'SERVICE_ERROR',
            statusCode: 500,
            isOperational: true
        };
    }
    async executeWithRetry(operation, maxRetries = 3, delay = 1000) {
        let lastError;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            }
            catch (error) {
                lastError = error;
                this.logger.warn(`[${this.serviceName}] Attempt ${attempt}/${maxRetries} failed:`, lastError.message);
                if (attempt < maxRetries) {
                    await this.delay(delay * attempt);
                }
            }
        }
        throw this.createAppError(lastError, `Retry failed after ${maxRetries} attempts`);
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    validateRequired(data, fields) {
        for (const field of fields) {
            if (data[field] === undefined || data[field] === null || data[field] === '') {
                throw this.createAppError(new Error(`Required field '${String(field)}' is missing or empty`), 'Validation failed');
            }
        }
    }
    sanitizeInput(input) {
        if (typeof input === 'string') {
            return input.trim();
        }
        if (typeof input === 'object' && input !== null) {
            const sanitized = {};
            for (const [key, value] of Object.entries(input)) {
                sanitized[key] = this.sanitizeInput(value);
            }
            return sanitized;
        }
        return input;
    }
}
exports.BaseService = BaseService;
//# sourceMappingURL=BaseService.js.map