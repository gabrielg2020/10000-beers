export interface BeerImageData {
  data: string; // base64 encoded image
  mimetype: string;
  filename?: string;
}

export interface BeerSubmissionRequest {
  whatsappId: string;
  displayName: string;
  media: BeerImageData;
  submittedAt: Date;
  messageId: string;
}

export interface BeerSubmissionResult {
  success: boolean;
  beerId?: string;
  beerNumber?: number;
  message: string;
  error?: string;
}

export interface UserInfo {
  id: string;
  whatsappId: string;
  displayName: string;
  isNewUser: boolean;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingBeerId?: string;
  submittedAt?: Date;
}

export class BeerSubmissionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly userMessage: string,
  ) {
    super(message);
    this.name = 'BeerSubmissionError';
  }
}
