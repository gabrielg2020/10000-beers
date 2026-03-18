import { statisticsService } from '../services/statisticsService';
import { CommandError, LeaderboardResult } from '../types/statistics';
import { logger } from '../utils/logger';
import { Command, CommandContext, CommandResult } from './types';

export class LeaderbaordCommand implements Command {
	readonly name = 'leaderboard';
	readonly aliases = ['lb', 'top'];
	readonly description = 'Show beer leaderboard for all users';

	async execute(context: CommandContext): Promise<CommandResult> {
		try {
			logger.debug(
				{ whatsappId: context.whatsappId },
				'Executing leaderboard command',
			);

			const leaderboard = await statisticsService.getLeaderboard();

			if (leaderboard.entries.length === 0) {
				return {
					success: true,
					reply: 'No beers have been logged yet! 🍺',
				};
			}

			const reply = this.formatLeaderboard(leaderboard);

			return {
				success: true,
				reply,
			};
		} catch (error) {
			logger.error({ error, context }, 'Leaderboard command failed');

			throw new CommandError( 
				'failed to generate leaderboard',
				'LEADERBOARD_FAILED',
				'Failed to laod leaderboard, Please try again', 
			);
		}
	}

	private formatLeaderboard(leaderboard: LeaderboardResult): string { 
		const lines: string[] = ['🏆 *Beer Leaderboard* 🍺', ''];

		for (const entry of leaderboard.entries) {
			const medal = this.getMedal(entry.rank);
			lines.push(
				`${medal} ${entry.rank}. ${entry.displayName} - ${entry.totalBeers} beers`,
			);
		}

		lines.push('');
		lines.push(`Total: ${leaderboard.totalBeers} beers`);

		return lines.join('\n');
	}

	private getMedal(rank: number): string {
		switch (rank) {
			case 1:
				return '🥇';
			case 2:
				return '🥈';
			case 3:
				return '🥉';
			default:
				return '  ';
		}
	}
}
