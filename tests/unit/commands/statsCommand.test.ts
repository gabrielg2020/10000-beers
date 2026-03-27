import { StatsCommand } from '../../../src/commands/statsCommand';
import { statisticsService } from '../../../src/services/statisticsService';
import { CommandError } from '../../../src/types/statistics';
import type { CommandContext } from '../../../src/commands/types';
import type {
	DualPeriodStats,
	WeekendStats,
} from '../../../src/types/statistics';

jest.mock('../../../src/services/statisticsService');
jest.mock('../../../src/utils/logger', () => ({
	logger: {
		info: jest.fn(),
		debug: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
	},
}));

describe('StatsCommand', () => {
	let command: StatsCommand;
	let mockContext: CommandContext;

	beforeEach(() => {
		command = new StatsCommand();
		mockContext = {
			message: {} as any,
			args: [],
			whatsappId: '447123456789@c.us',
			displayName: 'Test User',
		};

		jest.clearAllMocks();
	});

	it('should have correct metadata', () => {
		expect(command.name).toBe('stats');
		expect(command.aliases).toEqual([]);
		expect(command.description).toContain('drinking statistics');
		expect(command.adminOnly).toBe(false);
	});

	describe('argument validation', () => {
		it('should return error message when no period specified', async () => {
			mockContext.args = [];

			const result = await command.execute(mockContext);

			expect(result.success).toBe(true);
			expect(result.reply).toContain('Please specify a time period');
			expect(result.reply).toContain('!stats day');
			expect(result.reply).toContain('!stats week');
			expect(result.reply).toContain('!stats month');
			expect(result.reply).toContain('!stats weekend');
		});

		it('should return error message for invalid period', async () => {
			mockContext.args = ['invalid'];

			const result = await command.execute(mockContext);

			expect(result.success).toBe(true);
			expect(result.reply).toContain('Please specify a time period');
		});

		it('should be case insensitive for periods', async () => {
			const mockStats: DualPeriodStats = {
				calendar: { totalBeers: 10, topDrinker: null },
				rolling: { totalBeers: 15, topDrinker: null },
			};
			(statisticsService.getDayStats as jest.Mock).mockResolvedValue(mockStats);

			mockContext.args = ['DAY'];
			const result = await command.execute(mockContext);

			expect(result.success).toBe(true);
			expect(statisticsService.getDayStats).toHaveBeenCalled();
		});
	});

	describe('day stats', () => {
		it('should format day stats with no top drinkers', async () => {
			const mockStats: DualPeriodStats = {
				calendar: { totalBeers: 5, topDrinker: null },
				rolling: { totalBeers: 12, topDrinker: null },
			};
			(statisticsService.getDayStats as jest.Mock).mockResolvedValue(mockStats);

			mockContext.args = ['day'];
			const result = await command.execute(mockContext);

			expect(result.success).toBe(true);
			expect(result.reply).toContain('📊 *Day Stats* 🍺');
			expect(result.reply).toContain('*Today:* 5 beers');
			expect(result.reply).toContain('*Last 24 hours:* 12 beers');
			expect(result.reply).not.toContain('Top drinker');
		});

		it('should format day stats with top drinkers', async () => {
			const mockStats: DualPeriodStats = {
				calendar: {
					totalBeers: 10,
					topDrinker: { displayName: 'Alice', beerCount: 4 },
				},
				rolling: {
					totalBeers: 20,
					topDrinker: { displayName: 'Bob', beerCount: 8 },
				},
			};
			(statisticsService.getDayStats as jest.Mock).mockResolvedValue(mockStats);

			mockContext.args = ['day'];
			const result = await command.execute(mockContext);

			expect(result.success).toBe(true);
			expect(result.reply).toContain('*Today:* 10 beers');
			expect(result.reply).toContain('Top drinker: Alice (4)');
			expect(result.reply).toContain('*Last 24 hours:* 20 beers');
			expect(result.reply).toContain('Top drinker: Bob (8)');
		});

		it('should use singular "beer" for count of 1', async () => {
			const mockStats: DualPeriodStats = {
				calendar: {
					totalBeers: 1,
					topDrinker: { displayName: 'Alice', beerCount: 1 },
				},
				rolling: { totalBeers: 1, topDrinker: null },
			};
			(statisticsService.getDayStats as jest.Mock).mockResolvedValue(mockStats);

			mockContext.args = ['day'];
			const result = await command.execute(mockContext);

			expect(result.success).toBe(true);
			expect(result.reply).toContain('*Today:* 1 beer');
			expect(result.reply).toContain('*Last 24 hours:* 1 beer');
		});

		it('should handle zero beers', async () => {
			const mockStats: DualPeriodStats = {
				calendar: { totalBeers: 0, topDrinker: null },
				rolling: { totalBeers: 0, topDrinker: null },
			};
			(statisticsService.getDayStats as jest.Mock).mockResolvedValue(mockStats);

			mockContext.args = ['day'];
			const result = await command.execute(mockContext);

			expect(result.success).toBe(true);
			expect(result.reply).toContain('*Today:* 0 beers');
			expect(result.reply).toContain('*Last 24 hours:* 0 beers');
		});
	});

	describe('week stats', () => {
		it('should format week stats with no top drinkers', async () => {
			const mockStats: DualPeriodStats = {
				calendar: { totalBeers: 30, topDrinker: null },
				rolling: { totalBeers: 45, topDrinker: null },
			};
			(statisticsService.getWeekStats as jest.Mock).mockResolvedValue(
				mockStats,
			);

			mockContext.args = ['week'];
			const result = await command.execute(mockContext);

			expect(result.success).toBe(true);
			expect(result.reply).toContain('📊 *Week Stats* 🍺');
			expect(result.reply).toContain('*This week:* 30 beers');
			expect(result.reply).toContain('*Last 7 days:* 45 beers');
			expect(result.reply).not.toContain('Top drinker');
		});

		it('should format week stats with top drinkers', async () => {
			const mockStats: DualPeriodStats = {
				calendar: {
					totalBeers: 50,
					topDrinker: { displayName: 'Charlie', beerCount: 15 },
				},
				rolling: {
					totalBeers: 60,
					topDrinker: { displayName: 'Dave', beerCount: 20 },
				},
			};
			(statisticsService.getWeekStats as jest.Mock).mockResolvedValue(
				mockStats,
			);

			mockContext.args = ['week'];
			const result = await command.execute(mockContext);

			expect(result.success).toBe(true);
			expect(result.reply).toContain('*This week:* 50 beers');
			expect(result.reply).toContain('Top drinker: Charlie (15)');
			expect(result.reply).toContain('*Last 7 days:* 60 beers');
			expect(result.reply).toContain('Top drinker: Dave (20)');
		});
	});

	describe('month stats', () => {
		it('should format month stats with no top drinkers', async () => {
			const mockStats: DualPeriodStats = {
				calendar: { totalBeers: 100, topDrinker: null },
				rolling: { totalBeers: 150, topDrinker: null },
			};
			(statisticsService.getMonthStats as jest.Mock).mockResolvedValue(
				mockStats,
			);

			mockContext.args = ['month'];
			const result = await command.execute(mockContext);

			expect(result.success).toBe(true);
			expect(result.reply).toContain('📊 *Month Stats* 🍺');
			expect(result.reply).toContain('*This month:* 100 beers');
			expect(result.reply).toContain('*Last 30 days:* 150 beers');
			expect(result.reply).not.toContain('Top drinker');
		});

		it('should format month stats with top drinkers', async () => {
			const mockStats: DualPeriodStats = {
				calendar: {
					totalBeers: 200,
					topDrinker: { displayName: 'Eve', beerCount: 50 },
				},
				rolling: {
					totalBeers: 250,
					topDrinker: { displayName: 'Frank', beerCount: 70 },
				},
			};
			(statisticsService.getMonthStats as jest.Mock).mockResolvedValue(
				mockStats,
			);

			mockContext.args = ['month'];
			const result = await command.execute(mockContext);

			expect(result.success).toBe(true);
			expect(result.reply).toContain('*This month:* 200 beers');
			expect(result.reply).toContain('Top drinker: Eve (50)');
			expect(result.reply).toContain('*Last 30 days:* 250 beers');
			expect(result.reply).toContain('Top drinker: Frank (70)');
		});
	});

	describe('weekend stats', () => {
		it('should format weekend stats with only last weekend (Mon-Thu)', async () => {
			const mockStats: WeekendStats = {
				lastWeekend: {
					totalBeers: 40,
					topDrinker: { displayName: 'Grace', beerCount: 12 },
				},
			};
			(statisticsService.getWeekendStats as jest.Mock).mockResolvedValue(
				mockStats,
			);

			mockContext.args = ['weekend'];
			const result = await command.execute(mockContext);

			expect(result.success).toBe(true);
			expect(result.reply).toContain('📊 *Weekend Stats* 🍺');
			expect(result.reply).toContain('*Last weekend:* 40 beers');
			expect(result.reply).toContain('Top drinker: Grace (12)');
			expect(result.reply).not.toContain('*This weekend:*');
		});

		it('should format weekend stats with both weekends (Fri-Sun)', async () => {
			const mockStats: WeekendStats = {
				thisWeekend: {
					totalBeers: 25,
					topDrinker: { displayName: 'Hannah', beerCount: 8 },
				},
				lastWeekend: {
					totalBeers: 40,
					topDrinker: { displayName: 'Ivan', beerCount: 15 },
				},
			};
			(statisticsService.getWeekendStats as jest.Mock).mockResolvedValue(
				mockStats,
			);

			mockContext.args = ['weekend'];
			const result = await command.execute(mockContext);

			expect(result.success).toBe(true);
			expect(result.reply).toContain('*This weekend:* 25 beers');
			expect(result.reply).toContain('Top drinker: Hannah (8)');
			expect(result.reply).toContain('*Last weekend:* 40 beers');
			expect(result.reply).toContain('Top drinker: Ivan (15)');
		});

		it('should format weekend stats with no top drinkers', async () => {
			const mockStats: WeekendStats = {
				thisWeekend: { totalBeers: 10, topDrinker: null },
				lastWeekend: { totalBeers: 15, topDrinker: null },
			};
			(statisticsService.getWeekendStats as jest.Mock).mockResolvedValue(
				mockStats,
			);

			mockContext.args = ['weekend'];
			const result = await command.execute(mockContext);

			expect(result.success).toBe(true);
			expect(result.reply).toContain('*This weekend:* 10 beers');
			expect(result.reply).toContain('*Last weekend:* 15 beers');
			expect(result.reply).not.toContain('Top drinker');
		});
	});

	describe('error handling', () => {
		it('should throw CommandError when service throws', async () => {
			const error = new Error('Database connection failed');
			(statisticsService.getDayStats as jest.Mock).mockRejectedValue(error);

			mockContext.args = ['day'];

			await expect(command.execute(mockContext)).rejects.toThrow(CommandError);
		});

		it('should include correct error details in CommandError', async () => {
			const error = new Error('Service error');
			(statisticsService.getWeekStats as jest.Mock).mockRejectedValue(error);

			mockContext.args = ['week'];

			try {
				await command.execute(mockContext);
				fail('Should have thrown CommandError');
			} catch (err) {
				expect(err).toBeInstanceOf(CommandError);
				const commandError = err as CommandError;
				expect(commandError.code).toBe('STATS_FAILED');
				expect(commandError.userMessage).toBe(
					'Failed to load stats. Please try again.',
				);
			}
		});

		it('should handle errors for each period type', async () => {
			const periods = ['day', 'week', 'month', 'weekend'];
			const serviceMethods = [
				statisticsService.getDayStats,
				statisticsService.getWeekStats,
				statisticsService.getMonthStats,
				statisticsService.getWeekendStats,
			];

			for (let i = 0; i < periods.length; i++) {
				const error = new Error(`${periods[i]} error`);
				(serviceMethods[i] as jest.Mock).mockRejectedValue(error);

				mockContext.args = [periods[i]];

				await expect(command.execute(mockContext)).rejects.toThrow(CommandError);
			}
		});
	});
});
