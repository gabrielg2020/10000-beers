import 'dotenv/config';
import { Client, LocalAuth } from 'whatsapp-web.js';
import { logger } from '../src/utils/logger';
import { prisma } from '../src/database';
import { imageService } from '../src/services/imageService';
import { aiService } from '../src/services/aiService';
import { beerService } from '../src/services/beerService';
import { config } from '../src/config';
import type {
  BeerImageData,
  BeerSubmissionRequest,
} from '../src/types/submission';

interface ScrapeStats {
  totalMessages: number;
  imagesFound: number;
  processedSuccessfully: number;
  duplicates: number;
  aiRejected: number;
  errors: number;
}

interface UserInfo {
  whatsappId: string;
  displayName: string;
  messageCount: number;
}

const SESSION_PATH = '.wwebjs_auth/session-10000-beers';

async function waitForChromeToClose(maxWaitMs = 8000) {
  const startTime = Date.now();
  let attemptCount = 0;
  const { execSync } = await import('node:child_process');

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const result = execSync(`pgrep -f "chrome.*${SESSION_PATH}"`, {
        encoding: 'utf8',
      });

      if (!result.trim()) {
        logger.info('Chrome process closed successfully');
        return true;
      }

      attemptCount++;
      if (attemptCount % 3 === 0) {
        logger.info(
          `Waiting for Chrome to close... (${Math.floor((Date.now() - startTime) / 1000)}s)`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch () {
      logger.info('Chrome process closed successfully');
      return true;
    }
  }

  logger.warn('Chrome did not close gracefully - sending SIGTERM');
  try {
    execSync(`pkill -TERM -f "chrome.*${SESSION_PATH}"`);
    await new Promise((resolve) => setTimeout(resolve, 3000));

    try {
      const result = execSync(`pgrep -f "chrome.*${SESSION_PATH}"`, {
        encoding: 'utf8',
      });
      if (!result.trim()) {
        logger.info('Chrome closed after SIGTERM');
        return true;
      }
    } catch {
      logger.info('Chrome closed after SIGTERM');
      return true;
    }

    logger.error(
      'Chrome still running - using SIGKILL (session may be corrupted)',
    );
    execSync(`pkill -9 -f "chrome.*${SESSION_PATH}"`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  } catch (error) {
    logger.debug('No Chrome processes to kill');
  }

  return true;
}

async function scrapeHistory(limit = 1000) {
  const stats: ScrapeStats = {
    totalMessages: 0,
    imagesFound: 0,
    processedSuccessfully: 0,
    duplicates: 0,
    aiRejected: 0,
    errors: 0,
  };

  // Track all users who sent messages
  const users = new Map<string, UserInfo>();

  logger.info('Checking for existing Chrome processes...');
  await waitForChromeToClose();

  logger.info('Initialising services...');

  // Initialise services
  await prisma.$connect();
  await imageService.initialise();
  await aiService.initialise();

  logger.info('Starting WhatsApp client...');

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: '10000-beers' }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  client.on('loading_screen', (percent, message) => {
    logger.info({ percent, message }, 'Loading session from storage');
  });

  client.on('authenticated', () => {
    logger.info('Authenticated successfully - session loaded');
  });

  client.on('auth_failure', (msg) => {
    logger.error({ msg }, 'Authentication failure');
    process.exit(1);
  });

  client.on('ready', async () => {
    logger.info('WhatsApp client ready, fetching chat...');

    try {
      const chat = await client.getChatById(config.whatsapp.groupId);
      logger.info(
        { chatName: chat.name },
        'Found group chat, fetching messages...',
      );

      // Fetch messages (this gets most recent first)
      const messages = await chat.fetchMessages({ limit });
      stats.totalMessages = messages.length;

      // Calculate ETA (approximately 1.3s per message)
      const estimatedSeconds = Math.ceil(messages.length * 1.3);
      const estimatedMinutes = Math.floor(estimatedSeconds / 60);
      const remainingSeconds = estimatedSeconds % 60;
      const etaString =
        estimatedMinutes > 0
          ? `${estimatedMinutes}m ${remainingSeconds}s`
          : `${remainingSeconds}s`;

      // Announce scraping has started
      await chat.sendMessage(
        `🔄 Starting historical beer scraping...\n📊 Scanning ${messages.length} messages\n⏱️ ETA: ~${etaString}`,
      );

      logger.info(
        { messageCount: messages.length },
        'Messages fetched, processing...',
      );

      logger.info(
        { messageCount: messages.length },
        'Messages fetched, processing...',
      );

      // Reverse to process chronologically (oldest first)
      const chronologicalMessages = messages.reverse();

      for (const message of chronologicalMessages) {
        // Track user for every message
        try {
          const contact = await message.getContact();
          const whatsappId = contact.id._serialized;
          const displayName = contact.pushname || contact.name || 'Unknown';

          // Update user tracking
          if (users.has(whatsappId)) {
            const userInfo = users.get(whatsappId)!;
            userInfo.messageCount++;
            // Update display name in case it changed
            userInfo.displayName = displayName;
          } else {
            users.set(whatsappId, {
              whatsappId,
              displayName,
              messageCount: 1,
            });
          }
        } catch (error) {
          logger.debug({ error }, 'Could not get contact info for message');
        }

        if (!message.hasMedia) {
          continue;
        }

        stats.imagesFound++;

        try {
          const contact = await message.getContact();
          const whatsappId = contact.id._serialized;
          const displayName = contact.pushname || contact.name || 'Unknown';

          logger.info(
            {
              messageId: message.id._serialized,
              from: displayName,
              timestamp: new Date(message.timestamp * 1000),
            },
            `Processing message ${stats.imagesFound}/${stats.totalMessages}`,
          );

          const media = await message.downloadMedia();

          if (!media) {
            logger.warn(
              { messageId: message.id._serialized },
              'Failed to download media',
            );
            stats.errors++;
            continue;
          }

          // Only process JPEG images (matching current bot behaviour)
          if (media.mimetype !== 'image/jpeg') {
            logger.debug(
              { mimetype: media.mimetype },
              'Skipping non-JPEG image',
            );
            continue;
          }

          const imageData: BeerImageData = {
            data: media.data,
            mimetype: media.mimetype,
            filename: media.filename ?? undefined,
          };

          const submissionRequest: BeerSubmissionRequest = {
            whatsappId,
            displayName,
            media: imageData,
            submittedAt: new Date(message.timestamp * 1000),
            messageId: message.id._serialized,
          };

          const result = await beerService.submitBeer(submissionRequest);

          if (result.success) {
            logger.info(
              {
                beerId: result.beerId,
                displayName,
                beerNumber: result.beerNumber,
              },
              'Beer submitted successfully',
            );
            stats.processedSuccessfully++;
          }
        } catch (error: unknown) {
          if (error instanceof Error) {
            const errorMessage = error.message.toLowerCase();

            if (errorMessage.includes('duplicate')) {
              logger.debug(
                { messageId: message.id._serialized },
                'Duplicate beer, skipping',
              );
              stats.duplicates++;
            } else if (errorMessage.includes('ai')) {
              logger.debug(
                { messageId: message.id._serialized },
                'AI rejected submission',
              );
              stats.aiRejected++;
            } else {
              logger.error(
                { error: error.message, messageId: message.id._serialized },
                'Error processing message',
              );
              stats.errors++;
            }
          } else {
            logger.error(
              { error, messageId: message.id._serialized },
              'Unknown error processing message',
            );
            stats.errors++;
          }
        }
      }

      logger.info(stats, 'Scraping complete');

      // Print summary to console
      console.log('\n=== Scraping Summary ===');
      console.log(`Total messages scanned: ${stats.totalMessages}`);
      console.log(`Images found: ${stats.imagesFound}`);
      console.log(`✅ Successfully processed: ${stats.processedSuccessfully}`);
      console.log(`🔁 Duplicates skipped: ${stats.duplicates}`);
      console.log(`🚫 AI rejected: ${stats.aiRejected}`);
      console.log(`❌ Errors: ${stats.errors}`);

      // Log all users who sent messages
      console.log('\n=== Users Found ===');
      console.log(`Total unique users: ${users.size}`);
      const sortedUsers = Array.from(users.values()).sort(
        (a, b) => b.messageCount - a.messageCount,
      );
      for (const user of sortedUsers) {
        console.log(`  ${user.displayName} (${user.messageCount} messages)`);
        console.log(`    WhatsApp ID: ${user.whatsappId}`);
      }

      logger.info(
        { userCount: users.size, users: sortedUsers },
        'User summary',
      );

      // Send summary message to group
      const summaryMessage = `✅ Historical scraping complete!

🍺 Beers found: ${stats.processedSuccessfully}
📊 Total messages scanned: ${stats.totalMessages}
🖼️ Images processed: ${stats.imagesFound}
🔁 Duplicates skipped: ${stats.duplicates}
🚫 AI rejected: ${stats.aiRejected}`;

      await chat.sendMessage(summaryMessage);

      // Wait for message to be fully sent before destroying client
      logger.info('Waiting for message to send...');
      await new Promise((resolve) => setTimeout(resolve, 3000));

      await prisma.$disconnect();
      await client.destroy();
      process.exit(0);
    } catch (error) {
      logger.error({ error }, 'Fatal error during scraping');
      await prisma.$disconnect();
      await client.destroy();
      process.exit(1);
    }
  });

  client.on('qr', (qr) => {
    logger.error('No valid session found - QR code required');
    logger.error(
      'Please run the main bot (npm run dev) first to create a session, then try scraping again',
    );
    // Could optionally display QR here if needed:
    // import qrcode from 'qrcode-terminal';
    // qrcode.generate(qr, { small: true });
    process.exit(1);
  });

  logger.info('Initialising WhatsApp client');

  const initTimeout = setTimeout(() => {
    logger.error('WhatsApp client initialisation timed out after 60 seconds');
    process.exit(1);
  }, 60000);

  client
    .initialize()
    .then(() => {
      clearTimeout(initTimeout);
    })
    .catch((error) => {
      clearTimeout(initTimeout);
      logger.error({ error }, 'Failed to initialise WhatsApp client');
      process.exit(1);
    });
}

// Parse command line arguments
const args = process.argv.slice(2);
const limitArg = args.find((arg) => arg.startsWith('--limit='));
const limit = limitArg ? Number.parseInt(limitArg.split('=')[1], 10) : 1000;

logger.info({ limit }, 'Starting historical message scraper');
scrapeHistory(limit).catch((error) => {
  logger.error({ error }, 'Scraper failed');
  process.exit(1);
});
