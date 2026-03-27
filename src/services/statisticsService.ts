import { prisma } from '../database';
import type {
	DualPeriodStats,
	LeaderboardEntry,
	LeaderboardResult,
	PeriodStats,
	WeekendStats,
} from '../types/statistics';
import { logger } from '../utils/logger';

export class StatisticsService {
	async getLeaderboard(): Promise<LeaderboardResult> {
		try {
			// Get all active users with beer counts
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

			// Build Leaderboard
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
			logger.error({ error }, 'Failed to generate leadboard');
			throw error;
		}
	}

	async getDayStats(): Promise<DualPeriodStats> {
		const now = new Date();
		const todayMidnight = new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate(),
		);
		const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

		const [calendarStats, rollingStats] = await Promise.all([
			this.getPeriodStats(todayMidnight, now),
			this.getPeriodStats(last24Hours, now),
		]);

		return {
			calendar: calendarStats,
			rolling: rollingStats,
		};
	}

	async getWeekStats(): Promise<DualPeriodStats> {
		const now = new Date();
		const dayOfWeek = now.getDay();
		const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

		const weekStart = new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate() - daysFromMonday,
		);
		const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

		const [calendarStats, rollingStats] = await Promise.all([
			this.getPeriodStats(weekStart, now),
			this.getPeriodStats(last7Days, now),
		]);

		return {
			calendar: calendarStats,
			rolling: rollingStats,
		};
	}

	async getMonthStats(): Promise<DualPeriodStats> {
		const now = new Date();
		const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
		const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

		const [calendarStats, rollingStats] = await Promise.all([
			this.getPeriodStats(monthStart, now),
			this.getPeriodStats(last30Days, now),
		]);

		return {
			calendar: calendarStats,
			rolling: rollingStats,
		};
	}

	async getWeekendStats(): Promise<WeekendStats> {
		const now = new Date();
		const dayOfWeek = now.getDay();

		if (dayOfWeek >= 5 || dayOfWeek === 0) {
			// It's Friday, Saturday, or Sunday - show both this weekend and last weekend
			const daysFromThisFriday = dayOfWeek === 0 ? 2 : dayOfWeek - 5;
			const thisFridayMidnight = new Date(
				now.getFullYear(),
				now.getMonth(),
				now.getDate() - daysFromThisFriday,
			);

			const daysFromLastFriday = daysFromThisFriday + 7;
			const lastFridayMidnight = new Date(
				now.getFullYear(),
				now.getMonth(),
				now.getDate() - daysFromLastFriday,
			);
			const lastSundayEnd = new Date(
				now.getFullYear(),
				now.getMonth(),
				now.getDate() - daysFromThisFriday - 1,
				23,
				59,
				59,
				999,
			);

			const [thisWeekend, lastWeekend] = await Promise.all([
				this.getPeriodStats(thisFridayMidnight, now),
				this.getPeriodStats(lastFridayMidnight, lastSundayEnd),
			]);

			return { thisWeekend, lastWeekend };
		}

		// It's Monday-Thursday - show only last weekend
		const daysFromLastFriday = dayOfWeek + 2;
		const lastFridayMidnight = new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate() - daysFromLastFriday,
		);
		const lastSundayEnd = new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate() - (dayOfWeek - 1),
			23,
			59,
			59,
			999,
		);

		const lastWeekend = await this.getPeriodStats(
			lastFridayMidnight,
			lastSundayEnd,
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
