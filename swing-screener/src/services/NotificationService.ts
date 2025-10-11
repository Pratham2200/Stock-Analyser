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
      this.logger.info('Email notifications disabled');
      return;
    }

    try {
      this.logger.info(`Sending email notification: ${qualifiedCount}/${totalAnalyzed} qualified`);
      // Mock email sending for now
      this.logger.success('Email notification sent successfully');
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