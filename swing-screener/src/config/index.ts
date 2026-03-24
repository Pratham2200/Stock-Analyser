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
    },
    ai: {
      enabled: process.env.ENABLE_AI_LAYER !== 'false',
      apiKey: process.env.GEMINI_API_KEY || '',
      model: process.env.AI_MODEL || 'gemini-2.0-flash-exp',
      temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
      maxTokens: parseInt(process.env.AI_MAX_TOKENS || '1000'),
      rateLimitMs: parseInt(process.env.AI_RATE_LIMIT_MS || '4500'),
      confidenceThreshold: parseInt(process.env.AI_CONFIDENCE_THRESHOLD || '70'),
      groqApiKey: process.env.GROQ_API_KEY || '',
      groqModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
      openRouterModel: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free'
    }
  };
}