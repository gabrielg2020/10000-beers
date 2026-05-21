import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
	ensureDirectoryExists,
	writeImageFile,
	deleteImageFile,
	generateImageFilename,
	FileSystemError,
} from '../../../src/utils/fileSystem';

jest.mock('node:fs', () => ({
	promises: {
		access: jest.fn(),
		mkdir: jest.fn(),
		writeFile: jest.fn(),
		unlink: jest.fn(),
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

describe('fileSystem', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('ensureDirectoryExists', () => {
		it('should not create directory if it already exists', async () => {
			const dirPath = '/data/images';
			(fs.access as jest.Mock).mockResolvedValue(undefined);

			await ensureDirectoryExists(dirPath);

			expect(fs.access).toHaveBeenCalledWith(dirPath);
			expect(fs.mkdir).not.toHaveBeenCalled();
		});

		it('should create directory if it does not exist', async () => {
			const dirPath = '/data/images';
			(fs.access as jest.Mock).mockRejectedValue(new Error('ENOENT'));

			await ensureDirectoryExists(dirPath);

			expect(fs.access).toHaveBeenCalledWith(dirPath);
			expect(fs.mkdir).toHaveBeenCalledWith(dirPath, { recursive: true });
		});
	});

	describe('writeImageFile', () => {
		it('should write buffer to file', async () => {
			const filePath = '/data/images/test.jpg';
			const buffer = Buffer.from('test data');
			(fs.writeFile as jest.Mock).mockResolvedValue(undefined);

			await writeImageFile(filePath, buffer);

			expect(fs.writeFile).toHaveBeenCalledWith(filePath, buffer);
		});

		it('should throw FileSystemError if write fails', async () => {
			const filePath = '/data/images/test.jpg';
			const buffer = Buffer.from('test data');
			(fs.writeFile as jest.Mock).mockRejectedValue(
				new Error('Permission denied'),
			);

			await expect(writeImageFile(filePath, buffer)).rejects.toThrow(
				FileSystemError,
			);
			await expect(writeImageFile(filePath, buffer)).rejects.toThrow(
				'Failed to write image',
			);
		});

		it('should include operation in FileSystemError', async () => {
			const filePath = '/data/images/test.jpg';
			const buffer = Buffer.from('test data');
			(fs.writeFile as jest.Mock).mockRejectedValue(
				new Error('Permission denied'),
			);

			try {
				await writeImageFile(filePath, buffer);
				fail('Should have thrown error');
			} catch (error) {
				expect(error).toBeInstanceOf(FileSystemError);
				expect((error as FileSystemError).operation).toBe('writeFile');
			}
		});
	});

	describe('deleteImageFile', () => {
		it('should delete file', async () => {
			const filePath = '/data/images/test.jpg';
			(fs.unlink as jest.Mock).mockResolvedValue(undefined);

			await deleteImageFile(filePath);

			expect(fs.unlink).toHaveBeenCalledWith(filePath);
		});

		it('should not throw error if deletion fails', async () => {
			const filePath = '/data/images/test.jpg';
			(fs.unlink as jest.Mock).mockRejectedValue(new Error('File not found'));

			await expect(deleteImageFile(filePath)).resolves.toBeUndefined();
		});
	});

	describe('generateImageFilename', () => {
		it('should generate filename with correct format', () => {
			const userId = 'user-123';
			const extension = 'jpg';

			const filename = generateImageFilename(userId, extension);

			expect(filename).toMatch(/^\d+-user-123-[a-z0-9]+\.jpg$/);
		});

		it('should generate unique filenames for same user', () => {
			const userId = 'user-123';
			const extension = 'jpg';

			const filename1 = generateImageFilename(userId, extension);
			const filename2 = generateImageFilename(userId, extension);

			expect(filename1).not.toBe(filename2);
		});

		it('should include timestamp in filename', () => {
			const userId = 'user-123';
			const extension = 'png';
			const beforeTimestamp = Date.now();

			const filename = generateImageFilename(userId, extension);

			const afterTimestamp = Date.now();
			const filenameTimestamp = Number.parseInt(filename.split('-')[0]);
			expect(filenameTimestamp).toBeGreaterThanOrEqual(beforeTimestamp);
			expect(filenameTimestamp).toBeLessThanOrEqual(afterTimestamp);
		});

		it('should use provided extension', () => {
			const userId = 'user-123';
			const extension = 'webp';

			const filename = generateImageFilename(userId, extension);

			expect(filename.endsWith('.webp')).toBe(true);
		});
	});
});
