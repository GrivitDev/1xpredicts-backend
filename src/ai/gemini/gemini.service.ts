import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import {
  GoogleGenAI,
  GenerateContentConfig,
  GenerateContentResponse,
  Part,
} from '@google/genai';

import {
  DEFAULT_GEMINI_MODEL,
  GEMINI_API_KEY_ENV,
  GEMINI_DEFAULT_MAX_OUTPUT_TOKENS,
  GEMINI_DEFAULT_TEMPERATURE,
  GEMINI_DEFAULT_TOP_K,
  GEMINI_DEFAULT_TOP_P,
  GEMINI_GROUNDING_ENV,
  GEMINI_MODEL_ENV,
  GEMINI_PROVIDER,
  GEMINI_SEARCH_TOOL,
} from './gemini.constants';

import {
  GeminiGenerateRequest,
  GeminiMultimodalRequest,
} from './gemini.interfaces';

import {
  GeminiGenerationOptions,
  GeminiResult,
  GeminiSource,
  GeminiUsage,
} from './gemini.types';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);

  private readonly client: GoogleGenAI;

  private readonly model: string;

  private readonly googleSearchEnabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>(GEMINI_API_KEY_ENV);

    if (!apiKey) {
      throw new Error(
        `${GEMINI_API_KEY_ENV} is missing from environment variables`,
      );
    }

    this.model =
      this.configService.get<string>(GEMINI_MODEL_ENV) || DEFAULT_GEMINI_MODEL;

    this.googleSearchEnabled =
      this.configService.get<string>(GEMINI_GROUNDING_ENV) !== 'false';

    this.client = new GoogleGenAI({
      apiKey,
    });

    this.logger.log(`Gemini initialized: ${this.model}`);
  }

  // ============================================================
  // MODEL
  // ============================================================

  getModel(): string {
    return this.model;
  }

  // ============================================================
  // TEXT GENERATION
  // ============================================================

  async generate(
    request: GeminiGenerateRequest,
  ): Promise<GeminiResult<string>> {
    if (!request.prompt?.trim()) {
      throw new BadRequestException('Gemini prompt is required');
    }

    const options = request.options || {};

    const config = this.buildGenerationConfig(options);

    try {
      const response = await this.client.models.generateContent({
        model: options.model || this.model,

        contents: request.prompt,

        config,
      });

      const text = response.text?.trim();

      if (!text) {
        throw new Error('Gemini returned an empty response');
      }

      const sources = this.extractSources(response);

      return {
        success: true,

        data: text,

        text,

        model: options.model || this.model,

        usage: this.extractUsage(response),

        sources,

        grounded: sources.length > 0,
      };
    } catch (error) {
      this.handleError(error, request.task || 'general');
    }
  }

  // ============================================================
  // JSON GENERATION
  // ============================================================

  async generateJson<T>(
    request: GeminiGenerateRequest,
  ): Promise<GeminiResult<T>> {
    if (!request.prompt?.trim()) {
      throw new BadRequestException('Gemini prompt is required');
    }

    const options = request.options || {};

    const useGoogleSearch = Boolean(
      options.useGoogleSearch && this.googleSearchEnabled,
    );

    const config = this.buildGenerationConfig({
      ...options,

      // Gemini 2.5 + Google Search:
      // request text and parse JSON ourselves.
      responseFormat: useGoogleSearch ? 'text' : 'json',
    });

    try {
      const response = await this.client.models.generateContent({
        model: options.model || this.model,

        contents: request.prompt,

        config,
      });

      const text = response.text?.trim();

      if (!text) {
        throw new Error('Gemini returned an empty JSON response');
      }

      const parsed = this.parseJson<T>(text);

      const sources = this.extractSources(response);

      return {
        success: true,

        data: parsed,

        text,

        model: options.model || this.model,

        usage: this.extractUsage(response),

        sources,

        grounded: sources.length > 0,
      };
    } catch (error) {
      this.handleError(error, request.task || 'general');
    }
  }

  // ============================================================
  // MULTIMODAL
  // ============================================================

  async generateMultimodal(
    request: GeminiMultimodalRequest,
  ): Promise<GeminiResult<string>> {
    if (!request.prompt?.trim()) {
      throw new BadRequestException('Gemini prompt is required');
    }

    const options = request.options || {};

    const config = this.buildGenerationConfig(options);

    const parts: Part[] = [
      {
        text: request.prompt,
      },
    ];

    for (const image of request.images || []) {
      parts.push({
        inlineData: {
          mimeType: image.mimeType,

          data: image.base64,
        },
      });
    }

    try {
      const response = await this.client.models.generateContent({
        model: options.model || this.model,

        contents: [
          {
            role: 'user',

            parts,
          },
        ],

        config,
      });

      const text = response.text?.trim();

      if (!text) {
        throw new Error('Gemini returned an empty response');
      }

      const sources = this.extractSources(response);

      return {
        success: true,

        data: text,

        text,

        model: options.model || this.model,

        usage: this.extractUsage(response),

        sources,

        grounded: sources.length > 0,
      };
    } catch (error) {
      this.handleError(error, request.task || 'general');
    }
  }

  // ============================================================
  // CONFIG
  // ============================================================

  private buildGenerationConfig(
    options: GeminiGenerationOptions,
  ): GenerateContentConfig {
    const config: GenerateContentConfig = {
      temperature: options.temperature ?? GEMINI_DEFAULT_TEMPERATURE,

      topP: options.topP ?? GEMINI_DEFAULT_TOP_P,

      topK: options.topK ?? GEMINI_DEFAULT_TOP_K,

      maxOutputTokens:
        options.maxOutputTokens ?? GEMINI_DEFAULT_MAX_OUTPUT_TOKENS,
    };

    if (options.responseFormat === 'json') {
      config.responseMimeType = 'application/json';
    }

    if (options.systemInstruction) {
      config.systemInstruction = options.systemInstruction;
    }

    if (options.useGoogleSearch && this.googleSearchEnabled) {
      config.tools = [GEMINI_SEARCH_TOOL];
    }

    return config;
  }

  // ============================================================
  // JSON PARSER
  // ============================================================

  private parseJson<T>(text: string): T {
    try {
      return JSON.parse(text) as T;
    } catch {
      const cleaned = this.extractJsonBlock(text);

      try {
        return JSON.parse(cleaned) as T;
      } catch {
        throw new Error('Gemini returned invalid JSON');
      }
    }
  }

  // ============================================================
  // JSON BLOCK
  // ============================================================

  private extractJsonBlock(text: string): string {
    const objectStart = text.indexOf('{');

    const objectEnd = text.lastIndexOf('}');

    if (objectStart >= 0 && objectEnd > objectStart) {
      return text.slice(objectStart, objectEnd + 1);
    }

    const arrayStart = text.indexOf('[');

    const arrayEnd = text.lastIndexOf(']');

    if (arrayStart >= 0 && arrayEnd > arrayStart) {
      return text.slice(arrayStart, arrayEnd + 1);
    }

    return text;
  }

  // ============================================================
  // USAGE
  // ============================================================

  private extractUsage(
    response: GenerateContentResponse,
  ): GeminiUsage | undefined {
    const usage = response.usageMetadata;

    if (!usage) {
      return undefined;
    }

    return {
      promptTokenCount: usage.promptTokenCount,

      candidatesTokenCount: usage.candidatesTokenCount,

      totalTokenCount: usage.totalTokenCount,
    };
  }

  // ============================================================
  // SOURCES
  // ============================================================

  private extractSources(response: GenerateContentResponse): GeminiSource[] {
    const candidate = (response as any)?.candidates?.[0];

    const groundingMetadata = candidate?.groundingMetadata;

    if (!groundingMetadata) {
      return [];
    }

    const chunks = Array.isArray(groundingMetadata.groundingChunks)
      ? groundingMetadata.groundingChunks
      : [];

    const sources: GeminiSource[] = [];

    for (const chunk of chunks) {
      const web = chunk?.web;

      if (typeof web?.uri !== 'string') {
        continue;
      }

      sources.push({
        title: typeof web.title === 'string' ? web.title : web.uri,

        url: web.uri,
      });
    }

    return this.uniqueSources(sources);
  }

  // ============================================================
  // UNIQUE SOURCES
  // ============================================================

  private uniqueSources(sources: GeminiSource[]): GeminiSource[] {
    const seen = new Set<string>();

    return sources.filter((source) => {
      if (seen.has(source.url)) {
        return false;
      }

      seen.add(source.url);

      return true;
    });
  }

  // ============================================================
  // ERROR HANDLING
  // ============================================================

  private handleError(error: unknown, task: string): never {
    this.logger.error(
      `Gemini ${task} failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );

    throw new InternalServerErrorException('Gemini request failed');
  }
}
