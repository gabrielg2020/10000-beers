process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

import { statisticsService } from '../../../src/services/statisticsService';
import { prisma } from '../../../src/database/client';

jest.mock('../../../src/database/client', () => ({
	prisma: {
		beer: {
			count: jest.fn(),
			groupBy: jest.fn(),
		},
		user: {
			findMany: jest.fn(),
			findUnique: jest.fn(),
		},
	},
}));

jest.mock('../../../src/utils/logger', () => ({
	logger: {
		info: jest.fn(),
		debug: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
	},
}));

describe('StatisticsService', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('getLeaderboard', () => {
		it('should return leaderboard with ranked users', async () => {
			const mockUsers = [
				{
					id: 'user-1',
					displayName: 'Alice',
					_count: { beers: 50 },
				},
				{
					id: 'user-2',
					displayName: 'Bob',
					_count: { beers: 30 },
				},
				{
					id: 'user-3',
					displayName: 'Charlie',
					_count: { beers: 20 },
				},
			];

			(prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
			(prisma.beer.count as jest.Mock).mockResolvedValue(100);

			const result = await statisticsService.getLeaderboard();

			expect(result.totalBeers).toBe(100);
			expect(result.totalUsers).toBe(3);
			expect(result.entries).toHaveLength(3);
			expect(result.entries[0]).toEqual({
				rank: 1,
				displayName: 'Alice',
				totalBeers: 50,
			});
			expect(result.entries[1]).toEqual({
				rank: 2,
				displayName: 'Bob',
				totalBeers: 30,
			});
			expect(result.entries[2]).toEqual({
				rank: 3,
				displayName: 'Charlie',
				totalBeers: 20,
			});
		});

		it('should return empty leaderboard when no users', async () => {
			(prisma.user.findMany as jest.Mock).mockResolvedValue([]);
			(prisma.beer.count as jest.Mock).mockResolvedValue(0);

			const result = await statisticsService.getLeaderboard();

			expect(result.totalBeers).toBe(0);
			expect(result.totalUsers).toBe(0);
			expect(result.entries).toHaveLength(0);
		});

		it('should only include active users', async () => {
			const mockUsers = [
				{
					id: 'user-1',
					displayName: 'Active User',
					_count: { beers: 10 },
				},
			];

			(prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
			(prisma.beer.count as jest.Mock).mockResolvedValue(10);

			await statisticsService.getLeaderboard();

			expect(prisma.user.findMany).toHaveBeenCalledWith({
				where: { isActive: true },
				select: {
					id: true,
					displayName: true,
					_count: { select: { beers: true } },
				},
				orderBy: { beers: { _count: 'desc' } },
			});
		});
	});

	describe('getDayStats', () => {
		beforeEach(() => {
			jest.useFakeTimers();
		});

		afterEach(() => {
			jest.useRealTimers();
		});

		it('should return stats for today and last 24 hours', async () => {
			const mockDate = new Date('2026-03-27T15:30:00Z');
			jest.setSystemTime(mockDate);

			(prisma.beer.count as jest.Mock)
				.mockResolvedValueOnce(10)
				.mockResolvedValueOnce(15);

			(prisma.beer.groupBy as jest.Mock)
				.mockResolvedValueOnce([
					{ userId: 'user-1', _count: { id: 5 } },
				])
				.mockResolvedValueOnce([
					{ userId: 'user-2', _count: { id: 8 } },
				]);

			(prisma.user.findUnique as jest.Mock)
				.mockResolvedValueOnce({ displayName: 'Alice' })
				.mockResolvedValueOnce({ displayName: 'Bob' });

			const result = await statisticsService.getDayStats();

			expect(result.calendar.totalBeers).toBe(10);
			expect(result.calendar.topDrinker).toEqual({
				displayName: 'Alice',
				beerCount: 5,
			});
			expect(result.rolling.totalBeers).toBe(15);
			expect(result.rolling.topDrinker).toEqual({
				displayName: 'Bob',
				beerCount: 8,
			});

			const calls = (prisma.beer.count as jest.Mock).mock.calls;
			expect(calls).toHaveLength(2);

			const todayMidnight = new Date('2026-03-27T00:00:00Z');
			expect(calls[0][0].where.submittedAt.gte).toEqual(todayMidnight);
			expect(calls[0][0].where.submittedAt.lte).toEqual(mockDate);

			const last24Hours = new Date(mockDate.getTime() - 24 * 60 * 60 * 1000);
			expect(calls[1][0].where.submittedAt.gte).toEqual(last24Hours);
		});

		it('should handle no beers', async () => {
			jest.setSystemTime(new Date('2026-03-27T12:00:00Z'));

			(prisma.beer.count as jest.Mock).mockResolvedValue(0);
			(prisma.beer.groupBy as jest.Mock).mockResolvedValue([]);

			const result = await statisticsService.getDayStats();

			expect(result.calendar.totalBeers).toBe(0);
			expect(result.calendar.topDrinker).toBeNull();
			expect(result.rolling.totalBeers).toBe(0);
			expect(result.rolling.topDrinker).toBeNull();
		});
	});

	describe('getWeekStats', () => {
		beforeEach(() => {
			jest.useFakeTimers();
		});

		afterEach(() => {
			jest.useRealTimers();
		});

		it('should return stats for this week (Monday start) and last 7 days', async () => {
			const wednesday = new Date('2026-03-25T15:00:00Z');
			jest.setSystemTime(wednesday);

			(prisma.beer.count as jest.Mock)
				.mockResolvedValueOnce(30)
				.mockResolvedValueOnce(45);

			(prisma.beer.groupBy as jest.Mock)
				.mockResolvedValueOnce([
					{ userId: 'user-1', _count: { id: 12 } },
				])
				.mockResolvedValueOnce([
					{ userId: 'user-2', _count: { id: 18 } },
				]);

			(prisma.user.findUnique as jest.Mock)
				.mockResolvedValueOnce({ displayName: 'Charlie' })
				.mockResolvedValueOnce({ displayName: 'Dave' });

			const result = await statisticsService.getWeekStats();

			expect(result.calendar.totalBeers).toBe(30);
			expect(result.calendar.topDrinker).toEqual({
				displayName: 'Charlie',
				beerCount: 12,
			});
			expect(result.rolling.totalBeers).toBe(45);
			expect(result.rolling.topDrinker).toEqual({
				displayName: 'Dave',
				beerCount: 18,
			});

			const calls = (prisma.beer.count as jest.Mock).mock.calls;
			const weekStart = new Date('2026-03-23T00:00:00Z');
			expect(calls[0][0].where.submittedAt.gte).toEqual(weekStart);
		});

		it('should handle Sunday correctly (week starts Monday)', async () => {
			const sunday = new Date('2026-03-29T15:00:00Z');
			jest.setSystemTime(sunday);

			(prisma.beer.count as jest.Mock).mockResolvedValue(20);
			(prisma.beer.groupBy as jest.Mock).mockResolvedValue([]);

			await statisticsService.getWeekStats();

			const calls = (prisma.beer.count as jest.Mock).mock.calls;
			const expectedMonday = new Date('2026-03-23T00:00:00Z');
			expect(calls[0][0].where.submittedAt.gte).toEqual(expectedMonday);
		});

		it('should handle Monday correctly', async () => {
			const monday = new Date('2026-03-23T15:00:00Z');
			jest.setSystemTime(monday);

			(prisma.beer.count as jest.Mock).mockResolvedValue(5);
			(prisma.beer.groupBy as jest.Mock).mockResolvedValue([]);

			await statisticsService.getWeekStats();

			const calls = (prisma.beer.count as jest.Mock).mock.calls;
			const expectedMonday = new Date('2026-03-23T00:00:00Z');
			expect(calls[0][0].where.submittedAt.gte).toEqual(expectedMonday);
		});
	});

	describe('getMonthStats', () => {
		beforeEach(() => {
			jest.useFakeTimers();
		});

		afterEach(() => {
			jest.useRealTimers();
		});

		it('should return stats for this month and last 30 days', async () => {
			const mockDate = new Date('2026-03-15T12:00:00Z');
			jest.setSystemTime(mockDate);

			(prisma.beer.count as jest.Mock)
				.mockResolvedValueOnce(100)
				.mockResolvedValueOnce(120);

			(prisma.beer.groupBy as jest.Mock)
				.mockResolvedValueOnce([
					{ userId: 'user-1', _count: { id: 40 } },
				])
				.mockResolvedValueOnce([
					{ userId: 'user-2', _count: { id: 50 } },
				]);

			(prisma.user.findUnique as jest.Mock)
				.mockResolvedValueOnce({ displayName: 'Eve' })
				.mockResolvedValueOnce({ displayName: 'Frank' });

			const result = await statisticsService.getMonthStats();

			expect(result.calendar.totalBeers).toBe(100);
			expect(result.calendar.topDrinker).toEqual({
				displayName: 'Eve',
				beerCount: 40,
			});
			expect(result.rolling.totalBeers).toBe(120);
			expect(result.rolling.topDrinker).toEqual({
				displayName: 'Frank',
				beerCount: 50,
			});

			const calls = (prisma.beer.count as jest.Mock).mock.calls;
			const monthStart = new Date('2026-03-01T00:00:00Z');
			expect(calls[0][0].where.submittedAt.gte).toEqual(monthStart);
		});

		it('should handle first day of month', async () => {
			const firstDay = new Date('2026-03-01T00:00:00Z');
			jest.setSystemTime(firstDay);

			(prisma.beer.count as jest.Mock).mockResolvedValue(0);
			(prisma.beer.groupBy as jest.Mock).mockResolvedValue([]);

			await statisticsService.getMonthStats();

			const calls = (prisma.beer.count as jest.Mock).mock.calls;
			expect(calls[0][0].where.submittedAt.gte).toEqual(firstDay);
		});
	});

	describe('getWeekendStats', () => {
		beforeEach(() => {
			jest.useFakeTimers();
		});

		afterEach(() => {
			jest.useRealTimers();
		});

		it('should return only last weekend on Monday', async () => {
			const monday = new Date('2026-03-23T15:00:00Z');
			jest.setSystemTime(monday);

			(prisma.beer.count as jest.Mock).mockResolvedValue(40);
			(prisma.beer.groupBy as jest.Mock).mockResolvedValue([
				{ userId: 'user-1', _count: { id: 15 } },
			]);
			(prisma.user.findUnique as jest.Mock).mockResolvedValue({
				displayName: 'Grace',
			});

			const result = await statisticsService.getWeekendStats();

			expect(result.thisWeekend).toBeUndefined();
			expect(result.lastWeekend.totalBeers).toBe(40);
			expect(result.lastWeekend.topDrinker).toEqual({
				displayName: 'Grace',
				beerCount: 15,
			});

			const calls = (prisma.beer.count as jest.Mock).mock.calls;
			const lastFriday = new Date('2026-03-20T00:00:00Z');
			const lastSundayEnd = new Date('2026-03-23T23:59:59.999Z');
			expect(calls[0][0].where.submittedAt.gte).toEqual(lastFriday);
			expect(calls[0][0].where.submittedAt.lte).toEqual(lastSundayEnd);
		});

		it('should return only last weekend on Thursday', async () => {
			const thursday = new Date('2026-03-26T15:00:00Z');
			jest.setSystemTime(thursday);

			(prisma.beer.count as jest.Mock).mockResolvedValue(35);
			(prisma.beer.groupBy as jest.Mock).mockResolvedValue([]);

			const result = await statisticsService.getWeekendStats();

			expect(result.thisWeekend).toBeUndefined();
			expect(result.lastWeekend.totalBeers).toBe(35);
			expect(result.lastWeekend.topDrinker).toBeNull();
		});

		it('should return both weekends on Friday', async () => {
			const friday = new Date('2026-03-27T15:00:00Z');
			jest.setSystemTime(friday);

			(prisma.beer.count as jest.Mock)
				.mockResolvedValueOnce(25)
				.mockResolvedValueOnce(40);

			(prisma.beer.groupBy as jest.Mock)
				.mockResolvedValueOnce([
					{ userId: 'user-1', _count: { id: 10 } },
				])
				.mockResolvedValueOnce([
					{ userId: 'user-2', _count: { id: 15 } },
				]);

			(prisma.user.findUnique as jest.Mock)
				.mockResolvedValueOnce({ displayName: 'Hannah' })
				.mockResolvedValueOnce({ displayName: 'Ivan' });

			const result = await statisticsService.getWeekendStats();

			expect(result.thisWeekend).toBeDefined();
			expect(result.thisWeekend?.totalBeers).toBe(25);
			expect(result.thisWeekend?.topDrinker).toEqual({
				displayName: 'Hannah',
				beerCount: 10,
			});
			expect(result.lastWeekend.totalBeers).toBe(40);
			expect(result.lastWeekend.topDrinker).toEqual({
				displayName: 'Ivan',
				beerCount: 15,
			});

			const calls = (prisma.beer.count as jest.Mock).mock.calls;
			const thisFriday = new Date('2026-03-27T00:00:00Z');
			expect(calls[0][0].where.submittedAt.gte).toEqual(thisFriday);
		});

		it('should return both weekends on Saturday', async () => {
			const saturday = new Date('2026-03-28T15:00:00Z');
			jest.setSystemTime(saturday);

			(prisma.beer.count as jest.Mock)
				.mockResolvedValueOnce(30)
				.mockResolvedValueOnce(45);

			(prisma.beer.groupBy as jest.Mock).mockResolvedValue([]);

			const result = await statisticsService.getWeekendStats();

			expect(result.thisWeekend).toBeDefined();
			expect(result.thisWeekend?.totalBeers).toBe(30);
			expect(result.lastWeekend.totalBeers).toBe(45);
		});

		it('should return both weekends on Sunday', async () => {
			const sunday = new Date('2026-03-29T15:00:00Z');
			jest.setSystemTime(sunday);

			(prisma.beer.count as jest.Mock)
				.mockResolvedValueOnce(35)
				.mockResolvedValueOnce(50);

			(prisma.beer.groupBy as jest.Mock).mockResolvedValue([]);

			const result = await statisticsService.getWeekendStats();

			expect(result.thisWeekend).toBeDefined();
			expect(result.thisWeekend?.totalBeers).toBe(35);
			expect(result.lastWeekend.totalBeers).toBe(50);
		});

		it('should handle no beers over weekend', async () => {
			const friday = new Date('2026-03-27T15:00:00Z');
			jest.setSystemTime(friday);

			(prisma.beer.count as jest.Mock).mockResolvedValue(0);
			(prisma.beer.groupBy as jest.Mock).mockResolvedValue([]);

			const result = await statisticsService.getWeekendStats();

			expect(result.thisWeekend?.totalBeers).toBe(0);
			expect(result.thisWeekend?.topDrinker).toBeNull();
			expect(result.lastWeekend.totalBeers).toBe(0);
			expect(result.lastWeekend.topDrinker).toBeNull();
		});
	});

	describe('error handling', () => {
		it('should propagate errors from getLeaderboard', async () => {
			const error = new Error('Database error');
			(prisma.user.findMany as jest.Mock).mockRejectedValue(error);

			await expect(statisticsService.getLeaderboard()).rejects.toThrow(
				'Database error',
			);
		});

		it('should propagate errors from getDayStats', async () => {
			const error = new Error('Database error');
			(prisma.beer.count as jest.Mock).mockRejectedValue(error);

			await expect(statisticsService.getDayStats()).rejects.toThrow(
				'Database error',
			);
		});

		it('should propagate errors from getWeekStats', async () => {
			const error = new Error('Database error');
			(prisma.beer.count as jest.Mock).mockRejectedValue(error);

			await expect(statisticsService.getWeekStats()).rejects.toThrow(
				'Database error',
			);
		});

		it('should propagate errors from getMonthStats', async () => {
			const error = new Error('Database error');
			(prisma.beer.count as jest.Mock).mockRejectedValue(error);

			await expect(statisticsService.getMonthStats()).rejects.toThrow(
				'Database error',
			);
		});

		it('should propagate errors from getWeekendStats', async () => {
			const error = new Error('Database error');
			(prisma.beer.count as jest.Mock).mockRejectedValue(error);

			await expect(statisticsService.getWeekendStats()).rejects.toThrow(
				'Database error',
			);
		});
	});
});
