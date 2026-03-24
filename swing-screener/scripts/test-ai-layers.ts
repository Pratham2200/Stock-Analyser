// scripts/test-ai-layers.ts - Thorough verification of AI layers and edge cases
import 'dotenv/config';
import { Pool } from 'pg';
import { AILayerOrchestrator } from '../src/services/AILayerOrchestrator';
import { createConfig } from '../src/config';
import { createDatabaseConnection } from '../src/database/connection';
import { AIApiLog } from '../src/types/ai';

async function runTests() {
    const config = createConfig();
    const pool = createDatabaseConnection(config.database);
    const orchestrator = new AILayerOrchestrator(pool);

    console.log('\n🧪 STARTING AI LAYERS VERIFICATION SUITE\n');

    if (!orchestrator.isEnabled()) {
        console.error('❌ AI Orchestrator is disabled! Check GEMINI_API_KEY in .env');
        process.exit(1);
    }

    // TEST CASE 1: Marginal Failure (Layer 1 Review)
    // Stock failed Bear Squeeze (38% < 40% threshold)
    const marginalStock = {
        stockId: 1324, // Real ID
        scanId: 13, // Real ID
        symbol: 'TATAMOTORS',
        name: 'Tata Motors Ltd.',
        qualified: false,
        analysisDetails: {
            consolidation: { pass: true, base: 800, currentPrice: 850, percentGain: 6.25, zoneCount: 3, zones: [] },
            higherLow: { pass: true, latestZoneLow: 820, previousZoneLow: 810, priceAboveEma: true, priceAboveZoneLow: true },
            volumePump: { pass: true, spikeDetails: { volumeRatio: 2.1, barDate: '2026-02-01' } },
            bearSqueeze: {
                pass: false,
                wickPercent: 38.5, // MArginal failure
                open: 840, high: 860, low: 830, close: 850
            },
            overall: { score: 3, recommendation: 'avoid' }
        }
    };

    console.log('Test 1: Marginal Failure (Layer 1 Review)');
    console.log('Expectation: AI might PASS this and move it to OBSERVATION');
    const result1 = await orchestrator.processStock(marginalStock as any);
    console.log(`Result: Final Status = ${result1.finalStatus}, AI Decision = ${result1.aiDecision}, Confidence = ${result1.confidence}%\n`);

    // TEST CASE 2: High Quality Pass (Layer 2 Validation)
    const perfectStock = {
        stockId: 1324, // Using same real ID for simplicity
        scanId: 13,
        symbol: 'RELIANCE',
        name: 'Reliance Industries Ltd.',
        qualified: true,
        analysisDetails: {
            consolidation: { pass: true, base: 2800, currentPrice: 2900, percentGain: 3.5, zoneCount: 5, zones: [] },
            higherLow: { pass: true, latestZoneLow: 2850, previousZoneLow: 2800, priceAboveEma: true, priceAboveZoneLow: true },
            volumePump: { pass: true, spikeDetails: { volumeRatio: 3.2, barDate: '2026-02-05' } },
            bearSqueeze: { pass: true, wickPercent: 65, open: 2880, high: 2910, low: 2860, close: 2900 },
            overall: { score: 4, recommendation: 'strong_buy' }
        }
    };

    console.log('Test 2: High Quality Pass (Layer 2 Validation)');
    console.log('Expectation: AI should PASS and finalize as SELECTED');
    const result2 = await orchestrator.processStock(perfectStock as any);
    console.log(`Result: Final Status = ${result2.finalStatus}, AI Decision = ${result2.aiDecision}, Confidence = ${result2.confidence}%\n`);

    // TEST CASE 3: Edge Case - Missing Data (Partial Object)
    const messyData = {
        stockId: 1324,
        scanId: 13,
        symbol: 'INFY',
        name: 'Infosys',
        qualified: false,
        analysisDetails: {
            // Missing most fields
            consolidation: { pass: false },
            overall: { score: 0 }
        }
    };

    console.log('Test 3: Edge Case - Missing/Messy Data');
    console.log('Expectation: AI should handle and likely REJECT or throw informative error');
    const result3 = await orchestrator.processStock(messyData as any);
    console.log(`Result: Final Status = ${result3.finalStatus}, Error = ${result3.error || 'None'}\n`);

    // Cleanup
    console.log('🧪 FINISHED VERIFICATION SUITE');
    await pool.end();
}

runTests();
