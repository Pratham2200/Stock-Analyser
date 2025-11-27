// src/config/index.ts - Configuration management

import { AppConfig } from '../types';

export function createConfig(): AppConfig {
  return {
    env: process.env.NODE_ENV || 'development',
    logLevel: 'info',
    database: {
      host: 'localhost',
      port: 5432,
      database: 'stock_analysis',
      user: 'postgres',
      password: 'password',
      ssl: false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    },
    email: {
      host: 'smtp.gmail.com',
      port: 587,
      user: 'your-email@gmail.com',
      pass: 'your-app-password',
      from: 'your-email@gmail.com'
    },
    scheduler: {
      enabled: true,
      timezone: 'Asia/Kolkata',
      scanCron: '0 9 * * 1-5' // 9 AM on weekdays
    },
    dashboard: {
      port: 4000,
      enabled: true
    },
    notifications: {
      sendEmail: false,
      sendTelegram: false
    }
  };
}