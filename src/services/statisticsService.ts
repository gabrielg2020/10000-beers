import { prisma } from '../database';
import type {
	DualPeriodStats,
	LeaderboardEntry,
	LeaderboardResult,
	PeriodStats,
	WeekendStats,
} from '../types/statistics';
import {
	getCalendarRange,
	getRollingRange,
	getWeekendRanges,
} from '../utils/dateRanges';
import { logger } from '../utils/logger';

export class StatisticsService {
	async getLeaderboard(): Promise<LeaderboardResult> {
		try {
			const usersWithCounts = await prisma.user.findMany({
				where: {
					isActive: true,
				},
				select: {
					id: true,
					displayName: true,
					_count: {
						select: {
							beers: true,
						},
					},
				},
				orderBy: {
					beers: {
						_count: 'desc',
					},
				},
			});

			const totalBeers = await prisma.beer.count();

			const entries: LeaderboardEntry[] = usersWithCounts.map(
				(user, index) => ({
					rank: index + 1,
					displayName: user.displayName,
					totalBeers: user._count.beers,
				}),
			);

			logger.debug(
				{ totalUsers: entries.length, totalBeers },
				'Leaderboard generated',
			);

			return {
				entries,
				totalUsers: entries.length,
				totalBeers,
			};
		} catch (error) {
			logger.error({ error }, 'Failed to generate leaderboard');
			throw error;
		}
	}

	async getLeaderboardForPeriod(
		start: Date,
		end: Date,
	): Promise<LeaderboardResult> {
		try {
			const userBeerCounts = await prisma.beer.groupBy({
				by: ['userId'],
				where: {
					submittedAt: {
						gte: start,
						lte: end,
					},
				},
				_count: {
					id: true,
				},
				orderBy: {
					_count: {
						id: 'desc',
					},
				},
			});

			const userIds = userBeerCounts.map((u) => u.userId);
			const users = await prisma.user.findMany({
				where: { id: { in: userIds } },
				select: { id: true, displayName: true },
			});
			const userMap = new Map(users.map((u) => [u.id, u.displayName]));

			const totalBeers = userBeerCounts.reduce(
				(sum, u) => sum + u._count.id,
				0,
			);

			const entries: LeaderboardEntry[] = userBeerCounts.map(
				(u, index) => ({
					rank: index + 1,
					displayName: userMap.get(u.userId) ?? 'Unknown',
					totalBeers: u._count.id,
				}),
			);

			logger.debug(
				{ totalUsers: entries.length, totalBeers, start, end },
				'Period leaderboard generated',
			);

			return {
				entries,
				totalUsers: entries.length,
				totalBeers,
			};
		} catch (error) {
			logger.error({ error, start, end }, 'Failed to generate period leaderboard');
			throw error;
		}
	}

	async getDayStats(): Promise<DualPeriodStats> {
		const now = new Date();
		const calendar = getCalendarRange('day', now);
		const rolling = getRollingRange('day', now);

		const [calendarStats, rollingStats] = await Promise.all([
			this.getPeriodStats(calendar.start, calendar.end),
			this.getPeriodStats(rolling.start, rolling.end),
		]);

		return {
			calendar: calendarStats,
			rolling: rollingStats,
		};
	}

	async getWeekStats(): Promise<DualPeriodStats> {
		const now = new Date();
		const calendar = getCalendarRange('week', now);
		const rolling = getRollingRange('week', now);

		const [calendarStats, rollingStats] = await Promise.all([
			this.getPeriodStats(calendar.start, calendar.end),
			this.getPeriodStats(rolling.start, rolling.end),
		]);

		return {
			calendar: calendarStats,
			rolling: rollingStats,
		};
	}

	async getMonthStats(): Promise<DualPeriodStats> {
		const now = new Date();
		const calendar = getCalendarRange('month', now);
		const rolling = getRollingRange('month', now);

		const [calendarStats, rollingStats] = await Promise.all([
			this.getPeriodStats(calendar.start, calendar.end),
			this.getPeriodStats(rolling.start, rolling.end),
		]);

		return {
			calendar: calendarStats,
			rolling: rollingStats,
		};
	}

	async getWeekendStats(): Promise<WeekendStats> {
		const ranges = getWeekendRanges();

		if (ranges.thisWeekend) {
			const [thisWeekend, lastWeekend] = await Promise.all([
				this.getPeriodStats(ranges.thisWeekend.start, ranges.thisWeekend.end),
				this.getPeriodStats(ranges.lastWeekend.start, ranges.lastWeekend.end),
			]);

			return { thisWeekend, lastWeekend };
		}

		const lastWeekend = await this.getPeriodStats(
			ranges.lastWeekend.start,
			ranges.lastWeekend.end,
		);
		return { lastWeekend };
	}

	private async getPeriodStats(
		startDate: Date,
		endDate: Date,
	): Promise<PeriodStats> {
		try {
			const totalBeers = await prisma.beer.count({
				where: {
					submittedAt: {
						gte: startDate,
						lte: endDate,
					},
				},
			});

			const userBeerCounts = await prisma.beer.groupBy({
				by: ['userId'],
				where: {
					submittedAt: {
						gte: startDate,
						lte: endDate,
					},
				},
				_count: {
					id: true,
				},
				orderBy: {
					_count: {
						id: 'desc',
					},
				},
				take: 1,
			});

			let topDrinker = null;
			if (userBeerCounts.length > 0) {
				const topUser = await prisma.user.findUnique({
					where: {
						id: userBeerCounts[0].userId,
					},
					select: {
						displayName: true,
					},
				});

				if (topUser) {
					topDrinker = {
						displayName: topUser.displayName,
						beerCount: userBeerCounts[0]._count.id,
					};
				}
			}

			return {
				totalBeers,
				topDrinker,
			};
		} catch (error) {
			logger.error({ error, startDate, endDate }, 'Failed to get period stats');
			throw error;
		}
	}
}

export const statisticsService = new StatisticsService();
