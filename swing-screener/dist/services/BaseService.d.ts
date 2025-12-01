import { Logger } from '../utils/logger-enhanced';
import { AppError } from '../types';
export declare abstract class BaseService {
    protected logger: Logger;
    protected serviceName: string;
    constructor(serviceName: string);
    protected handleError(error: unknown, context: string): never;
    protected createAppError(error: unknown, context: string): AppError;
    protected executeWithRetry<T>(operation: () => Promise<T>, maxRetries?: number, delay?: number): Promise<T>;
    protected delay(ms: number): Promise<void>;
    protected validateRequired<T>(data: T, fields: (keyof T)[]): void;
    protected sanitizeInput(input: any): any;
}
//# sourceMappingURL=BaseService.d.ts.map