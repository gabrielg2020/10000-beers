import { ReadStream } from "node:fs";
import { prisma } from "../database";
import { UserInfo } from "../types/submission";
import { logger } from "../utils/logger";

export class UserService {
  async findOrCreateUser(
    whatsappId: string,
    displayName: string,
  ): Promise<UserInfo> {
    try {
      // Step 1. Try to find existing User
      let user = await prisma.user.findUnique({
        where: {whatsappId},
      });

      if (user) {
        // Step 2.1. Update users display name if changed
        if (user.displayName !== displayName) {
          user = await prisma.user.update({
            where: {whatsappId},
            data: {displayName},
          });
          logger.info(
            { whatsappId, oldName: user.displayName, newName: displayName},
            'Updated user display name',
          );
        }

        return {
          id: user.id,
          whatsappId: user.whatsappId,
          displayName: user.displayName,
          isNewUser: false,
        };
      }

      // Step 2.2 Create user
      user = await prisma.user.create({
        data: {
          whatsappId,
          displayName,
          isActive: true,
        },
      });

      logger.info(
        {userId: user.id, whatsappId, displayName},
        'Created new user'
      );

      return {
        id: user.id,
        whatsappId: user.whatsappId,
        displayName: user.displayName,
        isNewUser: true
      };
    } catch (error) {
      logger.error({ error, whatsappId }, 'Failed to find or create user');
      throw error;
    }
  }

  async getUserBeerCount(userId: string): Promise<number> {
    return await prisma.beer.count({
      where: { userId },
    });
  }

  async getTotalBeerCount(): Promise<number> {
    return await prisma.beer.count();
  }
}

export const userService = new UserService();
