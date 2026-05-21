export interface ImageDownloadResult {
  buffer: Buffer;
  mimetype: string;
  filename: string;
}

export interface ImageValidationResult {
  isValid: boolean;
  error?: string;
}

export interface ImageStorageResult {
  imagePath: string;
  imageHash: string;
  sizeBytes: number;
}

export interface ImageMetadata {
  originalFilename: string;
  mimetype: string;
  sizeBytes: string;
  downloadedAt: Date;
}

export class ImageServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'ImageServiceError';
  }
}

