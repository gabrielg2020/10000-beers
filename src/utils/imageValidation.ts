import type { ImageValidationResult } from '../types/image';

const ALLOWED_MIMETYPES = ['image/jpeg'];

const ALLOWED_EXTENSIONS = ['jpeg', 'jpg'];

export function validateMimetype(mimetype: string): ImageValidationResult {
	if (!ALLOWED_MIMETYPES.includes(mimetype)) {
		return {
			isValid: false,
			error: `Invalid image format. Only JPEG images are allowed`,
		};
	}
	return { isValid: true };
}

export function validateFileSize(
	sizeBytes: number,
	maxSizeMB: number,
): ImageValidationResult {
	const maxSizeBytes = maxSizeMB * 1024 * 1024;
	if (sizeBytes > maxSizeBytes) {
		return {
			isValid: false,
			error: `Image too large. Maximum size: ${maxSizeMB}MB`,
		};
	}
	if (sizeBytes === 0) {
		return {
			isValid: false,
			error: 'Image file is empty',
		};
	}
	return { isValid: true };
}

export function getExtensionFromMimetype(mimetype: string): string {
	const mimetypeMap: Record<string, string> = {
		'image/jpeg': 'jpg',
	};
	return mimetypeMap[mimetype] || 'jpg';
}

export function validateImageBuffer(buffer: Buffer): ImageValidationResult {
	const jpegSignature = [0xff, 0xd8, 0xff];

	if (buffer.length < jpegSignature.length) {
		return {
			isValid: false,
			error: 'Image file is corrupt or invalid format',
		};
	}

	const isValidJpeg = jpegSignature.every(
		(byte, index) => buffer[index] === byte,
	);

	if (!isValidJpeg) {
		return {
			isValid: false,
			error: 'Image file is corrupt or not a valid JPEG',
		};
	}

	return { isValid: true };
}
