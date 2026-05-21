import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config";
import { logger } from "../utils/logger";
import { readFile } from "node:fs/promises";
import { BeerClassificationResult, GeminiClassificationResponse } from "../types/ai";

export class AiService {
  private readonly enabled: boolean;
  private readonly confidenceThreshold: number;
  private readonly geminiModel: string;
  private readonly genAI: GoogleGenerativeAI | null;
  private systemInstruction: string | null;

  constructor() {
    this.enabled = config.ai.enabled;
    this.confidenceThreshold = config.ai.confidenceThreshold;
    this.geminiModel = config.ai.geminiModel;

    if (this.enabled) {
      this.genAI = new GoogleGenerativeAI(config.ai.geminiApiKey);
      this.systemInstruction = null; // Gets loaded async
    } else {
      this.genAI = null
      this.systemInstruction = null;
    }
  }

  async initialise(): Promise<void> {
    if (!this.enabled) {
      logger.info('AI service disabled');
      return;
    }

    try {
      const instructionPath = 'src/system_instruction.md';
      const instruction = await readFile(instructionPath, 'utf8');
      this.systemInstruction = instruction;

      logger.info(
        { threshold: this.confidenceThreshold },
        'AI service initialised',
      );
    } catch (error) {
      logger.error({ error }, 'Failed to load system instruction');
      throw error;
    }
  }

  async classifyBeer(imagePath: string): Promise<BeerClassificationResult> {
    // If AI disabled, auto-accept
    if (!this.enabled) {
      logger.debug('AI disabled, auto-accepting beer');
      return {
        isValid: true,
        beerType: null,
        confidence: 1.0,
      };
    }

    try {
      const imageBuffer = await readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');

      const model = this.genAI!.getGenerativeModel({
        model: this.geminiModel,
        systemInstruction: this.systemInstruction!,
      });

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Image,
          },
        },
      ]);

      const response = result.response;
      const text = response.text();

      logger.debug({ response: text }, 'Raw Gemini response');

      const classification = this.parseGeminiResponse(text);

      return this.validateClassification(classification);
    } catch (error) {
      logger.error({ error, imagePath }, 'AI classification failed, rejecting submission');
      return {
        isValid: false,
        beerType: null,
        confidence: 0,
        error: 'AI service unavailable, please try again',
      };
    }
  }

  private parseGeminiResponse(text: string): GeminiClassificationResponse {
    try {
      // Remove markdown code blocks if present
      const cleaned = text
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const parsed = JSON.parse(cleaned);

      return {
        beer_detected: parsed.beer_detected,
        type: parsed.type,
        confidence: parsed.confidence,
      };
    } catch (error) {
      logger.error({ error, text }, 'Failed to parse Gemini response');
      throw new Error('Invalid Gemini response format');
    }
  }

  private validateClassification(
    classification: GeminiClassificationResponse,
  ): BeerClassificationResult {
    const { beer_detected, type, confidence } = classification;

    // Beer not detected
    if (!beer_detected) {
      logger.debug('Beer not detected by AI');
      return {
        isValid: false,
        beerType: null,
        confidence,
        error: 'No beer detected in image',
      };
    }

    // Confidence too low
    if (confidence < this.confidenceThreshold) {
      logger.debug(
        { confidence, threshold: this.confidenceThreshold },
        'Confidence below threshold',
      );
      return {
        isValid: false,
        beerType: type,
        confidence,
        error: 'Classification confidence too low',
      }
    }

    logger.info({ beer: type, confidence }, 'Beer classified successfully');
    return {
      isValid: true,
      beerType: type,
      confidence,
    };
  }
}

export const aiService = new AiService();
