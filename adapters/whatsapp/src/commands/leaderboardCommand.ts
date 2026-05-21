import { statisticsService } from '../services/statisticsService';
import type { LeaderboardResult } from '../types/statistics';
import { CommandError } from '../types/statistics';
import {
	getCalendarRange,
	getWeekendRanges,
	isValidPeriod,
} from '../utils/dateRanges';
import type { TimePeriod } from '../utils/dateRanges';
import { logger } from '../utils/logger';
import type { Command, CommandContext, CommandResult } from './types';

export class LeaderboardCommand implements Command {
	readonly name = 'leaderboard';
	readonly aliases = ['lb', 'top'];
	readonly description = 'Show beer leaderboard for all users';
	readonly adminOnly = true;

	async execute(context: CommandContext): Promise<CommandResult> {
		try {
			const period = context.args[0]?.toLowerCase();

			if (period && !isValidPeriod(period)) {
				return {
					success: true,
					reply:
						'Invalid period. Use: !lb, !lb day, !lb week, !lb month, or !lb weekend',
				};
			}

			logger.debug(
				{ whatsappId: context.whatsappId, period: period ?? 'all-time' },
				'Executing leaderboard command',
			);

			if (!period) {
				const leaderboard = await statisticsService.getLeaderboard();
				return this.buildResult(leaderboard, '🏆 *Beer Leaderboard* 🍺');
			}

			return await this.executeForPeriod(period as TimePeriod);
		} catch (error) {
			logger.error({ error, context }, 'Leaderboard command failed');

			throw new CommandError(
				'failed to generate leaderboard',
				'LEADERBOARD_FAILED',
				'Failed to load leaderboard. Please try again.',
			);
		}
	}

	private async executeForPeriod(
		period: TimePeriod,
	): Promise<CommandResult> {
		if (period === 'weekend') {
			return this.executeWeekendLeaderboard();
		}

		const range = getCalendarRange(period);
		const leaderboard = await statisticsService.getLeaderboardForPeriod(
			range.start,
			range.end,
		);
		const titles: Record<string, string> = {
			day: '🏆 *Beer Leaderboard — Today* 🍺',
			week: '🏆 *Beer Leaderboard — This Week* 🍺',
			month: '🏆 *Beer Leaderboard — This Month* 🍺',
		};

		return this.buildResult(leaderboard, titles[period]);
	}

	private async executeWeekendLeaderboard(): Promise<CommandResult> {
		const ranges = getWeekendRanges();

		if (ranges.thisWeekend) {
			const leaderboard = await statisticsService.getLeaderboardForPeriod(
				ranges.thisWeekend.start,
				ranges.thisWeekend.end,
			);
			return this.buildResult(
				leaderboard,
				'🏆 *Beer Leaderboard — This Weekend* 🍺',
			);
		}

		const leaderboard = await statisticsService.getLeaderboardForPeriod(
			ranges.lastWeekend.start,
			ranges.lastWeekend.end,
		);
		return this.buildResult(
			leaderboard,
			'🏆 *Beer Leaderboard — Last Weekend* 🍺',
		);
	}

	private buildResult(
		leaderboard: LeaderboardResult,
		title: string,
	): CommandResult {
		if (leaderboard.entries.length === 0) {
			return {
				success: true,
				reply: 'No beers have been logged yet! 🍺',
			};
		}

		const reply = this.formatLeaderboard(leaderboard, title);

		return {
			success: true,
			reply,
		};
	}

	private formatLeaderboard(
		leaderboard: LeaderboardResult,
		title: string,
	): string {
		const lines: string[] = [title, ''];

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
