import { beerService } from '../../../src/services/beerService';
import { prisma } from '../../../src/database/client';
import { imageService } from '../../../src/services/imageService';
import { userService } from '../../../src/services/userService';
import { BeerSubmissionError } from '../../../src/types/submission';
import type { BeerSubmissionRequest } from '../../../src/types/submission';
import { MessageMedia } from 'whatsapp-web.js';

jest.mock('../../../src/database/client', () => ({
	prisma: {
		beer: {
			findFirst: jest.fn(),
			create: jest.fn(),
		},
	},
}));

jest.mock('../../../src/services/imageService', () => ({
	imageService: {
		processImage: jest.fn(),
		deleteImage: jest.fn(),
	},
}));

jest.mock('../../../src/services/userService', () => ({
	userService: {
		findOrCreateUser: jest.fn(),
		getTotalBeerCount: jest.fn(),
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

jest.mock('whatsapp-web.js');

describe('BeerService', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		process.env.REPLY_ON_SUBMISSION = 'true';
	});

	describe('checkDuplicate', () => {
		it('should return not duplicate if no matching beer found', async () => {
			const userId = 'user-123';
			const imageHash = 'hash123';
			(prisma.beer.findFirst as jest.Mock).mockResolvedValue(null);

			const result = await beerService.checkDuplicate(userId, imageHash);

			expect(prisma.beer.findFirst).toHaveBeenCalledWith({
				where: { userId, imageHash },
				select: { id: true, submittedAt: true },
			});
			expect(result).toEqual({ isDuplicate: false });
		});

		it('should return duplicate info if matching beer found', async () => {
			const userId = 'user-123';
			const imageHash = 'hash123';
			const existingBeer = {
				id: 'beer-456',
				submittedAt: new Date('2026-03-01'),
			};
			(prisma.beer.findFirst as jest.Mock).mockResolvedValue(existingBeer);

			const result = await beerService.checkDuplicate(userId, imageHash);

			expect(result).toEqual({
				isDuplicate: true,
				existingBeerId: existingBeer.id,
				submittedAt: existingBeer.submittedAt,
			});
		});
	});

	describe('submitBeer', () => {
		const createMockRequest = (): BeerSubmissionRequest => ({
			whatsappId: '447123456789@c.us',
			displayName: 'John Doe',
			media: {
				data: 'base64data',
				mimetype: 'image/jpeg',
				filename: 'beer.jpg',
			},
			submittedAt: new Date('2026-03-17T20:00:00Z'),
			messageId: 'msg-123',
		});

		it('should successfully submit a new beer', async () => {
			const request = createMockRequest();
			const userInfo = {
				id: 'user-123',
				whatsappId: request.whatsappId,
				displayName: request.displayName,
				isNewUser: false,
			};
			const imageResult = {
				imagePath: '/data/images/beer.jpg',
				imageHash: 'hash123',
				sizeBytes: 1024,
			};
			const beer = {
				id: 'beer-789',
				userId: userInfo.id,
				submittedAt: request.submittedAt,
				imagePath: imageResult.imagePath,
				imageHash: imageResult.imageHash,
			};

			(userService.findOrCreateUser as jest.Mock).mockResolvedValue(userInfo);
			(imageService.processImage as jest.Mock).mockResolvedValue(imageResult);
			(prisma.beer.findFirst as jest.Mock).mockResolvedValue(null);
			(prisma.beer.create as jest.Mock).mockResolvedValue(beer);
			(userService.getTotalBeerCount as jest.Mock).mockResolvedValue(100);

			const result = await beerService.submitBeer(request);

			expect(userService.findOrCreateUser).toHaveBeenCalledWith(
				request.whatsappId,
				request.displayName,
			);
			expect(imageService.processImage).toHaveBeenCalled();
			expect(prisma.beer.create).toHaveBeenCalledWith({
				data: {
					userId: userInfo.id,
					submittedAt: request.submittedAt,
					imagePath: imageResult.imagePath,
					imageHash: imageResult.imageHash,
				},
			});
			expect(result).toEqual({
				success: true,
				beerId: beer.id,
				beerNumber: 100,
				message: 'Beer #100 logged for @John Doe! 🍺',
			});
		});

		it('should reject duplicate beer submission', async () => {
			const request = createMockRequest();
			const userInfo = {
				id: 'user-123',
				whatsappId: request.whatsappId,
				displayName: request.displayName,
				isNewUser: false,
			};
			const imageResult = {
				imagePath: '/data/images/beer.jpg',
				imageHash: 'hash123',
				sizeBytes: 1024,
			};
			const existingBeer = {
				id: 'beer-456',
				submittedAt: new Date('2026-03-01'),
			};

			(userService.findOrCreateUser as jest.Mock).mockResolvedValue(userInfo);
			(imageService.processImage as jest.Mock).mockResolvedValue(imageResult);
			(prisma.beer.findFirst as jest.Mock).mockResolvedValue(existingBeer);

			await expect(beerService.submitBeer(request)).rejects.toThrow(
				BeerSubmissionError,
			);

			try {
				await beerService.submitBeer(request);
			} catch (error) {
				expect((error as BeerSubmissionError).userMessage).toBe(
					"You've already submitted this beer",
				);
			}

			expect(imageService.deleteImage).toHaveBeenCalledWith(
				imageResult.imagePath,
			);
			expect(prisma.beer.create).not.toHaveBeenCalled();
		});

		it('should not include message when REPLY_ON_SUBMISSION is false', async () => {
			process.env.REPLY_ON_SUBMISSION = 'false';
			const request = createMockRequest();
			const userInfo = {
				id: 'user-123',
				whatsappId: request.whatsappId,
				displayName: request.displayName,
				isNewUser: false,
			};
			const imageResult = {
				imagePath: '/data/images/beer.jpg',
				imageHash: 'hash123',
				sizeBytes: 1024,
			};
			const beer = {
				id: 'beer-789',
				userId: userInfo.id,
				submittedAt: request.submittedAt,
				imagePath: imageResult.imagePath,
				imageHash: imageResult.imageHash,
			};

			(userService.findOrCreateUser as jest.Mock).mockResolvedValue(userInfo);
			(imageService.processImage as jest.Mock).mockResolvedValue(imageResult);
			(prisma.beer.findFirst as jest.Mock).mockResolvedValue(null);
			(prisma.beer.create as jest.Mock).mockResolvedValue(beer);
			(userService.getTotalBeerCount as jest.Mock).mockResolvedValue(100);

			const beerServiceInstance = new (beerService.constructor as any)();
			const result = await beerServiceInstance.submitBeer(request);

			expect(result.message).toBe('');
		});

		it('should wrap unexpected errors in BeerSubmissionError', async () => {
			const request = createMockRequest();
			const error = new Error('Database connection failed');
			(userService.findOrCreateUser as jest.Mock).mockRejectedValue(error);

			await expect(beerService.submitBeer(request)).rejects.toThrow(
				BeerSubmissionError,
			);

			try {
				await beerService.submitBeer(request);
			} catch (error) {
				expect((error as BeerSubmissionError).userMessage).toBe(
					'Failed to save your beer, please try again',
				);
			}
		});

		it('should create new user on first submission', async () => {
			const request = createMockRequest();
			const userInfo = {
				id: 'user-new',
				whatsappId: request.whatsappId,
				displayName: request.displayName,
				isNewUser: true,
			};
			const imageResult = {
				imagePath: '/data/images/beer.jpg',
				imageHash: 'hash123',
				sizeBytes: 1024,
			};
			const beer = {
				id: 'beer-first',
				userId: userInfo.id,
				submittedAt: request.submittedAt,
				imagePath: imageResult.imagePath,
				imageHash: imageResult.imageHash,
			};

			(userService.findOrCreateUser as jest.Mock).mockResolvedValue(userInfo);
			(imageService.processImage as jest.Mock).mockResolvedValue(imageResult);
			(prisma.beer.findFirst as jest.Mock).mockResolvedValue(null);
			(prisma.beer.create as jest.Mock).mockResolvedValue(beer);
			(userService.getTotalBeerCount as jest.Mock).mockResolvedValue(1);

			const result = await beerService.submitBeer(request);

			expect(result.success).toBe(true);
			expect(result.beerNumber).toBe(1);
		});
	});
});
