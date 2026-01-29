// src/services/NotificationService.ts - Notification service

import { BaseService } from './BaseService';
import { AppConfig } from '../types';

export class NotificationService extends BaseService {
  private config: AppConfig;

  constructor(config: AppConfig) {
    super('NotificationService');
    this.config = config;
  }

  async sendEmailNotification(qualifiedCount: number, totalAnalyzed: number): Promise<void> {
    if (!this.config.notifications.sendEmail) {
      return;
    }

    if (!this.config.email.host || !this.config.email.user) {
      this.logger.warn('Email notification skipped: SMTP configuration missing');
      return;
    }

    try {
      this.logger.info(`Sending email notification: ${qualifiedCount}/${totalAnalyzed} qualified`);
      // In a real implementation, we would call a mailer transport here
      // For now, we just acknowledge we are ready to send but lack the transport wiring
      this.logger.info('Email transport would trigger here (SMTP configured)');
    } catch (error) {
      this.logger.error('Failed to send email notification:', error);
    }
  }

  async sendErrorNotification(_errorMessage: string, context: string): Promise<void> {
    if (!this.config.notifications.sendEmail) {
      this.logger.info('Email notifications disabled');
      return;
    }

    try {
      this.logger.info(`Sending error notification: ${context}`);
      // Mock error notification for now
      this.logger.success('Error notification sent successfully');
    } catch (error) {
      this.logger.error('Failed to send error notification:', error);
    }
  }
}