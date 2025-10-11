// src/config/index.ts - Configuration management

import { AppConfig } from '../types';

export function createConfig(): AppConfig {
  return {
    env: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    database: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'stock_analysis',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000')
    },
    email: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      from: process.env.SMTP_FROM || process.env.SMTP_USER || ''
    },
    scheduler: {
      enabled: process.env.SCHEDULER_ENABLED === 'true',
      timezone: process.env.SCHEDULER_TIMEZONE || 'Asia/Kolkata',
      scanCron: process.env.SCHEDULER_CRON || '0 9 * * 1-5' // 9 AM on weekdays
    },
    dashboard: {
      port: parseInt(process.env.DASHBOARD_PORT || '4000'),
      enabled: process.env.DASHBOARD_ENABLED !== 'false'
    },
    notifications: {
      sendEmail: process.env.SEND_EMAIL === 'true',
      sendTelegram: process.env.SEND_TELEGRAM === 'true'
    }
  };
}