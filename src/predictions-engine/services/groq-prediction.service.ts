import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import axios, { AxiosError } from 'axios';

import { GroqChatCompletionResponse } from '../interfaces/ai-provider-response.interface';

import {
  AiPredictionRequest,
  AiPredictionResponse,
} from '../interfaces/ai-prediction.interface';

import { parseAiPredictionResponse } from '../utils/ai-response-parser.util';

import { AiPredictionPromptService } from './ai-prediction-prompt.service';

@Injectable()
export class GroqPredictionService {
  private readonly logger = new Logger(GroqPredictionService.name);

  private readonly baseUrl = 'https://api.groq.com/openai/v1/chat/completions';

  private readonly defaultModel = 'openai/gpt-oss-120b';

  constructor(
    private readonly configService: ConfigService,
    private readonly promptService: AiPredictionPromptService,
  ) {}

  async generate(request: AiPredictionRequest): Promise<AiPredictionResponse> {
    const apiKey = this.configService.get<string>('GROQ_API_KEY')?.trim();

    const configuredModel = this.configService
      .get<string>('GROQ_MODEL')
      ?.trim();

    if (!apiKey) {
      throw new Error('GROQ_API_KEY is missing');
    }

    const model = configuredModel || this.defaultModel;

    const prompt = this.promptService.build(request);

    try {
      const response = await axios.post<GroqChatCompletionResponse>(
        this.baseUrl,
        {
          model,

          temperature: 0.1,

          messages: [
            {
              role: 'system',
              content:
                'You are a conservative football prediction analyst. Return valid JSON only.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],

          response_format: {
            type: 'json_object',
          },
        },
        {
          timeout: 30_000,

          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const text = response.data?.choices?.[0]?.message?.content;

      if (!text) {
        throw new Error('Groq returned an empty prediction response');
      }

      return parseAiPredictionResponse(text);
    } catch (error) {
      this.logError(error);

      throw new Error('Groq prediction request failed');
    }
  }

  private logError(error: unknown): void {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      this.logger.error('Groq prediction request failed', {
        status: axiosError.response?.status,
        data: axiosError.response?.data,
      });

      return;
    }

    this.logger.error('Groq prediction request failed', error);
  }
}
