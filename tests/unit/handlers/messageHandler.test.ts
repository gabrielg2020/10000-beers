process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.WHATSAPP_GROUP_ID = '123456789@g.us';

import { MessageHandler } from '../../../src/handlers/messageHandler';
import { beerService } from '../../../src/services/beerService';
import { BeerSubmissionError } from '../../../src/types/submission';
import type { Message, Contact } from 'whatsapp-web.js';

jest.mock('../../../src/services/beerService', () => ({
	beerService: {
		submitBeer: jest.fn(),
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

describe('MessageHandler', () => {
	let handler: MessageHandler;
	const groupId = '123456789@g.us';

	beforeAll(() => {
		process.env.WHATSAPP_GROUP_ID = groupId;
	});

	beforeEach(() => {
		jest.clearAllMocks();
		handler = new MessageHandler();
	});

	afterAll(() => {
		delete process.env.WHATSAPP_GROUP_ID;
	});

	describe('constructor', () => {
		it('should initialise with group ID from environment', () => {
			const handler = new MessageHandler();

			expect(handler['groupId']).toBe(groupId);
		});
	});

	describe('isFromConfiguredGroup', () => {
		it('should return true if message is from configured group', () => {
			const message = { from: groupId } as Message;

			const result = handler.isFromConfiguredGroup(message);

			expect(result).toBe(true);
		});

		it('should return false if message is from different group', () => {
			const message = { from: '999999999@g.us' } as Message;

			const result = handler.isFromConfiguredGroup(message);

			expect(result).toBe(false);
		});

		it('should return false if message is from individual chat', () => {
			const message = { from: '447123456789@c.us' } as Message;

			const result = handler.isFromConfiguredGroup(message);

			expect(result).toBe(false);
		});
	});

	describe('handleMessage', () => {
		const createMockMessage = (overrides = {}): Message => {
			const contact: Partial<Contact> = {
				id: {
					_serialized: '447123456789@c.us',
					server: 'c.us',
					user: '447123456789',
				} as any,
				pushname: 'John Doe',
				name: 'John Doe',
			};

			return {
				from: groupId,
				hasMedia: true,
				timestamp: 1710705600,
				id: { _serialized: 'msg-123' },
				getContact: jest.fn().mockResolvedValue(contact),
				downloadMedia: jest.fn().mockResolvedValue({
					data: 'base64data',
					mimetype: 'image/jpeg',
					filename: 'beer.jpg',
				}),
				reply: jest.fn().mockResolvedValue(undefined),
				...overrides,
			} as unknown as Message;
		};

		it('should ignore messages from different groups', async () => {
			const message = createMockMessage({ from: '999999999@g.us' });

			await handler.handleMessage(message);

			expect(beerService.submitBeer).not.toHaveBeenCalled();
		});

		it('should ignore messages without media', async () => {
			const message = createMockMessage({ hasMedia: false });

			await handler.handleMessage(message);

			expect(beerService.submitBeer).not.toHaveBeenCalled();
		});

		it('should successfully process beer submission', async () => {
			const message = createMockMessage();
			const submissionResult = {
				success: true,
				beerId: 'beer-123',
				beerNumber: 42,
				message: 'Beer #42 logged for @John Doe! 🍺',
			};
			(beerService.submitBeer as jest.Mock).mockResolvedValue(submissionResult);

			await handler.handleMessage(message);

			expect(message.getContact).toHaveBeenCalled();
			expect(message.downloadMedia).toHaveBeenCalled();
			expect(beerService.submitBeer).toHaveBeenCalledWith({
				whatsappId: '447123456789@c.us',
				displayName: 'John Doe',
				media: {
					data: 'base64data',
					mimetype: 'image/jpeg',
					filename: 'beer.jpg',
				},
				submittedAt: new Date(1710705600 * 1000),
				messageId: 'msg-123',
			});
			expect(message.reply).toHaveBeenCalledWith(submissionResult.message);
		});

		it('should not reply if message is empty', async () => {
			const message = createMockMessage();
			const submissionResult = {
				success: true,
				beerId: 'beer-123',
				beerNumber: 42,
				message: '',
			};
			(beerService.submitBeer as jest.Mock).mockResolvedValue(submissionResult);

			await handler.handleMessage(message);

			expect(message.reply).not.toHaveBeenCalled();
		});

		it('should handle media download failure', async () => {
			const message = createMockMessage({
				downloadMedia: jest.fn().mockResolvedValue(null),
			});

			await handler.handleMessage(message);

			expect(beerService.submitBeer).not.toHaveBeenCalled();
			expect(message.reply).toHaveBeenCalledWith(
				'Failed to download image, please try again',
			);
		});

		it('should handle BeerSubmissionError with user-friendly message', async () => {
			const message = createMockMessage();
			const error = new BeerSubmissionError(
				'Duplicate detected',
				'DUPLICATE_SUBMISSION',
				"You've already submitted this beer",
			);
			(beerService.submitBeer as jest.Mock).mockRejectedValue(error);

			await handler.handleMessage(message);

			expect(message.reply).toHaveBeenCalledWith(
				"You've already submitted this beer",
			);
		});

		it('should handle unexpected errors gracefully', async () => {
			const message = createMockMessage();
			const error = new Error('Database connection failed');
			(beerService.submitBeer as jest.Mock).mockRejectedValue(error);

			await handler.handleMessage(message);

			expect(message.reply).toHaveBeenCalledWith(
				'Something went wrong processing your beer. Please try again',
			);
		});

		it('should use contact name as fallback if pushname is missing', async () => {
			const contact: Partial<Contact> = {
				id: {
					_serialized: '447123456789@c.us',
					server: 'c.us',
					user: '447123456789',
				} as any,
				pushname: undefined,
				name: 'Jane Doe',
			};
			const message = createMockMessage({
				getContact: jest.fn().mockResolvedValue(contact),
			});
			(beerService.submitBeer as jest.Mock).mockResolvedValue({
				success: true,
				beerId: 'beer-123',
				beerNumber: 1,
				message: '',
			});

			await handler.handleMessage(message);

			expect(beerService.submitBeer).toHaveBeenCalledWith(
				expect.objectContaining({
					displayName: 'Jane Doe',
				}),
			);
		});

		it('should use "Unknown" as fallback if no name available', async () => {
			const contact: Partial<Contact> = {
				id: {
					_serialized: '447123456789@c.us',
					server: 'c.us',
					user: '447123456789',
				} as any,
				pushname: undefined,
				name: undefined,
			};
			const message = createMockMessage({
				getContact: jest.fn().mockResolvedValue(contact),
			});
			(beerService.submitBeer as jest.Mock).mockResolvedValue({
				success: true,
				beerId: 'beer-123',
				beerNumber: 1,
				message: '',
			});

			await handler.handleMessage(message);

			expect(beerService.submitBeer).toHaveBeenCalledWith(
				expect.objectContaining({
					displayName: 'Unknown',
				}),
			);
		});

		it('should convert null filename to undefined', async () => {
			const message = createMockMessage({
				downloadMedia: jest.fn().mockResolvedValue({
					data: 'base64data',
					mimetype: 'image/jpeg',
					filename: null,
				}),
			});
			(beerService.submitBeer as jest.Mock).mockResolvedValue({
				success: true,
				beerId: 'beer-123',
				beerNumber: 1,
				message: '',
			});

			await handler.handleMessage(message);

			expect(beerService.submitBeer).toHaveBeenCalledWith(
				expect.objectContaining({
					media: {
						data: 'base64data',
						mimetype: 'image/jpeg',
						filename: undefined,
					},
				}),
			);
		});
	});
});
