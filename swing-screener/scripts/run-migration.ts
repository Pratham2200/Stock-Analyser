// scripts/run-migration.ts - Runs the AI layers migration SQL
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { createConfig } from '../src/config';
import { createDatabaseConnection } from '../src/database/connection';

async function runMigration() {
    const config = createConfig();
    const pool = createDatabaseConnection(config.database);

    console.log('🚀 Starting migration...');

    try {
        const migrationPath = path.join(__dirname, '../database/ai_layers_migration.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('📄 Reading migration file:', migrationPath);

        // Split by semicolons to execute statements individually if needed, 
        // or just run the whole thing if the driver supports it.
        // pg driver supports multiple statements.
        await pool.query(sql);

        console.log('✅ Migration completed successfully!');

        // Insert default configs
        const insertConfigSql = `
      INSERT INTO ai_analysis_config (layer_type, provider, model_name, prompt_template, is_active)
      VALUES 
          ('rejection_review', 'google_gemini', 'gemini-2.0-flash', 
           'You are a senior swing trading analyst using the 4-RULE STRATEGY. A stock was rejected by the automated screener. Your job is to determine if it deserves manual observation.

=== THE 4-RULE SWING TRADING STRATEGY ===
RULE 1: CONSOLIDATION PHASE
RULE 2: HIGHER LOW STRUCTURE
RULE 3: VOLUME PUMP
RULE 4: BEAR SQUEEZE CANDLE

=== YOUR TASK ===
Analyze if any rule narrowly failed and deserves observation.
STOCK DATA: {{stock_data}}', 
           TRUE),
          ('selection_validation', 'google_gemini', 'gemini-2.0-flash', 
           'You are a senior swing trading analyst using the 4-RULE STRATEGY. A stock PASSED all 4 rules. Your job is to validate it is truly a high-quality trade setup.
STOCK DATA: {{stock_data}}', 
           TRUE)
      ON CONFLICT DO NOTHING;
    `;

        await pool.query(insertConfigSql);
        console.log('✅ Default configurations inserted!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await pool.end();
    }
}

runMigration();
