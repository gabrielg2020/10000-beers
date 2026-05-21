import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { logger } from '../utils/logger';
import { messageHandler } from '../handlers/messageHandler';
import { getPuppeteerConfig } from '../config/puppeteer';

export function createWhatsAppClient(): Client {
	const client = new Client({
		authStrategy: new LocalAuth({ clientId: '10000-beers' }),
		puppeteer: getPuppeteerConfig(),
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

	return client;
}
