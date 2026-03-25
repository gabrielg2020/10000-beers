import { beerService } from '../services/beerService';
import { CommandError } from '../types/statistics';
import { logger } from '../utils/logger';
import { Command, CommandContext, CommandResult } from './types';

export class UndoCommand implements Command {
	readonly name = 'undo';
	readonly aliases: string[] = [];
	readonly description = 'Undo your last beer submission (within 10 minutes)';
	readonly adminOnly = false;

	async execute(context: CommandContext): Promise<CommandResult> {
		try {
			logger.info(
				{ whatsappId: context.whatsappId },
				'Attempting to undo last beer',
			);

			const result = await beerService.removeLastBeer(context.whatsappId, 10);

			return {
				success: true,
				reply: `Beer #${result.beerNumber} undone! 🔄`,
			};
		} catch (error) {
			logger.error({ error, context }, 'Undo command failed');

			if (error instanceof CommandError) {
				throw error;
			}

			throw new CommandError(
				'Failed to undo beer',
				'UNDO_FAILED',
				error instanceof Error ? error.message : 'Failed to undo beer. Please try again',
			);
		}
	}
}
