import { prisma } from "../database";
import { BeerSubmissionError, BeerSubmissionRequest, BeerSubmissionResult, DuplicateCheckResult } from "../types/submission";
import { logger } from "../utils/logger";
import { imageService } from "./imageService";
import { userService } from "./userService";
import { MessageMedia } from "whatsapp-web.js";

export class BeerService {
  private readonly replyOnSubmission: boolean;

  constructor() {
    this.replyOnSubmission = process.env.REPLY_ON_SUBMISSION?.toLowerCase() !== 'false';
  }

  async checkDuplicate(
    userId: string,
    imageHash: string,
  ): Promise<DuplicateCheckResult> {
    const existingBeer = await prisma.beer.findFirst({
      where: {
        userId,
        imageHash
      },
      select: {
        id: true,
        submittedAt: true
      },
    });

    if (existingBeer) {
      return {
        isDuplicate: true,
        existingBeerId: existingBeer.id,
        submittedAt: existingBeer.submittedAt,
      };
    }

    return { isDuplicate: false };
  }

  async submitBeer(
    request: BeerSubmissionRequest,
  ): Promise<BeerSubmissionResult> {
    const { whatsappId, displayName, media, submittedAt, messageId } = request;

    try {
      // Step 1: Find or create user
      const userInfo = await userService.findOrCreateUser(
        whatsappId,
        displayName,
      );
      logger.debug(
        { userId: userInfo.id, isNewUser: userInfo.isNewUser },
        'User resolved'
      );

      // Step 2: Convert our type back to MessageMedia for imageService
      const messageMedia = new MessageMedia(
        media.mimetype,
        media.data,
        media.filename
      );

      // Step 3: Process image (download, validate, store)
      const imageResult = await imageService.processImage(messageMedia, userInfo.id);
      logger.debug(
        { imagePath: imageResult.imagePath, hash: imageResult.imageHash },
        'Image prcessed'
      )

      // Step 4: Check for duplicate submissions
      const duplicateCheck = await this.checkDuplicate(
        userInfo.id,
        imageResult.imageHash,
      );
      if (duplicateCheck.isDuplicate) {
        await imageService.deleteImage(imageResult.imagePath);

        throw new BeerSubmissionError(
          `Duplicate beer submission detected for user ${userInfo.id}`,
          'DUPLICATE_SUBMISSION',
          "You've already submitted this beer",
        );
      }

      // Step 5: Create beer record in database
      const beer = await prisma.beer.create({
        data: {
          userId: userInfo.id,
          submittedAt,
          imagePath: imageResult.imagePath,
          imageHash: imageResult.imageHash,
        },
      });

      // Step 6. Get total beer count for response
      const totalCount = await userService.getTotalBeerCount();

      logger.info(
        {
          beerId: beer.id,
          userId: userInfo.id,
          totalCount,
          messageId
        },
        'Beer submitted successfully',
      );

      // Step 7: Build sucess message
      const message = this.replyOnSubmission
        ? `Beer #${totalCount} logged for @${displayName}! 🍺`
        : '';

      return {
        success: true,
        beerId: beer.id,
        beerNumber: totalCount,
        message,
      };
    } catch (error) {
      // If we've already made an error, rethrow
      if (error instanceof BeerSubmissionError) {
        throw error
      }

      logger.error({ error, whatsappId, messageId }, 'Beer submission failed');

      throw new BeerSubmissionError(
        'Failed to submit beer',
        'SUBMISSION_FAILED',
        'Failed to save your beer, please try again',
      );
    }
  }
}

export const beerService = new BeerService();
