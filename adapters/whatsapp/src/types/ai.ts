export type BeerType = 'can' | 'bottle' | 'draught';

export interface GeminiClassificationResponse {
  beer_detected: boolean;
  type: BeerType | null;
  confidence: number;
}

export interface BeerClassificationResult {
  isValid: boolean;
  beerType: BeerType | null;
  confidence: number;
  error?: string;
}

export class AiServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly userMessage?: string,
  ) {
    super(message);
    this.name = 'AiServiceError';
  }
}
