import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { logger } from './utils/logger';

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
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
  logger.debug({ from: message.from, body: message.body }, 'Received message');

  // Example: Reply to "!ping" command
  if (message.body === '!ping') {
    await message.reply('pong');
  }
});

client.on('disconnected', (reason) => {
  logger.warn({ reason }, 'Client was disconnected');
});

logger.info('Initialising WhatsApp client...');
client.initialize();
