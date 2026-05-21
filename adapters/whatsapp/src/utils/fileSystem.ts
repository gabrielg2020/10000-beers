import { promises as fs, writeFile } from 'node:fs';
import path from 'node:path';
import { logger } from './logger';

export class FileSystemError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
  ) {
    super(message);
    this.name = 'FileSystemError';
  }
}

export async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch {
    logger.info({ dirPath }, 'Creating image storage dirctory');
    await fs.mkdir(dirPath, { recursive: true });
  }
}

export async function writeImageFile(
  filePath: string,
  buffer: Buffer
): Promise<void> {
  try {
    await fs.writeFile(filePath, buffer);
    logger.debug({ filePath, size: buffer.length }, 'Image file written');
  } catch (error) {
    logger.error({ error, filePath }, 'Failed to write image file');
    throw new FileSystemError(
      `Failed to write image: ${error instanceof Error ? error.message : 'Unkown error'}`,
      'writeFile',
    );
  }
} 

export async function deleteImageFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
    logger.debug({ filePath }, 'Image file deleted');
  } catch (error) {
    logger.warn({ error, filePath }, 'Failed to delete image file');
  }
}

export function generateImageFilename(
  userId: string,
  extension: string,
): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 9);
  return `${timestamp}-${userId}-${randomSuffix}.${extension}`
}
