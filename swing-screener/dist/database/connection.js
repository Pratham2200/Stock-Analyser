"use strict";
// src/database/connection.ts - Database connection management
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDatabaseConnection = createDatabaseConnection;
exports.testConnection = testConnection;
const pg_1 = require("pg");
const logger_enhanced_1 = require("../utils/logger-enhanced");
const logger = new logger_enhanced_1.Logger('Database');
function createDatabaseConnection(config) {
    let poolConfig;
    // Prioritize DATABASE_URL for production (Supabase/Render)
    if (process.env.DATABASE_URL) {
        logger.info('Using DATABASE_URL for database connection (Production mode)');
        poolConfig = {
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false // Required for Supabase connections
            },
            max: config.max,
            idleTimeoutMillis: config.idleTimeoutMillis,
            connectionTimeoutMillis: config.connectionTimeoutMillis
        };
    }
    else {
        // Fallback to local config for development
        logger.info('Using local database configuration (Development mode)');
        poolConfig = {
            host: config.host,
            port: config.port,
            database: config.database,
            user: config.user,
            password: config.password,
            ssl: config.ssl,
            max: config.max,
            idleTimeoutMillis: config.idleTimeoutMillis,
            connectionTimeoutMillis: config.connectionTimeoutMillis
        };
    }
    const pool = new pg_1.Pool(poolConfig);
    // Handle pool errors
    pool.on('error', (err) => {
        logger.error('Unexpected error on idle client', err);
    });
    // Test connection
    pool.query('SELECT 1')
        .then(() => {
        logger.info('Database connection established successfully');
    })
        .catch((err) => {
        logger.error('Database connection failed:', err);
    });
    return pool;
}
async function testConnection(pool) {
    try {
        await pool.query('SELECT 1');
        return true;
    }
    catch (error) {
        logger.error('Database connection test failed:', error);
        return false;
    }
}
//# sourceMappingURL=connection.js.map