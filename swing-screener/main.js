"use strict";
// main.ts - Application entry point
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const app_1 = require("./src/app");
const logger_enhanced_1 = require("./src/utils/logger-enhanced");
const logger = new logger_enhanced_1.Logger('Main');
async function main() {
    try {
        logger.info('🚀 Starting Stock Analysis Pro...');
        logger.info('📊 Version: 2.0.0');
        logger.info('🔧 Environment: Production');
        const app = new app_1.App();
        await app.initialize();
        await app.start();
        logger.info('✅ Application started successfully');
    }
    catch (error) {
        logger.error('❌ Failed to start application:', error);
        process.exit(1);
    }
}
// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});
process.on('unhandledRejection', (reason, _promise) => {
    logger.error('Unhandled Rejection:', reason);
    process.exit(1);
});
// Start the application
main();
//# sourceMappingURL=main.js.map