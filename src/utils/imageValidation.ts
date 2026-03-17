import type { ImageValidationResult } from '../types/image';

const ALLOWED_MIMETYPES = [
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/gif',
];

const ALLOWED_EXTENSIONS = ['jpeg', 'jpg', 'png', 'webp', 'gif'];

export function validateMimetype(mimetype: string): ImageValidationResult {
	if (!ALLOWED_MIMETYPES.includes(mimetype)) {
		return {
			isValid: false,
			error: `Invalid image format. Allowed: JPEG, PNG, WebP, GIF`,
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
		'image/png': 'png',
		'image/webp': 'webp',
		'image/gif': 'gif',
	};
	return mimetypeMap[mimetype] || 'jpg';
}

export function validateImageBuffer(buffer: Buffer): ImageValidationResult {
	// Check for common image file signatures
	const signatures = {
		jpeg: [0xff, 0xd8, 0xff],
		png: [0x89, 0x50, 0x4e, 0x47],
		webp: [0x52, 0x49, 0x46, 0x46], // RIFF header
		gif: [0x47, 0x49, 0x46],
	};

	let isValidFormat = false;
	for (const [_, sig] of Object.entries(signatures)) {
		if (buffer.length >= sig.length) {
			const matches = sig.every((byte, index) => buffer[index] === byte);
			if (matches) {
				isValidFormat = true;
				break;
			}
		}
	}

	if (!isValidFormat) {
		return {
			isValid: false,
			error: 'Image file is corrupt or invalid format',
		};
	}

	return { isValid: true };
}
