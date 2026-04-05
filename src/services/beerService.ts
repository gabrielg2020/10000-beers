import { config } from "../config";
import { prisma } from "../database";
import { BeerSubmissionError, BeerSubmissionRequest, BeerSubmissionResult, DuplicateCheckResult } from "../types/submission";
import { logger, redactWhatsAppId } from "../utils/logger";
import { aiService } from "./aiService";
import { imageService } from "./imageService";
import { userService } from "./userService";
import { MessageMedia } from "whatsapp-web.js";

export class BeerService {
  private readonly replyOnSubmission: boolean;

  constructor() {
    this.replyOnSubmission = config.bot.replyOnSubmission
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
        'Image processed'
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

      // Step 5: AI validation
      const aiResult = await aiService.classifyBeer(imageResult.imagePath);
      if (!aiResult.isValid) {
        await imageService.deleteImage(imageResult.imagePath);

        throw new BeerSubmissionError(
          `AI rejected beer submission: ${aiResult.error}`,
          'AI_VALIDATION_FAILED',
          "Doesn't look like a beer to me mate 🤔",
        );
      }

      // Step 6: Create beer record in database
      const beer = await prisma.beer.create({
        data: {
          userId: userInfo.id,
          submittedAt,
          imagePath: imageResult.imagePath,
          imageHash: imageResult.imageHash,
          beerType: aiResult.beerType,
          classificationConfidence: aiResult.confidence
        },
      });

      // Step 7. Get total beer count for response
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

      // Step 8: Build sucess message
      const message = `Beer #${totalCount} logged by @${displayName}! 🍺`;

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

      logger.error({ error, whatsappId: redactWhatsAppId(whatsappId), messageId }, 'Beer submission failed');

      throw new BeerSubmissionError(
        'Failed to submit beer',
        'SUBMISSION_FAILED',
        'Failed to save your beer, please try again',
      );
    }
  }

  async removeLastBeer(
    whatsappId: string,
    timeWindowMinutes?: number
  ): Promise<{ success: boolean; displayName: string; beerId: string; beerNumber: number }> {
    logger.debug({ whatsappId, timeWindowMinutes }, 'Looking up user for beer removal');

    const whereConditions: { submittedAt?: { gte: Date } } = {};

    if (timeWindowMinutes !== undefined) {
      const cutoffTime = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
      whereConditions.submittedAt = { gte: cutoffTime };
    }

    const user = await prisma.user.findUnique({
      where: { whatsappId },
      include: {
        beers: {
          where: whereConditions,
          orderBy: { submittedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) {
      logger.warn({ whatsappId: redactWhatsAppId(whatsappId) }, 'User not found for beer removal');

      throw new BeerSubmissionError(
        'User not found',
        'USER_NOT_FOUND',
        timeWindowMinutes !== undefined
          ? 'You have not submitted any beers yet'
          : 'User not found',
      );
    }

    if (user.beers.length === 0) {
      const errorMessage = timeWindowMinutes !== undefined
        ? `You have no beers submitted in the last ${timeWindowMinutes} minutes to undo`
        : 'This user has no beers to remove';

      throw new BeerSubmissionError(
        'No beers to remove',
        'NO_BEERS',
        errorMessage,
      );
    }

    const lastBeer = user.beers[0];
    const totalCountBefore = await userService.getTotalBeerCount();

    await imageService.deleteImage(lastBeer.imagePath);

    await prisma.beer.delete({
      where: { id: lastBeer.id },
    });

    logger.info(
      { beerId: lastBeer.id, userId: user.id, whatsappId, timeWindowMinutes, submittedAt: lastBeer.submittedAt },
      'Beer removed successfully',
    );

    return {
      success: true,
      displayName: user.displayName,
      beerId: lastBeer.id,
      beerNumber: totalCountBefore,
    };
  }
}

export const beerService = new BeerService();
