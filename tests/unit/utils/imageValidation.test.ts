import {
	validateMimetype,
	validateFileSize,
	validateImageBuffer,
	getExtensionFromMimetype,
} from '../../../src/utils/imageValidation';

describe('imageValidation', () => {
	describe('validateMimetype', () => {
		it('should accept valid JPEG mimetype', () => {
			const result = validateMimetype('image/jpeg');

			expect(result.isValid).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it('should accept valid PNG mimetype', () => {
			const result = validateMimetype('image/png');

			expect(result.isValid).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it('should accept valid WebP mimetype', () => {
			const result = validateMimetype('image/webp');

			expect(result.isValid).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it('should accept valid GIF mimetype', () => {
			const result = validateMimetype('image/gif');

			expect(result.isValid).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it('should reject invalid mimetype', () => {
			const result = validateMimetype('image/bmp');

			expect(result.isValid).toBe(false);
			expect(result.error).toContain('Invalid image format');
		});

		it('should reject non-image mimetype', () => {
			const result = validateMimetype('application/pdf');

			expect(result.isValid).toBe(false);
			expect(result.error).toContain('Invalid image format');
		});
	});

	describe('validateFileSize', () => {
		it('should accept file size within limit', () => {
			const sizeBytes = 5 * 1024 * 1024;
			const maxSizeMB = 10;

			const result = validateFileSize(sizeBytes, maxSizeMB);

			expect(result.isValid).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it('should accept file size exactly at limit', () => {
			const sizeBytes = 10 * 1024 * 1024;
			const maxSizeMB = 10;

			const result = validateFileSize(sizeBytes, maxSizeMB);

			expect(result.isValid).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it('should reject file size over limit', () => {
			const sizeBytes = 11 * 1024 * 1024;
			const maxSizeMB = 10;

			const result = validateFileSize(sizeBytes, maxSizeMB);

			expect(result.isValid).toBe(false);
			expect(result.error).toContain('too large');
			expect(result.error).toContain('10MB');
		});

		it('should reject empty file', () => {
			const sizeBytes = 0;
			const maxSizeMB = 10;

			const result = validateFileSize(sizeBytes, maxSizeMB);

			expect(result.isValid).toBe(false);
			expect(result.error).toContain('empty');
		});
	});

	describe('validateImageBuffer', () => {
		it('should accept valid JPEG buffer', () => {
			const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

			const result = validateImageBuffer(jpegBuffer);

			expect(result.isValid).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it('should accept valid PNG buffer', () => {
			const pngBuffer = Buffer.from([
				0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
			]);

			const result = validateImageBuffer(pngBuffer);

			expect(result.isValid).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it('should accept valid WebP buffer', () => {
			const webpBuffer = Buffer.from([
				0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00,
			]);

			const result = validateImageBuffer(webpBuffer);

			expect(result.isValid).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it('should accept valid GIF buffer', () => {
			const gifBuffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);

			const result = validateImageBuffer(gifBuffer);

			expect(result.isValid).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it('should reject invalid buffer', () => {
			const invalidBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);

			const result = validateImageBuffer(invalidBuffer);

			expect(result.isValid).toBe(false);
			expect(result.error).toContain('corrupt or invalid');
		});

		it('should reject empty buffer', () => {
			const emptyBuffer = Buffer.alloc(0);

			const result = validateImageBuffer(emptyBuffer);

			expect(result.isValid).toBe(false);
			expect(result.error).toContain('corrupt or invalid');
		});

		it('should reject buffer that is too short', () => {
			const shortBuffer = Buffer.from([0xff]);

			const result = validateImageBuffer(shortBuffer);

			expect(result.isValid).toBe(false);
			expect(result.error).toContain('corrupt or invalid');
		});
	});

	describe('getExtensionFromMimetype', () => {
		it('should return jpg for image/jpeg', () => {
			const extension = getExtensionFromMimetype('image/jpeg');

			expect(extension).toBe('jpg');
		});

		it('should return png for image/png', () => {
			const extension = getExtensionFromMimetype('image/png');

			expect(extension).toBe('png');
		});

		it('should return webp for image/webp', () => {
			const extension = getExtensionFromMimetype('image/webp');

			expect(extension).toBe('webp');
		});

		it('should return gif for image/gif', () => {
			const extension = getExtensionFromMimetype('image/gif');

			expect(extension).toBe('gif');
		});

		it('should return jpg for unknown mimetype', () => {
			const extension = getExtensionFromMimetype('image/unknown');

			expect(extension).toBe('jpg');
		});
	});
});
