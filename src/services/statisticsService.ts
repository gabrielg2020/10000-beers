import { prisma } from '../database';
import type { LeaderboardEntry, LeaderboardResult } from '../types/statistics';
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
}

export const statisticsService = new StatisticsService();
