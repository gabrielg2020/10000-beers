process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.WHATSAPP_GROUP_ID = '123456789@g.us';
process.env.AI_ENABLED = 'true';
process.env.AI_CONFIDENCE_THRESHOLD = '0.9';
process.env.GEMINI_API_KEY = 'test-key';
process.env.GEMINI_MODEL = 'gemini-1.5-flash';

import { readFile } from 'node:fs/promises';
import type { AiService } from '../../../src/services/aiService';

jest.mock('node:fs/promises', () => ({
	readFile: jest.fn(),
}));

const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn(() => ({
	generateContent: mockGenerateContent,
}));

jest.mock('@google/generative-ai', () => {
	return {
		GoogleGenerativeAI: jest.fn(() => ({
			getGenerativeModel: mockGetGenerativeModel,
		})),
	};
});

jest.mock('../../../src/utils/logger', () => ({
	logger: {
		info: jest.fn(),
		debug: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
	},
}));

describe('AiService', () => {
	let aiService: AiService;
	const mockImageBuffer = Buffer.from('fake-image-data');
	const mockSystemInstruction = 'You are a beer classifier';

	beforeAll(async () => {
		const { aiService: service } = await import('../../../src/services/aiService');
		aiService = service;
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('initialise', () => {
		beforeEach(() => {
			(readFile as jest.Mock).mockResolvedValue(mockSystemInstruction);
		});

		it('should load system instruction when AI is enabled', async () => {
			await aiService.initialise();

			expect(readFile).toHaveBeenCalledWith('src/system_instruction.md', 'utf8');
		});

		it('should skip initialisation when AI is disabled', async () => {
			const originalEnabled = process.env.AI_ENABLED;
			process.env.AI_ENABLED = 'false';
			(readFile as jest.Mock).mockClear();

			jest.resetModules();
			const { aiService: disabledService } = await import('../../../src/services/aiService');

			await disabledService.initialise();

			expect(readFile).not.toHaveBeenCalled();

			process.env.AI_ENABLED = originalEnabled;
		});

		it('should throw error if system instruction file not found', async () => {
			const fileError = new Error('File not found');
			(readFile as jest.Mock).mockRejectedValue(fileError);

			await expect(aiService.initialise()).rejects.toThrow('File not found');
		});
	});

	describe('classifyBeer', () => {
		beforeEach(async () => {
			(readFile as jest.Mock).mockImplementation((path: string) => {
				if (path === 'src/system_instruction.md') {
					return Promise.resolve(mockSystemInstruction);
				}
				return Promise.resolve(mockImageBuffer);
			});
			await aiService.initialise();
		});

		it('should auto-accept when AI is disabled', async () => {
			const originalEnabled = process.env.AI_ENABLED;
			process.env.AI_ENABLED = 'false';

			jest.resetModules();
			const { aiService: disabledService } = await import('../../../src/services/aiService');
			await disabledService.initialise();

			const result = await disabledService.classifyBeer('/path/to/image.jpg');

			expect(result).toEqual({
				isValid: true,
				beerType: null,
				confidence: 1.0,
			});

			process.env.AI_ENABLED = originalEnabled;
		});

		it('should accept valid beer with high confidence', async () => {
			const mockResponse = {
				beer_detected: true,
				type: 'can',
				confidence: 0.95,
			};

			(readFile as jest.Mock)
				.mockResolvedValueOnce(mockSystemInstruction)
				.mockResolvedValueOnce(mockImageBuffer);

			mockGenerateContent.mockResolvedValue({
				response: {
					text: () => JSON.stringify(mockResponse),
				},
			});

			const result = await aiService.classifyBeer('/path/to/image.jpg');

			expect(result).toEqual({
				isValid: true,
				beerType: 'can',
				confidence: 0.95,
			});
		});

		it('should reject when beer not detected', async () => {
			const mockResponse = {
				beer_detected: false,
				type: null,
				confidence: 0.8,
			};

			(readFile as jest.Mock)
				.mockResolvedValueOnce(mockSystemInstruction)
				.mockResolvedValueOnce(mockImageBuffer);

			mockGenerateContent.mockResolvedValue({
				response: {
					text: () => JSON.stringify(mockResponse),
				},
			});

			const result = await aiService.classifyBeer('/path/to/image.jpg');

			expect(result).toEqual({
				isValid: false,
				beerType: null,
				confidence: 0.8,
				error: 'No beer detected in image',
			});
		});

		it('should reject when confidence below threshold', async () => {
			const mockResponse = {
				beer_detected: true,
				type: 'bottle',
				confidence: 0.7,
			};

			(readFile as jest.Mock)
				.mockResolvedValueOnce(mockSystemInstruction)
				.mockResolvedValueOnce(mockImageBuffer);

			mockGenerateContent.mockResolvedValue({
				response: {
					text: () => JSON.stringify(mockResponse),
				},
			});

			const result = await aiService.classifyBeer('/path/to/image.jpg');

			expect(result).toEqual({
				isValid: false,
				beerType: 'bottle',
				confidence: 0.7,
				error: 'Classification confidence too low',
			});
		});

		it('should auto-accept on API failure', async () => {
			(readFile as jest.Mock)
				.mockResolvedValueOnce(mockSystemInstruction)
				.mockResolvedValueOnce(mockImageBuffer);

			mockGenerateContent.mockRejectedValue(new Error('API error'));

			const result = await aiService.classifyBeer('/path/to/image.jpg');

			expect(result).toEqual({
				isValid: true,
				beerType: null,
				confidence: 1.0,
				error: 'AI service unavailable',
			});
		});

		it('should handle markdown-wrapped JSON responses', async () => {
			const mockResponse = '```json\n{"beer_detected": true, "type": "draught", "confidence": 0.92}\n```';

			(readFile as jest.Mock)
				.mockResolvedValueOnce(mockSystemInstruction)
				.mockResolvedValueOnce(mockImageBuffer);

			mockGenerateContent.mockResolvedValue({
				response: {
					text: () => mockResponse,
				},
			});

			const result = await aiService.classifyBeer('/path/to/image.jpg');

			expect(result).toEqual({
				isValid: true,
				beerType: 'draught',
				confidence: 0.92,
			});
		});

		it('should accept beer at exact confidence threshold', async () => {
			const mockResponse = {
				beer_detected: true,
				type: 'can',
				confidence: 0.9,
			};

			(readFile as jest.Mock)
				.mockResolvedValueOnce(mockSystemInstruction)
				.mockResolvedValueOnce(mockImageBuffer);

			mockGenerateContent.mockResolvedValue({
				response: {
					text: () => JSON.stringify(mockResponse),
				},
			});

			const result = await aiService.classifyBeer('/path/to/image.jpg');

			expect(result).toEqual({
				isValid: true,
				beerType: 'can',
				confidence: 0.9,
			});
		});

		it('should use configured Gemini model', async () => {
			const mockResponse = {
				beer_detected: true,
				type: 'bottle',
				confidence: 0.95,
			};

			mockGenerateContent.mockResolvedValue({
				response: {
					text: () => JSON.stringify(mockResponse),
				},
			});

			await aiService.classifyBeer('/path/to/image.jpg');

			expect(mockGetGenerativeModel).toHaveBeenCalledWith(
				expect.objectContaining({
					model: 'gemini-1.5-flash',
				}),
			);
		});
	});
});
