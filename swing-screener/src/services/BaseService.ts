// src/services/BaseService.ts - Base service class

import { Logger } from '../utils/logger-enhanced';
import { AppError } from '../types';

export abstract class BaseService {
  protected logger: Logger;
  protected serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.logger = new Logger(serviceName);
  }

  protected handleError(error: unknown, context: string): never {
    const appError = this.createAppError(error, context);
    this.logger.error(`[${this.serviceName}] ${context}:`, appError.message);
    throw appError;
  }

  protected createAppError(error: unknown, context: string): AppError {
    if (error instanceof Error) {
      return {
        ...error,
        name: 'AppError',
        code: 'SERVICE_ERROR',
        statusCode: 500,
        isOperational: true,
        message: `${this.serviceName} - ${context}: ${error.message}`
      } as AppError;
    }

    return {
      name: 'AppError',
      message: `${this.serviceName} - ${context}: Unknown error`,
      code: 'SERVICE_ERROR',
      statusCode: 500,
      isOperational: true
    } as AppError;
  }

  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`[${this.serviceName}] Attempt ${attempt}/${maxRetries} failed:`, lastError.message);
        
        if (attempt < maxRetries) {
          await this.delay(delay * attempt);
        }
      }
    }

    throw this.createAppError(lastError!, `Retry failed after ${maxRetries} attempts`);
  }

  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected validateRequired<T>(data: T, fields: (keyof T)[]): void {
    for (const field of fields) {
      if (data[field] === undefined || data[field] === null || data[field] === '') {
        throw this.createAppError(
          new Error(`Required field '${String(field)}' is missing or empty`),
          'Validation failed'
        );
      }
    }
  }

  protected sanitizeInput(input: any): any {
    if (typeof input === 'string') {
      return input.trim();
    }
    if (typeof input === 'object' && input !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[key] = this.sanitizeInput(value);
      }
      return sanitized;
    }
    return input;
  }
}
