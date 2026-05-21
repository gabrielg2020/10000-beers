import { UndoCommand } from '../../../src/commands/undoCommand';
import { beerService } from '../../../src/services/beerService';
import { CommandError } from '../../../src/types/statistics';
import type { CommandContext } from '../../../src/commands/types';

jest.mock('../../../src/services/beerService');
jest.mock('../../../src/utils/logger', () => ({
	logger: {
		info: jest.fn(),
		debug: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
	},
}));

describe('UndoCommand', () => {
	let command: UndoCommand;
	let mockContext: CommandContext;

	beforeEach(() => {
		command = new UndoCommand();
		mockContext = {
			message: {} as any,
			args: [],
			whatsappId: '447123456789@c.us',
			displayName: 'Test User',
		};

		jest.clearAllMocks();
	});

	it('should have correct metadata', () => {
		expect(command.name).toBe('undo');
		expect(command.aliases).toEqual([]);
		expect(command.description).toContain('Undo your last beer submission');
		expect(command.adminOnly).toBe(false);
	});

	it('should successfully undo last beer with 10 minute time window', async () => {
		const mockResult = {
			success: true,
			displayName: 'Test User',
			beerId: 'beer-123',
			beerNumber: 42,
		};

		(beerService.removeLastBeer as jest.Mock).mockResolvedValue(mockResult);

		const result = await command.execute(mockContext);

		expect(result.success).toBe(true);
		expect(result.reply).toContain('Beer #42 undone!');
		expect(beerService.removeLastBeer).toHaveBeenCalledWith('447123456789@c.us', 10);
	});

	it('should handle user not found error', async () => {
		(beerService.removeLastBeer as jest.Mock).mockRejectedValue(
			new Error('You have not submitted any beers yet'),
		);

		await expect(command.execute(mockContext)).rejects.toThrow(CommandError);
	});

	it('should handle no recent beers error', async () => {
		(beerService.removeLastBeer as jest.Mock).mockRejectedValue(
			new Error('You have no beers submitted in the last 10 minutes to undo'),
		);

		await expect(command.execute(mockContext)).rejects.toThrow(CommandError);
	});

	it('should handle generic errors', async () => {
		(beerService.removeLastBeer as jest.Mock).mockRejectedValue(
			new Error('Database connection failed'),
		);

		await expect(command.execute(mockContext)).rejects.toThrow(CommandError);
	});

	it('should rethrow CommandError as-is', async () => {
		const commandError = new CommandError(
			'Test error',
			'TEST_ERROR',
			'Test message',
		);

		(beerService.removeLastBeer as jest.Mock).mockRejectedValue(commandError);

		await expect(command.execute(mockContext)).rejects.toBe(commandError);
	});
});
