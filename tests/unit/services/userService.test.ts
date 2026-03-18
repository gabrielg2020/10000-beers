import { userService } from '../../../src/services/userService';
import { prisma } from '../../../src/database/client';

jest.mock('../../../src/database/client', () => ({
	prisma: {
		user: {
			findUnique: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
		},
		beer: {
			count: jest.fn(),
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

describe('UserService', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('findOrCreateUser', () => {
		it('should return existing user if found', async () => {
			const whatsappId = '447123456789@c.us';
			const displayName = 'John Doe';
			const existingUser = {
				id: 'user-123',
				whatsappId,
				displayName,
				isActive: true,
				createdAt: new Date(),
			};
			(prisma.user.findUnique as jest.Mock).mockResolvedValue(existingUser);

			const result = await userService.findOrCreateUser(whatsappId, displayName);

			expect(prisma.user.findUnique).toHaveBeenCalledWith({
				where: { whatsappId },
			});
			expect(result).toEqual({
				id: existingUser.id,
				whatsappId: existingUser.whatsappId,
				displayName: existingUser.displayName,
				isNewUser: false,
			});
			expect(prisma.user.create).not.toHaveBeenCalled();
		});

		it('should update display name if it has changed', async () => {
			const whatsappId = '447123456789@c.us';
			const oldName = 'John Doe';
			const newName = 'Johnny Doe';
			const existingUser = {
				id: 'user-123',
				whatsappId,
				displayName: oldName,
				isActive: true,
				createdAt: new Date(),
			};
			const updatedUser = { ...existingUser, displayName: newName };
			(prisma.user.findUnique as jest.Mock).mockResolvedValue(existingUser);
			(prisma.user.update as jest.Mock).mockResolvedValue(updatedUser);

			const result = await userService.findOrCreateUser(whatsappId, newName);

			expect(prisma.user.update).toHaveBeenCalledWith({
				where: { whatsappId },
				data: { displayName: newName },
			});
			expect(result.displayName).toBe(newName);
		});

		it('should create new user if not found', async () => {
			const whatsappId = '447123456789@c.us';
			const displayName = 'John Doe';
			const newUser = {
				id: 'user-456',
				whatsappId,
				displayName,
				isActive: true,
				createdAt: new Date(),
			};
			(prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
			(prisma.user.create as jest.Mock).mockResolvedValue(newUser);

			const result = await userService.findOrCreateUser(whatsappId, displayName);

			expect(prisma.user.create).toHaveBeenCalledWith({
				data: {
					whatsappId,
					displayName,
					isActive: true,
				},
			});
			expect(result).toEqual({
				id: newUser.id,
				whatsappId: newUser.whatsappId,
				displayName: newUser.displayName,
				isNewUser: true,
			});
		});

		it('should throw error if database operation fails', async () => {
			const whatsappId = '447123456789@c.us';
			const displayName = 'John Doe';
			const error = new Error('Database error');
			(prisma.user.findUnique as jest.Mock).mockRejectedValue(error);

			await expect(
				userService.findOrCreateUser(whatsappId, displayName),
			).rejects.toThrow(error);
		});
	});

	describe('getUserBeerCount', () => {
		it('should return beer count for user', async () => {
			const userId = 'user-123';
			const count = 42;
			(prisma.beer.count as jest.Mock).mockResolvedValue(count);

			const result = await userService.getUserBeerCount(userId);

			expect(prisma.beer.count).toHaveBeenCalledWith({
				where: { userId },
			});
			expect(result).toBe(count);
		});

		it('should return 0 if user has no beers', async () => {
			const userId = 'user-123';
			(prisma.beer.count as jest.Mock).mockResolvedValue(0);

			const result = await userService.getUserBeerCount(userId);

			expect(result).toBe(0);
		});
	});

	describe('getTotalBeerCount', () => {
		it('should return total beer count', async () => {
			const count = 1234;
			(prisma.beer.count as jest.Mock).mockResolvedValue(count);

			const result = await userService.getTotalBeerCount();

			expect(prisma.beer.count).toHaveBeenCalled();
			expect(result).toBe(count);
		});

		it('should return 0 if no beers exist', async () => {
			(prisma.beer.count as jest.Mock).mockResolvedValue(0);

			const result = await userService.getTotalBeerCount();

			expect(result).toBe(0);
		});
	});
});
