// src/controllers/BaseController.ts - Base controller class

import { Request, Response, NextFunction } from 'express';
import { BaseService } from '../services/BaseService';
import { ApiResponse, ErrorResponse } from '../types/api';

export abstract class BaseController extends BaseService {
  constructor(controllerName: string) {
    super(controllerName);
  }

  protected success<T>(res: Response, data: T, message?: string, statusCode: number = 200): void {
    const response: ApiResponse<T> = {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString()
    };

    res.status(statusCode).json(response);
  }

  protected error(res: Response, error: string, statusCode: number = 500, code?: string): void {
    const response: ErrorResponse = {
      success: false,
      error,
      code,
      timestamp: new Date().toISOString()
    };

    res.status(statusCode).json(response);
  }

  protected handleAsync(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  protected validateRequired<T>(data: T, fields: (keyof T)[]): void {
    const missing = fields.filter(field => !data[field] && data[field] !== 0);
    
    if (missing.length > 0) {
      throw this.createAppError(
        new Error(`Missing required fields: ${missing.join(', ')}`),
        'Validation failed'
      );
    }
  }

  protected validateQuery(req: Request, fields: string[]): void {
    const missing = fields.filter(field => !req.query[field]);
    
    if (missing.length > 0) {
      throw this.createAppError(
        new Error(`Missing required query parameters: ${missing.join(', ')}`),
        'Validation failed'
      );
    }
  }

  protected sanitizeRequest(req: Request): void {
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

  protected getPaginationParams(req: Request): { page: number; limit: number; offset: number } {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
    const offset = (page - 1) * limit;

    return { page, limit, offset };
  }

  protected createPaginatedResponse<T>(
    data: T[],
    total: number,
    page: number,
    limit: number
  ): any {
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

  protected extractUserAgent(req: Request): string {
    return req.get('User-Agent') || 'Unknown';
  }

  protected getClientIP(req: Request): string {
    return req.ip || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress || 
           (req.connection as any).socket?.remoteAddress || 
           'Unknown';
  }

  protected logRequest(req: Request, method: string, endpoint: string): void {
    this.logger.info(`${method} ${endpoint} - ${this.extractUserAgent(req)} - ${this.getClientIP(req)}`);
  }
}
