// src/tavily/tavily.service.ts

import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { tavily } from '@tavily/core';

import { TAVILY_API_KEY_ENV, TAVILY_BASE_OPTIONS } from './tavily.constants';

import {
  TavilySearchOptions,
  TavilySearchResult,
  TavilySearchSource,
} from './tavily.interfaces';

@Injectable()
export class TavilyService {
  private readonly logger = new Logger(TavilyService.name);

  private readonly client: ReturnType<typeof tavily>;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>(TAVILY_API_KEY_ENV);

    if (!apiKey) {
      throw new Error(`${TAVILY_API_KEY_ENV} is missing`);
    }

    this.client = tavily({
      apiKey,
    });

    this.logger.log('Tavily initialized');
  }

  // ==========================================================
  // SEARCH
  // ==========================================================

  async search(
    query: string,
    options: TavilySearchOptions = {},
  ): Promise<TavilySearchResult> {
    const normalizedQuery = query?.trim();

    if (!normalizedQuery) {
      throw new BadRequestException('Tavily search query is required');
    }

    try {
      const response = await this.client.search(normalizedQuery, {
        searchDepth: options.searchDepth ?? TAVILY_BASE_OPTIONS.searchDepth,

        topic: options.topic ?? TAVILY_BASE_OPTIONS.topic,

        maxResults: options.maxResults ?? TAVILY_BASE_OPTIONS.maxResults,

        timeRange: options.timeRange,

        startDate: options.startDate,

        endDate: options.endDate,

        includeDomains: options.includeDomains,

        excludeDomains: options.excludeDomains,

        includeAnswer:
          options.includeAnswer ?? TAVILY_BASE_OPTIONS.includeAnswer,

        includeRawContent:
          options.includeRawContent ?? TAVILY_BASE_OPTIONS.includeRawContent,

        includeImages:
          options.includeImages ?? TAVILY_BASE_OPTIONS.includeImages,

        includeImageDescriptions:
          options.includeImageDescriptions ??
          TAVILY_BASE_OPTIONS.includeImageDescriptions,

        includeUsage: true,
      });

      const data = response as any;

      return {
        query: normalizedQuery,

        answer: typeof data.answer === 'string' ? data.answer.trim() : null,

        results: this.normalizeResults(data.results),

        images: this.normalizeImages(data.images),

        responseTime:
          typeof data.responseTime === 'number' ? data.responseTime : undefined,

        usage: data.usage
          ? {
              credits:
                typeof data.usage.credits === 'number'
                  ? data.usage.credits
                  : undefined,
            }
          : undefined,
      };
    } catch (error) {
      this.handleError(error, normalizedQuery);
    }
  }

  // ==========================================================
  // NEWS SEARCH
  // ==========================================================

  async searchNews(
    query: string,
    options: Omit<TavilySearchOptions, 'topic'> = {},
  ): Promise<TavilySearchResult> {
    return this.search(query, {
      ...options,
      topic: 'news',
    });
  }

  // ==========================================================
  // CURRENT NEWS
  // ==========================================================

  async searchCurrentNews(
    query: string,
    maxResults = 8,
  ): Promise<TavilySearchResult> {
    return this.searchNews(query, {
      searchDepth: 'basic',
      maxResults,
      timeRange: 'day',
      includeImages: true,
      includeImageDescriptions: false,
      includeRawContent: false,
      includeAnswer: false,
    });
  }

  // ==========================================================
  // NORMALIZE RESULTS
  // ==========================================================

  private normalizeResults(results: unknown): TavilySearchSource[] {
    if (!Array.isArray(results)) {
      return [];
    }

    return results
      .filter(
        (result) =>
          result &&
          typeof result.title === 'string' &&
          typeof result.url === 'string',
      )
      .map((result: any) => ({
        title: result.title.trim(),

        url: result.url.trim(),

        content:
          typeof result.content === 'string'
            ? result.content.trim()
            : undefined,

        score: typeof result.score === 'number' ? result.score : undefined,

        rawContent:
          typeof result.rawContent === 'string' ? result.rawContent : null,

        favicon:
          typeof result.favicon === 'string' ? result.favicon : undefined,

        publishedDate:
          typeof result.publishedDate === 'string'
            ? result.publishedDate
            : undefined,
      }))
      .filter(
        (result) => result.title.length > 0 && /^https?:\/\//i.test(result.url),
      );
  }

  // ==========================================================
  // NORMALIZE IMAGES
  // ==========================================================

  private normalizeImages(images: unknown): string[] {
    if (!Array.isArray(images)) {
      return [];
    }

    return images
      .map((image: any) => {
        if (typeof image === 'string') {
          return image.trim();
        }

        if (image && typeof image.url === 'string') {
          return image.url.trim();
        }

        return '';
      })
      .filter((url) => /^https?:\/\//i.test(url));
  }

  // ==========================================================
  // ERRORS
  // ==========================================================

  private handleError(error: unknown, query: string): never {
    const message = error instanceof Error ? error.message : String(error);

    this.logger.error(`Tavily search failed for "${query}": ${message}`);

    const status = (error as any)?.status;

    if (
      status === 401 ||
      message.includes('401') ||
      message.toLowerCase().includes('unauthorized')
    ) {
      throw new ServiceUnavailableException('Tavily authentication failed');
    }

    if (
      status === 429 ||
      message.includes('429') ||
      message.toLowerCase().includes('rate limit')
    ) {
      throw new ServiceUnavailableException('Tavily rate limit exceeded');
    }

    throw new InternalServerErrorException('Tavily search failed');
  }
}
