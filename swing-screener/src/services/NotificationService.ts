// src/services/NotificationService.ts - Notification service

import nodemailer from 'nodemailer';
import { BaseService } from './BaseService';
import { AppConfig } from '../types';

export class NotificationService extends BaseService {
  private config: AppConfig;
  private transporter: nodemailer.Transporter | null = null;

  constructor(config: AppConfig) {
    super('NotificationService');
    this.config = config;
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    try {
      if (this.config.email.host && this.config.email.user && this.config.email.pass) {
        this.transporter = nodemailer.createTransport({
          host: this.config.email.host,
          port: this.config.email.port,
          secure: this.config.email.port === 465, // true for 465, false for other ports
          auth: {
            user: this.config.email.user,
            pass: this.config.email.pass,
          },
        });

        this.logger.info('Email transporter initialized successfully');
      } else {
        this.logger.warn('Email configuration incomplete - notifications will be logged only');
      }
    } catch (error) {
      this.logger.error('Failed to initialize email transporter:', error);
    }
  }

  async sendEmailNotification(qualifiedCount: number, totalAnalyzed: number): Promise<void> {
    if (!this.config.notifications.sendEmail) {
      this.logger.info('Email notifications disabled');
      return;
    }

    if (!this.transporter) {
      this.logger.warn('Email transporter not initialized - logging notification only');
      this.logger.info(`📧 SCAN COMPLETE: ${qualifiedCount}/${totalAnalyzed} stocks qualified`);
      return;
    }

    try {
      const successRate = totalAnalyzed > 0 ? ((qualifiedCount / totalAnalyzed) * 100).toFixed(1) : '0.0';

      const mailOptions = {
        from: this.config.email.from,
        to: this.config.email.from, // Send to self for now
        subject: `🎯 Stock Scan Complete - ${qualifiedCount} Qualified Stocks`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1976d2;">Stock Analysis Scan Complete</h2>
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Scan Results:</h3>
              <ul>
                <li><strong>Qualified Stocks:</strong> ${qualifiedCount}</li>
                <li><strong>Total Analyzed:</strong> ${totalAnalyzed}</li>
                <li><strong>Success Rate:</strong> ${successRate}%</li>
                <li><strong>Scan Time:</strong> ${new Date().toLocaleString()}</li>
              </ul>
            </div>
            <p style="color: #666;">
              ${qualifiedCount > 0
                ? 'Qualified stocks have been added to your portfolio for tracking.'
                : 'No stocks qualified this scan. Consider adjusting your strategy parameters.'}
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #999;">
              This is an automated notification from your Stock Analysis Pro system.
            </p>
          </div>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.success(`✅ Email notification sent successfully: ${info.messageId}`);
    } catch (error) {
      this.logger.error('❌ Failed to send email notification:', error);
      throw error;
    }
  }

  async sendErrorNotification(errorMessage: string, context: string): Promise<void> {
    if (!this.config.notifications.sendEmail) {
      this.logger.info('Email notifications disabled');
      return;
    }

    if (!this.transporter) {
      this.logger.warn('Email transporter not initialized - logging error only');
      this.logger.error(`🚨 ERROR in ${context}: ${errorMessage}`);
      return;
    }

    try {
      const mailOptions = {
        from: this.config.email.from,
        to: this.config.email.from, // Send to self for now
        subject: `🚨 Stock Analysis Error - ${context}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #d32f2f;">System Error Alert</h2>
            <div style="background-color: #ffebee; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d32f2f;">
              <h3>Error Details:</h3>
              <ul>
                <li><strong>Context:</strong> ${context}</li>
                <li><strong>Error:</strong> ${errorMessage}</li>
                <li><strong>Time:</strong> ${new Date().toLocaleString()}</li>
              </ul>
            </div>
            <p style="color: #666;">
              Please check the system logs and resolve this issue promptly.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #999;">
              This is an automated error notification from your Stock Analysis Pro system.
            </p>
          </div>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.success(`✅ Error notification email sent: ${info.messageId}`);
    } catch (error) {
      this.logger.error('❌ Failed to send error notification email:', error);
      throw error;
    }
  }
}