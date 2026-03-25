import 'dotenv/config'; // KEEP FIRST
import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { logger } from './utils/logger';
import { imageService } from './services/imageService';
import { prisma } from './database';
import { messageHandler } from './handlers/messageHandler';
import { aiService } from './services/aiService';
import { config } from './config';
import './commands' // KEEP LAST

let client: Client | null = null;
let isShuttingDown = false;
const SESSION_PATH = '.wwebjs_auth/session-10000-beers';

async function waitForChromeToClose(maxWaitMs = 8000) {
	const startTime = Date.now();
	let attemptCount = 0;
	const { execSync } = await import('node:child_process');

	while (Date.now() - startTime < maxWaitMs) {
		try {
			const result = execSync(`pgrep -f "chrome.*${SESSION_PATH}"`, { encoding: 'utf8' });

			if (!result.trim()) {
				logger.info('Chrome process closed successfully');
				return true;
			}

			attemptCount++;
			if (attemptCount % 3 === 0) {
				logger.info(`Waiting for Chrome to close... (${Math.floor((Date.now() - startTime) / 1000)}s)`);
			}
			await new Promise((resolve) => setTimeout(resolve, 1000));
		} catch (error) {
			// pgrep returns exit code 1 when no processes found
			logger.info('Chrome process closed successfully');
			return true;
		}
	}

	// Try graceful kill first (SIGTERM)
	logger.warn('Chrome did not close gracefully - sending SIGTERM');
	try {
		execSync(`pkill -TERM -f "chrome.*${SESSION_PATH}"`);
		await new Promise((resolve) => setTimeout(resolve, 3000));

		// Check if it closed
		try {
			const result = execSync(`pgrep -f "chrome.*${SESSION_PATH}"`, { encoding: 'utf8' });
			if (!result.trim()) {
				logger.info('Chrome closed after SIGTERM');
				return true;
			}
		} catch {
			logger.info('Chrome closed after SIGTERM');
			return true;
		}

		// Still running, force kill as last resort
		logger.error('Chrome still running - using SIGKILL (session may be corrupted)');
		execSync(`pkill -9 -f "chrome.*${SESSION_PATH}"`);
		await new Promise((resolve) => setTimeout(resolve, 2000));
	} catch (error) {
		logger.debug('No Chrome processes to kill');
	}

	return true;
}

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
	// Clean up any stale Chrome lock files
	try {
		const fs = await import('node:fs/promises');
		const lockFiles = ['SingletonLock', 'SingletonSocket', 'SingletonCookie'];
		for (const lockFile of lockFiles) {
			const lockPath = `${SESSION_PATH}/${lockFile}`;
			try {
				await fs.unlink(lockPath);
				logger.debug({ lockPath }, 'Removed stale lock file');
			} catch (err: unknown) {
				if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
					logger.warn({ err, lockPath }, 'Failed to remove lock file');
				}
			}
		}
	} catch (error) {
		logger.warn({ error }, 'Error cleaning up lock files');
	}

	// Wait for any previous Chrome instance to fully close
	logger.debug('Checking for existing Chrome processes...');
	await waitForChromeToClose();

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

	const puppeteerConfig: any = {
		headless: true,
		args: [
			'--no-sandbox',
			'--disable-setuid-sandbox',
			'--disable-dev-shm-usage',
			'--disable-accelerated-2d-canvas',
			'--no-first-run',
			'--no-zygote',
			'--disable-gpu',
		],
	};

	// Only set executablePath if explicitly provided (for Docker)
	if (config.application.puppeteerExecutablePath) {
		puppeteerConfig.executablePath = config.application.puppeteerExecutablePath;
	}

	client = new Client({
		authStrategy: new LocalAuth({ clientId: '10000-beers' }),
		puppeteer: puppeteerConfig,
	});

	client.on('loading_screen', (percent, message) => {
		logger.info({ percent, message }, 'Loading session from storage');
	});

	client.on('qr', (qr) => {
		logger.warn('No valid session found - QR code required');
		logger.info('Scan the QR code below with WhatsApp:');
		qrcode.generate(qr, { small: true });
	});

	client.on('ready', () => {
		logger.info('WhatsApp client is ready!');
	});

	client.on('authenticated', () => {
		logger.info('Authenticated successfully - session saved');
	});

	client.on('auth_failure', (msg) => {
		logger.error({ msg }, 'Authentication failure');
	});

	client.on('message_create', async (message) => {
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
