import 'dotenv/config'; // KEEP FIRST
import type { Client } from 'whatsapp-web.js';
import { logger } from './utils/logger';
import { imageService } from './services/imageService';
import { prisma } from './database';
import { aiService } from './services/aiService';
import { config } from './config';
import { cleanupChromeSession } from './utils/chromeCleanup';
import { createWhatsAppClient } from './whatsapp/client';
import './commands'; // KEEP LAST

let client: Client | null = null;
let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
	// Prevent multiple shutdown attempts
	if (isShuttingDown) {
		logger.debug({ signal }, 'Shutdown already in progress, ignoring signal');
		return;
	}
	isShuttingDown = true;

	logger.info({ signal }, 'Shutdown signal received');

	try {
		if (client) {
			logger.info('Destroying WhatsApp client');
			await client.destroy();
			// Give Chrome time to actually close
			logger.debug('Waiting for browser to fully close...');
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}

		logger.info('Disconnecting from database');
		await prisma.$disconnect();

		logger.info('Graceful shutdown complete');
		process.exit(0);
	} catch (error) {
		logger.error({ error }, 'Error during shutdown');
		process.exit(1);
	}
}

async function initialise() {
	await cleanupChromeSession();

	try {
		await prisma.$connect();
		logger.info('Database connected');
	} catch (error) {
		logger.error({ error }, 'Failed to connect to database');
		process.exit(1);
	}

	try {
		await imageService.initialise();
		logger.info('Image service ready');
	} catch (error) {
		logger.error({ error }, 'Failed to initialise image service');
		process.exit(1);
	}

	try {
		await aiService.initialise();
		logger.info('AI service ready');
	} catch (error) {
		logger.error({ error }, 'Failed to initialise AI service');
		process.exit(1);
	}

	client = createWhatsAppClient();

	if (config.application.startupWaitSeconds > 0) {
		logger.info(
			{ seconds: config.application.startupWaitSeconds },
			'Waiting before initialising WhatsApp client',
		);
		await new Promise((resolve) =>
			setTimeout(resolve, config.application.startupWaitSeconds * 1000),
		);
	}

	logger.info('Initialising WhatsApp client');
	await client.initialize()
}

process.on('SIGINT', () => {
	gracefulShutdown('SIGINT').catch((err) => {
		logger.error({ err }, 'Error during SIGINT shutdown');
		process.exit(1);
	});
});

process.on('SIGTERM', () => {
	gracefulShutdown('SIGTERM').catch((err) => {
		logger.error({ err }, 'Error during SIGTERM shutdown');
		process.exit(1);
	});
});

process.on('unhandledRejection', (reason, promise) => {
	logger.error({ reason, promise }, 'Unhandled promise rejection');
	gracefulShutdown('UNHANDLED_REJECTION').catch(() => process.exit(1));
});

process.on('uncaughtException', (error) => {
	logger.error({ error }, 'Uncaught exception');
	gracefulShutdown('UNCAUGHT_EXCEPTION').catch(() => process.exit(1));
});

initialise().catch((error) => {
	logger.error({ error }, 'Failed to initialise application');
	process.exit(1);
});
