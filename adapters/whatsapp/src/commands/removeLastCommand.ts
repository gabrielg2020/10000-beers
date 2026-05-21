import { beerService } from '../services/beerService';
import { CommandError } from '../types/statistics';
import { logger } from '../utils/logger';
import { Command, CommandContext, CommandResult } from './types';

export class RemoveLastCommand implements Command {
	readonly name = 'removeLast';
	readonly aliases = ['rl', 'removelast'];
	readonly description = 'Remove the last beer submission from a user (admin only)';
	readonly adminOnly = true;

	async execute(context: CommandContext): Promise<CommandResult> {
		try {
			const mentionedIds = context.message.mentionedIds;

			logger.debug({ mentionedIds }, 'Mentioned IDs from message');

			if (!mentionedIds || mentionedIds.length === 0) {
				return {
					success: false,
					reply: 'Please mention a user to remove their last beer (e.g., !removeLast @user)',
				};
			}

			if (mentionedIds.length > 1) {
				return {
					success: false,
					reply: 'Please mention only one user at a time',
				};
			}

			const mentions = await context.message.getMentions();

			if (mentions.length === 0) {
				return {
					success: false,
					reply: 'Could not resolve mentioned user',
				};
			}

			const targetWhatsappId = mentions[0].id._serialized;

			logger.debug(
				{
					mentionedId: mentionedIds[0],
					resolvedWhatsappId: targetWhatsappId,
				},
				'Resolved mention to actual WhatsApp ID',
			);

			logger.info(
				{
					adminId: context.whatsappId,
					targetWhatsappId,
				},
				'Attempting to remove last beer',
			);

			const result = await beerService.removeLastBeer(targetWhatsappId);

			return {
				success: true,
				reply: `Removed beer #${result.beerNumber} for ${result.displayName} ✅`,
			};
		} catch (error) {
			logger.error({ error, context }, 'Remove last beer command failed');

			throw new CommandError(
				'Failed to remove beer',
				'REMOVE_BEER_FAILED',
				'Failed to remove beer. Please try again',
			);
		}
	}
}
