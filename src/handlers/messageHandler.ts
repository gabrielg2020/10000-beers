import { Message } from "whatsapp-web.js";
import { logger, redactWhatsAppId } from "../utils/logger";
import { BeerImageData, BeerSubmissionError, BeerSubmissionRequest } from "../types/submission";
import { beerService } from "../services/beerService";
import { config } from "../config";
import { commandHandler } from "./commandHandler";

export class MessageHandler {
  private readonly groupId: string;

  constructor() {
    this.groupId = config.whatsapp.groupId;
    logger.info({ groupId: this.groupId }, 'Message handler initialised for group');
  }

  isFromConfiguredGroup(message: Message): boolean {
    return message.from === this.groupId;
  }

  async handleMessage(message: Message): Promise<void> {
    logger.debug(
      { from: message.from, fromMe: message.fromMe, chatType: message.from.includes('@g.us') ? 'group' : 'private' },
      'Received message',
    );

    // Step 0: Ignore own messages in production (allow in dev for testing)
    if (message.fromMe && !config.application.isDevelopment) {
      logger.debug('Ignoring own message (production mode)');
      return;
    }

    // Step 1: Make sure we only process messages from groupchat
    if (!this.isFromConfiguredGroup(message)) {
      logger.debug(
        { from: message.from, expected: this.groupId },
        'Ignoring message from different group',
      );
      return;
    }

    // Step 2: Check if this is a command
    if (message.body && commandHandler.isCommand(message.body)) {
      await commandHandler.handleCommand(message);
      return;
    }

    // Step 3: Make sure we only process messages with images
    if (!message.hasMedia) {
      return;
    }

    try {
      // Step 4: Get contact information
      const contact = await message.getContact();
      const whatsappId = contact.id._serialized;
      const displayName = contact.pushname || contact.name || 'Unknown';

      // Step 5: Download media
      const media = await message.downloadMedia();

      if (!media) {
        logger.warn(
          { messageId: message.id._serialized, from: whatsappId },
          'Failed to download media',
        );
        await message.reply('Failed to download image, please try again');
        return;
      }

      // Step 5a: Silently ignore non-JPEG images
      if (media.mimetype !== 'image/jpeg') {
        logger.debug(
          { mimetype: media.mimetype, from: whatsappId },
          'Ignoring non-JPEG image',
        );
        return;
      }

      // Step 6: Convert MessageMedia to our custom type
      const imageData: BeerImageData = {
        data: media.data,
        mimetype: media.mimetype,
        filename: media.filename ?? undefined,
      };

      // Step 7: Build submission request
      const submissionRequest: BeerSubmissionRequest = {
        whatsappId,
        displayName,
        media: imageData,
        submittedAt: new Date(message.timestamp * 1000),
        messageId: message.id._serialized,
      };

      // Step 8: Submit and reply
      const result = await beerService.submitBeer(submissionRequest);

      if (result.message) {
        logger.debug(
          { whatsappId: redactWhatsAppId(whatsappId), messageLength: result.message.length },
          'Sending beer submission reply',
        );
        await message.reply(result.message);
        logger.info({ whatsappId: redactWhatsAppId(whatsappId) }, 'Beer submission reply sent successfully');
      }
    } catch (error) {
      if (error instanceof BeerSubmissionError) {
        if (error.userMessage) {
          logger.debug('Sending error reply');
          await message.reply(error.userMessage);
          logger.info('Error reply sent successfully');
        }
        logger.warn(
          { code: error.code, message: error.message },
          'Beer submission rejected',
        );
      } else {
        logger.error({ error }, 'Unexpected error handling message');
        logger.debug('Sending generic error reply');
        await message.reply(
          'Something went wrong processing your beer. Please try again',
        );
        logger.info('Generic error reply sent successfully');
      }
    }
  }
}

export const messageHandler = new MessageHandler();
