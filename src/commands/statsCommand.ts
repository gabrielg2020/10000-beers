import { statisticsService } from '../services/statisticsService';
import type { DualPeriodStats, WeekendStats } from '../types/statistics';
import { CommandError } from '../types/statistics';
import { logger } from '../utils/logger';
import type { Command, CommandContext, CommandResult } from './types';

export class StatsCommand implements Command {
	readonly name = 'stats';
	readonly aliases: string[] = [];
	readonly description =
		'Show group drinking statistics for a time period (day, week, month, weekend)';
	readonly adminOnly = false;

	async execute(context: CommandContext): Promise<CommandResult> {
		try {
			const period = context.args[0]?.toLowerCase();

			if (!period || !['day', 'week', 'month', 'weekend'].includes(period)) {
				return {
					success: true,
					reply:
						'Please specify a time period: !stats day, !stats week, !stats month, or !stats weekend',
				};
			}

			logger.debug(
				{ whatsappId: context.whatsappId, period },
				'Executing stats command',
			);

			let reply: string;

			switch (period) {
				case 'day':
					reply = await this.formatDayStats();
					break;
				case 'week':
					reply = await this.formatWeekStats();
					break;
				case 'month':
					reply = await this.formatMonthStats();
					break;
				case 'weekend':
					reply = await this.formatWeekendStats();
					break;
				default:
					return {
						success: true,
						reply:
							'Please specify a time period: !stats day, !stats week, !stats month, or !stats weekend',
					};
			}

			return {
				success: true,
				reply,
			};
		} catch (error) {
			logger.error({ error, context }, 'Stats command failed');

			throw new CommandError(
				'failed to generate stats',
				'STATS_FAILED',
				'Failed to load stats. Please try again.',
			);
		}
	}

	private async formatDayStats(): Promise<string> {
		const stats = await statisticsService.getDayStats();
		const lines: string[] = ['📊 *Day Stats* 🍺', ''];

		lines.push(
			`*Today:* ${stats.calendar.totalBeers} ${this.pluraliseBeer(stats.calendar.totalBeers)}`,
		);
		if (stats.calendar.topDrinker) {
			lines.push(
				`Top drinker: ${stats.calendar.topDrinker.displayName} (${stats.calendar.topDrinker.beerCount})`,
			);
		}

		lines.push('');
		lines.push(
			`*Last 24 hours:* ${stats.rolling.totalBeers} ${this.pluraliseBeer(stats.rolling.totalBeers)}`,
		);
		if (stats.rolling.topDrinker) {
			lines.push(
				`Top drinker: ${stats.rolling.topDrinker.displayName} (${stats.rolling.topDrinker.beerCount})`,
			);
		}

		return lines.join('\n');
	}

	private async formatWeekStats(): Promise<string> {
		const stats = await statisticsService.getWeekStats();
		const lines: string[] = ['📊 *Week Stats* 🍺', ''];

		lines.push(
			`*This week:* ${stats.calendar.totalBeers} ${this.pluraliseBeer(stats.calendar.totalBeers)}`,
		);
		if (stats.calendar.topDrinker) {
			lines.push(
				`Top drinker: ${stats.calendar.topDrinker.displayName} (${stats.calendar.topDrinker.beerCount})`,
			);
		}

		lines.push('');
		lines.push(
			`*Last 7 days:* ${stats.rolling.totalBeers} ${this.pluraliseBeer(stats.rolling.totalBeers)}`,
		);
		if (stats.rolling.topDrinker) {
			lines.push(
				`Top drinker: ${stats.rolling.topDrinker.displayName} (${stats.rolling.topDrinker.beerCount})`,
			);
		}

		return lines.join('\n');
	}

	private async formatMonthStats(): Promise<string> {
		const stats = await statisticsService.getMonthStats();
		const lines: string[] = ['📊 *Month Stats* 🍺', ''];

		lines.push(
			`*This month:* ${stats.calendar.totalBeers} ${this.pluraliseBeer(stats.calendar.totalBeers)}`,
		);
		if (stats.calendar.topDrinker) {
			lines.push(
				`Top drinker: ${stats.calendar.topDrinker.displayName} (${stats.calendar.topDrinker.beerCount})`,
			);
		}

		lines.push('');
		lines.push(
			`*Last 30 days:* ${stats.rolling.totalBeers} ${this.pluraliseBeer(stats.rolling.totalBeers)}`,
		);
		if (stats.rolling.topDrinker) {
			lines.push(
				`Top drinker: ${stats.rolling.topDrinker.displayName} (${stats.rolling.topDrinker.beerCount})`,
			);
		}

		return lines.join('\n');
	}

	private async formatWeekendStats(): Promise<string> {
		const stats = await statisticsService.getWeekendStats();
		const lines: string[] = ['📊 *Weekend Stats* 🍺', ''];

		if (stats.thisWeekend) {
			lines.push(
				`*This weekend:* ${stats.thisWeekend.totalBeers} ${this.pluraliseBeer(stats.thisWeekend.totalBeers)}`,
			);
			if (stats.thisWeekend.topDrinker) {
				lines.push(
					`Top drinker: ${stats.thisWeekend.topDrinker.displayName} (${stats.thisWeekend.topDrinker.beerCount})`,
				);
			}
			lines.push('');
		}

		lines.push(
			`*Last weekend:* ${stats.lastWeekend.totalBeers} ${this.pluraliseBeer(stats.lastWeekend.totalBeers)}`,
		);
		if (stats.lastWeekend.topDrinker) {
			lines.push(
				`Top drinker: ${stats.lastWeekend.topDrinker.displayName} (${stats.lastWeekend.topDrinker.beerCount})`,
			);
		}

		return lines.join('\n');
	}

	private pluraliseBeer(count: number): string {
		return count === 1 ? 'beer' : 'beers';
	}
}
