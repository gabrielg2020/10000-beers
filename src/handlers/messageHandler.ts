import { Message } from "whatsapp-web.js";
import { logger } from "../utils/logger";
import { BeerImageData, BeerSubmissionError, BeerSubmissionRequest } from "../types/submission";
import { beerService } from "../services/beerService";
import { config } from "../config";

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
    // Step 1: Make sure we only process messages from groupchat
    if (!this.isFromConfiguredGroup(message)) {
      logger.debug(
        { from: message.from, expected: this.groupId },
        'Ignoring message from different group',
      );
      return;
    }

    // Step 2: Make sure we only process messages with images
    if (!message.hasMedia) {
      return;
    }

    try {
      // Step 3: Get contact information
      const contact = await message.getContact();
      const whatsappId = contact.id._serialized;
      const displayName = contact.pushname || contact.name || 'Unknown';

      // Step 4: Download media
      const media = await message.downloadMedia();

      if (!media) {
        logger.warn(
          { messageId: message.id._serialized, from: whatsappId },
          'Failed to download media',
        );
        await message.reply('Failed to download image, please try again');
        return;
      }

      // Step 5: Convert MessageMedia to our custom type
      const imageData: BeerImageData = {
        data: media.data,
        mimetype: media.mimetype,
        filename: media.filename ?? undefined,
      };

      // Step 6: Build submission request
      const submissionRequest: BeerSubmissionRequest = {
        whatsappId,
        displayName,
        media: imageData,
        submittedAt: new Date(message.timestamp * 1000),
        messageId: message.id._serialized,
      };

      // Step 7: Submit and reply
      const result = await beerService.submitBeer(submissionRequest);

      if (result.message) {
        await message.reply(result.message);
      }
    } catch (error) {
      if (error instanceof BeerSubmissionError) {
        await message.reply(error.userMessage);
        logger.warn(
          { code: error.code, message: error.message },
          'Beer submission rejected',
        );
      } else {
        logger.error({ error }, 'Unexpected error handling message');
        await message.reply(
          'Something went wrong processing your beer. Please try again',
        );
      }
    }
  }
}

export const messageHandler = new MessageHandler();
