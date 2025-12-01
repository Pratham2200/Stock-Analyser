"use strict";
// src/services/NotificationService.ts - Notification service
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const BaseService_1 = require("./BaseService");
class NotificationService extends BaseService_1.BaseService {
    constructor(config) {
        super('NotificationService');
        this.config = config;
    }
    async sendEmailNotification(qualifiedCount, totalAnalyzed) {
        if (!this.config.notifications.sendEmail) {
            this.logger.info('Email notifications disabled');
            return;
        }
        try {
            this.logger.info(`Sending email notification: ${qualifiedCount}/${totalAnalyzed} qualified`);
            // Mock email sending for now
            this.logger.success('Email notification sent successfully');
        }
        catch (error) {
            this.logger.error('Failed to send email notification:', error);
        }
    }
    async sendErrorNotification(_errorMessage, context) {
        if (!this.config.notifications.sendEmail) {
            this.logger.info('Email notifications disabled');
            return;
        }
        try {
            this.logger.info(`Sending error notification: ${context}`);
            // Mock error notification for now
            this.logger.success('Error notification sent successfully');
        }
        catch (error) {
            this.logger.error('Failed to send error notification:', error);
        }
    }
}
exports.NotificationService = NotificationService;
//# sourceMappingURL=NotificationService.js.map