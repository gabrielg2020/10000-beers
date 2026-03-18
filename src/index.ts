import 'dotenv/config';
import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { logger } from './utils/logger';
import { imageService } from './services/imageService';
import { prisma } from './database';
import { messageHandler } from './handlers/messageHandler';
import fs from 'node:fs';
import path from 'node:path';
import { aiService } from './services/aiService';

let client: Client | null = null;
const SESSION_PATH = '.wwebjs_auth/session';
const LOCK_FILE = path.join(SESSION_PATH, 'SingletonLock');

async function gracefulShutdown(signal: string) {
	logger.info({ signal }, 'Shutdown signal received');

	try {
		if (client) {
			logger.info('Destroying WhatsApp client');
			await client.destroy();

			if (client.pupBrowser) {
				await client.pupBrowser.close();
			}
		}

		if (fs.existsSync(LOCK_FILE)) {
			logger.debug('Removing Puppeteer lock file');
			fs.unlinkSync(LOCK_FILE);
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
  } catch(error) {
    logger.error({ error }, 'Failed to initialise AI service');
    process.exit(1);
  }

	client = new Client({
		authStrategy: new LocalAuth(),
		puppeteer: {
			headless: true,
			args: ['--no-sandbox', '--disable-setuid-sandbox'],
		},
	});

	client.on('qr', (qr) => {
		logger.info('Scan the QR code below with WhatsApp:');
		qrcode.generate(qr, { small: true });
	});

	client.on('ready', () => {
		logger.info('WhatsApp client is ready!');
	});

	client.on('authenticated', () => {
		logger.info('Authenticated successfully');
	});

	client.on('auth_failure', (msg) => {
		logger.error({ msg }, 'Authentication failure');
	});

	client.on('message', async (message) => {
		try {
			await messageHandler.handleMessage(message);
		} catch (error) {
			logger.error({ error }, 'Error in message handler');
		}
	});

	client.on('disconnected', (reason) => {
		logger.warn({ reason }, 'Client was disconnected');
	});

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

	logger.info('Initialising WhatsApp client');

	const initTimeout = setTimeout(() => {
		logger.error('WhatsApp client initialization timed out after 60 seconds');
		gracefulShutdown('INIT_TIMEOUT').catch(() => process.exit(1));
	}, 60000);

	client.initialize()
		.then(() => {
			clearTimeout(initTimeout);
		})
		.catch((error) => {
			clearTimeout(initTimeout);
			logger.error({ error }, 'Failed to initialise WhatsApp client');
			gracefulShutdown('INIT_FAILURE').catch(() => process.exit(1));
		});
}

initialise().catch((error) => {
	logger.error({ error }, 'Failed to initialise application');
	process.exit(1);
});
