import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import axios, { AxiosError } from 'axios';

import { GeminiCandidateResponse } from '../interfaces/ai-provider-response.interface';

import {
  AiPredictionRequest,
  AiPredictionResponse,
} from '../interfaces/ai-prediction.interface';

import { parseAiPredictionResponse } from '../utils/ai-response-parser.util';

import { AiPredictionPromptService } from './ai-prediction-prompt.service';

@Injectable()
export class GeminiPredictionService {
  private readonly logger = new Logger(GeminiPredictionService.name);

  private readonly baseUrl =
    'https://generativelanguage.googleapis.com/v1beta/models';

  constructor(
    private readonly configService: ConfigService,
    private readonly promptService: AiPredictionPromptService,
  ) {}

  async generate(request: AiPredictionRequest): Promise<AiPredictionResponse> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY')?.trim();

    const model = this.configService.get<string>('GEMINI_MODEL')?.trim();

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is missing');
    }

    if (!model) {
      throw new Error('GEMINI_MODEL is missing');
    }

    const prompt = this.promptService.build(request);

    try {
      const response = await axios.post<GeminiCandidateResponse>(
        `${this.baseUrl}/${encodeURIComponent(model)}:generateContent`,
        {
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],

          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        },
        {
          timeout: 30_000,

          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
        },
      );

      const text = response.data?.candidates?.[0]?.content?.parts?.find(
        (part) => typeof part.text === 'string',
      )?.text;

      if (!text) {
        throw new Error('Gemini returned an empty prediction response');
      }

      return parseAiPredictionResponse(text);
    } catch (error) {
      this.logError(error);

      throw new Error('Gemini prediction request failed');
    }
  }

  private logError(error: unknown): void {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      this.logger.error('Gemini prediction request failed', {
        status: axiosError.response?.status,
        data: axiosError.response?.data,
      });

      return;
    }

    this.logger.error('Gemini prediction request failed', error);
  }
}
