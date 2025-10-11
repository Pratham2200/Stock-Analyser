// main.ts - Application entry point

import 'dotenv/config';
import { App } from './src/app';
import { Logger } from './src/utils/logger-enhanced';

const logger = new Logger('Main');

async function main(): Promise<void> {
  try {
    logger.info('🚀 Starting Stock Analysis Pro...');
    logger.info('📊 Version: 2.0.0');
    logger.info('🔧 Environment: Production');
    
    const app = new App();
    await app.initialize();
    await app.start();
    
    logger.info('✅ Application started successfully');
    
  } catch (error) {
    logger.error('❌ Failed to start application:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason: any, _promise: Promise<any>) => {
  logger.error('Unhandled Rejection:', reason);
  process.exit(1);
});

// Start the application
main();
