/**
 * LLM Gateway - Application Entry Point
 * 
 * Application bootstrap and initialization
 * Responsibilities:
 * - Environment setup and validation
 * - Configuration loading
 * - Graceful shutdown handling
 * - Process signal handling
 */

const dotenv = require('dotenv');

// Load environment variables FIRST
dotenv.config();

const { manager: config } = require('./config');
const logger = require('./utils/logger');
const app = require('./app');
const server = require('./server');
const gatewayService = require('./services/gateway.service');

/**
 * Initialize the application
 */
async function initialize() {
  try {
    // Validate environment and configuration
    await config.validate();
    
    logger.info('Starting LLM Gateway', {
      version: process.env.npm_package_version,
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
    });

    // Initialize gateway service and providers
    await gatewayService.initialize();

    // Start the server
    await server.start(app);
    
    logger.info('LLM Gateway started successfully');
  } catch (error) {
    logger.error('Failed to start LLM Gateway', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
async function shutdown(signal) {
  logger.info(`Received ${signal}, starting graceful shutdown`);
  
  try {
    await server.stop();
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error: error.message });
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGHUP', () => shutdown('SIGHUP'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
  process.exit(1);
});

// Start the application
if (require.main === module) {
  initialize();
}

module.exports = { initialize, shutdown };