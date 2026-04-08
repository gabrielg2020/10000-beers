process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.WHATSAPP_GROUP_ID = '123456789@g.us';
process.env.REPLY_ON_SUBMISSION = 'true';
process.env.AI_ENABLED = 'false';

import { beerService } from '../../../src/services/beerService';
import { config } from '../../../src/config';
import { prisma } from '../../../src/database/client';
import { imageService } from '../../../src/services/imageService';
import { userService } from '../../../src/services/userService';
import { aiService } from '../../../src/services/aiService';
import { BeerSubmissionError } from '../../../src/types/submission';
import type { BeerSubmissionRequest } from '../../../src/types/submission';
import { MessageMedia } from 'whatsapp-web.js';

jest.mock('../../../src/database/client', () => ({
	prisma: {
		beer: {
			findFirst: jest.fn(),
			create: jest.fn(),
			delete: jest.fn(),
		},
		user: {
			findUnique: jest.fn(),
			findMany: jest.fn(),
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

jest.mock('../../../src/services/aiService', () => ({
	aiService: {
		classifyBeer: jest.fn(),
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
		config.bot.replyOnSubmission = true;
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
			const aiResult = {
				isValid: true,
				beerType: 'can' as const,
				confidence: 0.95,
			};
			const beer = {
				id: 'beer-789',
				userId: userInfo.id,
				submittedAt: request.submittedAt,
				imagePath: imageResult.imagePath,
				imageHash: imageResult.imageHash,
				beerType: 'can',
				classificationConfidence: 0.95,
			};

			(userService.findOrCreateUser as jest.Mock).mockResolvedValue(userInfo);
			(imageService.processImage as jest.Mock).mockResolvedValue(imageResult);
			(aiService.classifyBeer as jest.Mock).mockResolvedValue(aiResult);
			(prisma.beer.findFirst as jest.Mock).mockResolvedValue(null);
			(prisma.beer.create as jest.Mock).mockResolvedValue(beer);
			(userService.getTotalBeerCount as jest.Mock).mockResolvedValue(100);

			const result = await beerService.submitBeer(request);

			expect(userService.findOrCreateUser).toHaveBeenCalledWith(
				request.whatsappId,
				request.displayName,
			);
			expect(imageService.processImage).toHaveBeenCalled();
			expect(aiService.classifyBeer).toHaveBeenCalledWith(imageResult.imagePath);
			expect(prisma.beer.create).toHaveBeenCalledWith({
				data: {
					userId: userInfo.id,
					submittedAt: request.submittedAt,
					imagePath: imageResult.imagePath,
					imageHash: imageResult.imageHash,
					beerType: 'can',
					classificationConfidence: 0.95,
				},
			});
			expect(result).toEqual({
				success: true,
				beerId: beer.id,
				beerNumber: 100,
				message: 'Beer #100 logged by @John Doe! 🍺',
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
			const aiResult = {
				isValid: true,
				beerType: 'bottle' as const,
				confidence: 0.92,
			};
			const existingBeer = {
				id: 'beer-456',
				submittedAt: new Date('2026-03-01'),
			};

			(userService.findOrCreateUser as jest.Mock).mockResolvedValue(userInfo);
			(imageService.processImage as jest.Mock).mockResolvedValue(imageResult);
			(aiService.classifyBeer as jest.Mock).mockResolvedValue(aiResult);
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

		it('should suppress AI rejection message when replyOnSubmission is false', async () => {
			config.bot.replyOnSubmission = false;

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
			const aiResult = {
				isValid: false,
				beerType: null,
				confidence: 0.4,
				error: 'No beer detected in image',
			};

			(userService.findOrCreateUser as jest.Mock).mockResolvedValue(userInfo);
			(imageService.processImage as jest.Mock).mockResolvedValue(imageResult);
			(aiService.classifyBeer as jest.Mock).mockResolvedValue(aiResult);
			(prisma.beer.findFirst as jest.Mock).mockResolvedValue(null);

			try {
				await beerService.submitBeer(request);
				fail('Should have thrown an error');
			} catch (error) {
				expect(error).toBeInstanceOf(BeerSubmissionError);
				expect((error as BeerSubmissionError).code).toBe('AI_VALIDATION_FAILED');
				expect((error as BeerSubmissionError).userMessage).toBe('');
			}

			expect(imageService.deleteImage).toHaveBeenCalledWith(imageResult.imagePath);
			expect(prisma.beer.create).not.toHaveBeenCalled();
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
			const aiResult = {
				isValid: true,
				beerType: 'can' as const,
				confidence: 0.97,
			};
			const beer = {
				id: 'beer-first',
				userId: userInfo.id,
				submittedAt: request.submittedAt,
				imagePath: imageResult.imagePath,
				imageHash: imageResult.imageHash,
				beerType: 'can',
				classificationConfidence: 0.97,
			};

			(userService.findOrCreateUser as jest.Mock).mockResolvedValue(userInfo);
			(imageService.processImage as jest.Mock).mockResolvedValue(imageResult);
			(aiService.classifyBeer as jest.Mock).mockResolvedValue(aiResult);
			(prisma.beer.findFirst as jest.Mock).mockResolvedValue(null);
			(prisma.beer.create as jest.Mock).mockResolvedValue(beer);
			(userService.getTotalBeerCount as jest.Mock).mockResolvedValue(1);

			const result = await beerService.submitBeer(request);

			expect(result.success).toBe(true);
			expect(result.beerNumber).toBe(1);
		});

		it('should reject when AI validation fails', async () => {
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
			const aiResult = {
				isValid: false,
				beerType: null,
				confidence: 0.6,
				error: 'No beer detected in image',
			};

			(userService.findOrCreateUser as jest.Mock).mockResolvedValue(userInfo);
			(imageService.processImage as jest.Mock).mockResolvedValue(imageResult);
			(aiService.classifyBeer as jest.Mock).mockResolvedValue(aiResult);

			await expect(beerService.submitBeer(request)).rejects.toThrow(
				BeerSubmissionError,
			);

			try {
				await beerService.submitBeer(request);
			} catch (error) {
				expect((error as BeerSubmissionError).userMessage).toBe(
					"Doesn't look like a beer to me mate 🤔",
				);
				expect((error as BeerSubmissionError).code).toBe('AI_VALIDATION_FAILED');
			}

			expect(imageService.deleteImage).toHaveBeenCalledWith(imageResult.imagePath);
			expect(prisma.beer.create).not.toHaveBeenCalled();
		});

		it('should store null beer type when AI is disabled', async () => {
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
			const aiResult = {
				isValid: true,
				beerType: null,
				confidence: 1.0,
			};
			const beer = {
				id: 'beer-789',
				userId: userInfo.id,
				submittedAt: request.submittedAt,
				imagePath: imageResult.imagePath,
				imageHash: imageResult.imageHash,
				beerType: null,
				classificationConfidence: 1.0,
			};

			(userService.findOrCreateUser as jest.Mock).mockResolvedValue(userInfo);
			(imageService.processImage as jest.Mock).mockResolvedValue(imageResult);
			(aiService.classifyBeer as jest.Mock).mockResolvedValue(aiResult);
			(prisma.beer.findFirst as jest.Mock).mockResolvedValue(null);
			(prisma.beer.create as jest.Mock).mockResolvedValue(beer);
			(userService.getTotalBeerCount as jest.Mock).mockResolvedValue(100);

			const result = await beerService.submitBeer(request);

			expect(prisma.beer.create).toHaveBeenCalledWith({
				data: {
					userId: userInfo.id,
					submittedAt: request.submittedAt,
					imagePath: imageResult.imagePath,
					imageHash: imageResult.imageHash,
					beerType: null,
					classificationConfidence: 1.0,
				},
			});
			expect(result.success).toBe(true);
		});

		it('should delete image when AI validation fails', async () => {
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
			const aiResult = {
				isValid: false,
				beerType: null,
				confidence: 0.5,
				error: 'Classification confidence too low',
			};

			(userService.findOrCreateUser as jest.Mock).mockResolvedValue(userInfo);
			(imageService.processImage as jest.Mock).mockResolvedValue(imageResult);
			(aiService.classifyBeer as jest.Mock).mockResolvedValue(aiResult);

			await expect(beerService.submitBeer(request)).rejects.toThrow();

			expect(imageService.deleteImage).toHaveBeenCalledWith(imageResult.imagePath);
			expect(prisma.beer.create).not.toHaveBeenCalled();
		});
	});

	describe('removeLastBeer', () => {
		it('should remove beer within time window', async () => {
			const now = new Date();
			const recentBeer = {
				id: 'beer-123',
				userId: 'user-123',
				submittedAt: new Date(now.getTime() - 5 * 60 * 1000),
				imagePath: '/data/images/test.jpg',
			};

			const mockUser = {
				id: 'user-123',
				whatsappId: '447123456789@c.us',
				displayName: 'Test User',
				beers: [recentBeer],
			};

			(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
			(prisma.beer.delete as jest.Mock).mockResolvedValue(recentBeer);
			(userService.getTotalBeerCount as jest.Mock).mockResolvedValue(42);

			const result = await beerService.removeLastBeer('447123456789@c.us', 10);

			expect(result.success).toBe(true);
			expect(result.beerNumber).toBe(42);
			expect(result.beerId).toBe('beer-123');
			expect(imageService.deleteImage).toHaveBeenCalledWith('/data/images/test.jpg');
			expect(prisma.beer.delete).toHaveBeenCalledWith({ where: { id: 'beer-123' } });
		});

		it('should reject when no beers in time window', async () => {
			const mockUser = {
				id: 'user-123',
				whatsappId: '447123456789@c.us',
				displayName: 'Test User',
				beers: [],
			};

			(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

			try {
				await beerService.removeLastBeer('447123456789@c.us', 10);
				fail('Should have thrown an error');
			} catch (error) {
				expect(error).toBeInstanceOf(BeerSubmissionError);
				expect((error as BeerSubmissionError).userMessage).toBe(
					'You have no beers submitted in the last 10 minutes to undo',
				);
			}
		});

		it('should work without time window (admin mode)', async () => {
			const oldBeer = {
				id: 'beer-123',
				userId: 'user-123',
				submittedAt: new Date('2020-01-01'),
				imagePath: '/data/images/test.jpg',
			};

			const mockUser = {
				id: 'user-123',
				whatsappId: '447123456789@c.us',
				displayName: 'Test User',
				beers: [oldBeer],
			};

			(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
			(prisma.beer.delete as jest.Mock).mockResolvedValue(oldBeer);
			(userService.getTotalBeerCount as jest.Mock).mockResolvedValue(42);

			const result = await beerService.removeLastBeer('447123456789@c.us');

			expect(result.success).toBe(true);
			expect(result.beerId).toBe('beer-123');
		});

		it('should throw error when user not found', async () => {
			(prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
			(prisma.user.findMany as jest.Mock).mockResolvedValue([]);

			await expect(
				beerService.removeLastBeer('447123456789@c.us'),
			).rejects.toThrow(BeerSubmissionError);
		});

		it('should show user-friendly error for undo when user not found', async () => {
			(prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
			(prisma.user.findMany as jest.Mock).mockResolvedValue([]);

			try {
				await beerService.removeLastBeer('447123456789@c.us', 10);
				fail('Should have thrown an error');
			} catch (error) {
				expect(error).toBeInstanceOf(BeerSubmissionError);
				expect((error as BeerSubmissionError).userMessage).toBe(
					'You have not submitted any beers yet',
				);
			}
		});

		it('should show admin error when user not found in admin mode', async () => {
			(prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
			(prisma.user.findMany as jest.Mock).mockResolvedValue([]);

			try {
				await beerService.removeLastBeer('447123456789@c.us');
				fail('Should have thrown an error');
			} catch (error) {
				expect(error).toBeInstanceOf(BeerSubmissionError);
				expect((error as BeerSubmissionError).userMessage).toBe('User not found');
			}
		});

		it('should delete image file when removing beer', async () => {
			const recentBeer = {
				id: 'beer-123',
				imagePath: '/data/images/test.jpg',
				submittedAt: new Date(),
			};

			const mockUser = {
				id: 'user-123',
				whatsappId: '447123456789@c.us',
				displayName: 'Test User',
				beers: [recentBeer],
			};

			(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
			(userService.getTotalBeerCount as jest.Mock).mockResolvedValue(1);
			(prisma.beer.delete as jest.Mock).mockResolvedValue(recentBeer);

			await beerService.removeLastBeer('447123456789@c.us', 10);

			expect(imageService.deleteImage).toHaveBeenCalledWith('/data/images/test.jpg');
		});
	});
});
