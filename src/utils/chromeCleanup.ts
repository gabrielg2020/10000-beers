import { execSync } from 'node:child_process';
import { unlink } from 'node:fs/promises';
import { logger } from './logger';

const SESSION_PATH = '.wwebjs_auth/session-10000-beers';
const MAX_WAIT_MS = 8000;
const LOCK_FILES = ['SingletonLock', 'SingletonSocket', 'SingletonCookie'];

async function waitForProcessToClose(maxWaitMs = MAX_WAIT_MS): Promise<boolean> {
	const startTime = Date.now();
	let attemptCount = 0;

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
		} catch {
			logger.info('Chrome process closed successfully');
			return true;
		}
	}

	return false;
}

async function killChromeProcess(): Promise<void> {
	logger.warn('Chrome did not close gracefully - sending SIGTERM');

	try {
		execSync(`pkill -TERM -f "chrome.*${SESSION_PATH}"`);
		await new Promise((resolve) => setTimeout(resolve, 3000));

		try {
			const result = execSync(`pgrep -f "chrome.*${SESSION_PATH}"`, { encoding: 'utf8' });
			if (!result.trim()) {
				logger.info('Chrome closed after SIGTERM');
				return;
			}
		} catch {
			logger.info('Chrome closed after SIGTERM');
			return;
		}

		logger.error('Chrome still running - using SIGKILL (session may be corrupted)');
		execSync(`pkill -9 -f "chrome.*${SESSION_PATH}"`);
		await new Promise((resolve) => setTimeout(resolve, 2000));
	} catch (error) {
		logger.debug('No Chrome processes to kill');
	}
}

async function removeStaleLockFiles(): Promise<void> {
	for (const lockFile of LOCK_FILES) {
		const lockPath = `${SESSION_PATH}/${lockFile}`;
		try {
			await unlink(lockPath);
			logger.debug({ lockPath }, 'Removed stale lock file');
		} catch (err: unknown) {
			if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
				logger.warn({ err, lockPath }, 'Failed to remove lock file');
			}
		}
	}
}

export async function cleanupChromeSession(): Promise<void> {
	try {
		await removeStaleLockFiles();
	} catch (error) {
		logger.warn({ error }, 'Error cleaning up lock files');
	}

	logger.debug('Checking for existing Chrome processes...');
	const closedGracefully = await waitForProcessToClose();

	if (!closedGracefully) {
		await killChromeProcess();
	}
}
