import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  OnModuleInit,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import axios, { AxiosError, AxiosInstance } from 'axios';

import {
  YouTubeSearchOptions,
  YouTubeSearchResponse,
  YouTubeVideoItem,
  YouTubeVideoResult,
  YouTubeVideosResponse,
} from './youtube.interfaces';

import { YOUTUBE_CONFIG } from '../config/youtube.config';

import { SportsProviderRateLimitService } from '../services/sports-provider-rate-limit.service';

@Injectable()
export class YoutubeService implements OnModuleInit {
  private readonly baseUrl = YOUTUBE_CONFIG.apiBaseUrl;

  private http!: AxiosInstance;

  private apiKey!: string;

  constructor(
    private readonly configService: ConfigService,

    private readonly providerRateLimitService: SportsProviderRateLimitService,
  ) {}

  onModuleInit(): void {
    const apiKey = this.configService.get<string>('YOUTUBE_DATA_API_KEY');

    if (!apiKey) {
      throw new Error('YOUTUBE_DATA_API_KEY is missing');
    }

    this.apiKey = apiKey;

    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: 15_000,
      headers: {
        Accept: 'application/json',
      },
    });
  }

  // ============================================================
  // SEARCH
  // ============================================================

  async searchVideos(
    options: YouTubeSearchOptions,
  ): Promise<YouTubeVideoResult[]> {
    if (!options.query?.trim()) {
      throw new BadRequestException('YouTube search query is required');
    }

    const params: Record<string, string | number | boolean> = {
      key: this.apiKey,
      part: 'snippet',
      q: options.query.trim(),
      type: YOUTUBE_CONFIG.searchType,
      maxResults: options.maxResults ?? 5,
    };

    if (options.channelId) {
      params.channelId = options.channelId;
    }

    if (options.publishedAfter) {
      params.publishedAfter = options.publishedAfter;
    }

    if (options.publishedBefore) {
      params.publishedBefore = options.publishedBefore;
    }

    if (YOUTUBE_CONFIG.requireEmbeddable) {
      params.videoEmbeddable = 'true';
      params.videoSyndicated = 'true';
    }

    const response = await this.request<YouTubeSearchResponse>(
      '/search',
      params,
    );

    return (response.items ?? [])
      .filter((item) => item.id?.videoId)
      .map((item) => ({
        videoId: item.id!.videoId!,
        channelId: item.snippet?.channelId,
        channelTitle: item.snippet?.channelTitle,
        title: item.snippet?.title ?? '',
        description: item.snippet?.description,
        publishedAt: item.snippet?.publishedAt
          ? new Date(item.snippet.publishedAt)
          : undefined,
        thumbnailUrl:
          item.snippet?.thumbnails?.high?.url ??
          item.snippet?.thumbnails?.medium?.url ??
          item.snippet?.thumbnails?.default?.url,
        embeddable: true,
      }));
  }

  // ============================================================
  // VIDEO DETAILS
  // ============================================================

  async getVideo(videoId: string): Promise<YouTubeVideoResult | null> {
    if (!videoId?.trim()) {
      throw new BadRequestException('videoId is required');
    }

    const response = await this.request<YouTubeVideosResponse>('/videos', {
      key: this.apiKey,
      part: 'snippet,contentDetails,status',
      id: videoId,
    });

    const video = response.items?.[0];

    if (!video) {
      return null;
    }

    return this.mapVideo(video);
  }

  // ============================================================
  // FIND EMBEDDABLE VIDEO
  // ============================================================

  async findHighlight(
    homeTeam: string,
    awayTeam: string,
    publishedAfter?: Date,
  ): Promise<YouTubeVideoResult | null> {
    if (!homeTeam?.trim() || !awayTeam?.trim()) {
      throw new BadRequestException('Both homeTeam and awayTeam are required');
    }

    const query = `${homeTeam} ${awayTeam} highlights`;

    const candidates = await this.searchVideos({
      query,
      maxResults: 5,
      publishedAfter: publishedAfter?.toISOString(),
    });

    if (candidates.length === 0) {
      return null;
    }

    const verified: YouTubeVideoResult[] = [];

    for (const candidate of candidates) {
      const video = await this.getVideo(candidate.videoId);

      if (!video || !video.embeddable) {
        continue;
      }

      verified.push(video);
    }

    return this.selectBestHighlight(verified, homeTeam, awayTeam) ?? null;
  }

  // ============================================================
  // BEST MATCH
  // ============================================================

  private selectBestHighlight(
    videos: YouTubeVideoResult[],
    homeTeam: string,
    awayTeam: string,
  ): YouTubeVideoResult | null {
    if (videos.length === 0) {
      return null;
    }

    const home = this.normalize(homeTeam);

    const away = this.normalize(awayTeam);

    const scored = videos.map((video) => {
      const title = this.normalize(video.title);

      let score = 0;

      if (title.includes(home)) {
        score += 3;
      }

      if (title.includes(away)) {
        score += 3;
      }

      if (title.includes('highlight')) {
        score += 2;
      }

      if (title.includes('highlights')) {
        score += 2;
      }

      return {
        video,
        score,
      };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored[0].video;
  }

  // ============================================================
  // MAP VIDEO
  // ============================================================

  private mapVideo(video: YouTubeVideoItem): YouTubeVideoResult {
    return {
      videoId: video.id ?? '',

      channelId: video.snippet?.channelId,

      channelTitle: video.snippet?.channelTitle,

      title: video.snippet?.title ?? '',

      description: video.snippet?.description,

      publishedAt: video.snippet?.publishedAt
        ? new Date(video.snippet.publishedAt)
        : undefined,

      thumbnailUrl:
        video.snippet?.thumbnails?.high?.url ??
        video.snippet?.thumbnails?.medium?.url ??
        video.snippet?.thumbnails?.default?.url,

      embeddable: video.status?.embeddable === true,

      duration: video.contentDetails?.duration,
    };
  }

  // ============================================================
  // REQUEST
  // ============================================================

  private async request<T>(
    endpoint: string,
    params: Record<string, string | number | boolean>,
  ): Promise<T> {
    return this.providerRateLimitService.execute('youtube', async () => {
      try {
        const response = await this.http.get<T>(endpoint, {
          params,
        });

        return response.data;
      } catch (error) {
        this.logApiError(error, endpoint);

        throw new InternalServerErrorException(
          `YouTube API request failed: ${endpoint}`,
        );
      }
    });
  }

  // ============================================================
  // NORMALIZE SEARCH TEXT
  // ============================================================

  private normalize(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ============================================================
  // ERROR LOGGING
  // ============================================================

  private logApiError(error: unknown, endpoint: string): void {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      console.error('YouTube API error', {
        endpoint,
        status: axiosError.response?.status,
        data: axiosError.response?.data,
      });

      return;
    }

    console.error('YouTube API error', {
      endpoint,
      error,
    });
  }
}
