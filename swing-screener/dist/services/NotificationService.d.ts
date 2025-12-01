import { BaseService } from './BaseService';
import { AppConfig } from '../types';
export declare class NotificationService extends BaseService {
    private config;
    constructor(config: AppConfig);
    sendEmailNotification(qualifiedCount: number, totalAnalyzed: number): Promise<void>;
    sendErrorNotification(_errorMessage: string, context: string): Promise<void>;
}
//# sourceMappingURL=NotificationService.d.ts.map