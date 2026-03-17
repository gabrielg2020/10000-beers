import { MessageMedia } from "whatsapp-web.js";
import { ImageDownloadResult, ImageStorageResult, ImageValidationResult } from "../types/image";
import { deleteImageFile, ensureDirectoryExists, generateImageFilename, writeImageFile } from "../utils/fileSystem";
import { getExtentionFromMimetype, validateFileSize, validateImageBuffer, validateMimetype } from "../utils/imageValidation";
import { logger } from "../utils/logger";
import path from "node:path";
import crypto from "node:crypto";

export class ImageServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'ImageServiceError';
  }
}

export class ImageService {
  private readonly storagePath: string;
  private readonly maxSizeMB: number;

  constructor() {
    this.storagePath = process.env.IMAGE_STORAGE_PATH || '/data/images';
    this.maxSizeMB = Number.parseInt(process.env.MAX_IMAGE_SIZE_MB || '10', 10);
  }

  async initialise(): Promise<void> {
    await ensureDirectoryExists(this.storagePath);
    logger.info(
      { storagePath: this.storagePath, maxSizeMB: this.maxSizeMB },
      'Image service initialised',
    );
  }

  async downloadFromWhatsApp(
    media: MessageMedia,
  ): Promise<ImageDownloadResult> {
    try {
      const buffer = Buffer.from(media.data, 'base64');

      return {
        buffer,
        mimetype: media.mimetype,
        filename: media.filename || 'image',
      };
    } catch (error) {
      logger.error({ error }, 'Failed to download image from WhatsApp');
      throw new ImageServiceError(
        'Failed to downlaod image from WhatsApp',
        'DOWNLOAD_FAILED',
      );
    }
  }

  validateImage(
    buffer: Buffer,
    mimetype: string,
  ): ImageValidationResult {
    // Validate mimetype
    const mimetypeValidation = validateMimetype(mimetype);
    if (!mimetypeValidation.isValid) {
      return mimetypeValidation;
    }

    // Validate file size
    const sizeValidation = validateFileSize(buffer.length, this.maxSizeMB);
    if (!sizeValidation.isValid) {
      return sizeValidation;
    }

    // Validate buffer integrity
    const bufferValidation = validateImageBuffer(buffer);
    if (!bufferValidation.isValid) {
      return bufferValidation;
    }

    return { isValid: true };
  }

  calculateHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  async storeImage(
    buffer: Buffer,
    mimetype: string,
    userId: string,
  ): Promise<ImageStorageResult> {
    const extension = getExtentionFromMimetype(mimetype);
    const filename = generateImageFilename(userId, extension);
    const fullPath = path.join(this.storagePath, filename);

    await writeImageFile(fullPath, buffer);

    const imageHash = this.calculateHash(buffer);

    logger.info(
      { filename, path: fullPath, hash: imageHash },
      'Image stored successfully',
    );

    return {
      imagePath: fullPath,
      imageHash,
      sizeBytes: buffer.length
    }
  }

  async processImage(
    media: MessageMedia,
    userId: string,
  ): Promise<ImageStorageResult> {
    // Step 1. Download from WhatsApp
    const downloadResult = await this.downloadFromWhatsApp(media);
    logger.debug(
      {
        mimetype: downloadResult.mimetype,
        size: downloadResult.buffer.length,
      },
      'Image downloaded',
    );

    // Step 2. Validate image
    const validationResult = this.validateImage(
      downloadResult.buffer,
      downloadResult.mimetype
    );
    if (!validationResult.isValid) {
      throw new ImageServiceError(
        validationResult.error || 'Image validation failed',
        'VALIDATION_FAILED',
      );
    }

    // Step 3. Store image
    const storageResult = await this.storeImage(
      downloadResult.buffer,
      downloadResult.mimetype,
      userId
    );

    return storageResult;
  }

  async deleteImage(imagePath: string): Promise<void> {
    await deleteImageFile(imagePath);
  }
}

export const imageService = new ImageService();
