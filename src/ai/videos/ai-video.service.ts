// src/ai/videos/ai-video.service.ts

import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { GeminiService } from '../gemini/gemini.service';

import { TavilyService } from '../../tavily/tavily.service';

import { CommunityService } from '../../community/community.service';

import { CommunityPostType } from '../../community/enums/community-post-type.enum';

import { CommunityMediaType } from '../../community/enums/community-media-type.enum';

import { AiVideoPostResult } from './ai-video.interfaces';

@Injectable()
export class AiVideoService {
  private readonly logger = new Logger(AiVideoService.name);

  constructor(
    private readonly geminiService: GeminiService,

    private readonly tavilyService: TavilyService,

    private readonly communityService: CommunityService,

    private readonly configService: ConfigService,
  ) {}

  // ==========================================================
  // FIND AND ANALYZE VIDEO
  // ==========================================================

  async generateVideoPost(): Promise<AiVideoPostResult> {
    const search = await this.tavilyService.search(
      `
latest football viral video
important football moment
football analysis press conference
recent football video YouTube
        `.trim(),
      {
        searchDepth: 'basic',

        maxResults: 10,

        timeRange: 'day',

        includeImages: false,

        includeDomains: ['youtube.com', 'youtu.be'],
      },
    );

    const video = this.findYoutubeVideo(search.results);

    if (!video) {
      throw new BadRequestException(
        'Tavily returned no suitable YouTube football video',
      );
    }

    const result = await this.geminiService.generateJson<AiVideoPostResult>({
      task: 'general',

      prompt: this.buildPrompt(video),

      options: {
        maxOutputTokens: 1500,

        systemInstruction: this.getSystemInstruction(),
      },
    });

    if (!result.data) {
      throw new BadRequestException('Gemini returned no video post');
    }

    return this.validateResult(result.data, video.url);
  }

  // ==========================================================
  // FIND, ANALYZE AND PUBLISH
  // ==========================================================

  async generateAndPublish(): Promise<{
    post: unknown;

    video: AiVideoPostResult;
  }> {
    const generated = await this.generateVideoPost();

    const userId = this.configService.get<string>('AI_COMMUNITY_USER_ID');

    if (!userId) {
      throw new BadRequestException('AI_COMMUNITY_USER_ID is missing');
    }

    const username =
      this.configService.get<string>('AI_COMMUNITY_USERNAME') || '2xpredict_ai';

    const fullName =
      this.configService.get<string>('AI_COMMUNITY_FULL_NAME') ||
      '2xPredict AI';

    const post = await this.communityService.createAiPost({
      userId,

      username,

      fullName,

      type: CommunityPostType.MEDIA,

      title: generated.title,

      message: generated.message,

      category: generated.category,

      media: {
        type: CommunityMediaType.VIDEO,

        url: generated.video.url,

        publicId: generated.video.videoId,
      },

      sources: [
        {
          title: generated.source.title,

          url: generated.source.url,
        },
      ],
    });

    this.logger.log(`AI football video post published: ${post._id}`);

    return {
      post,

      video: generated,
    };
  }

  // ==========================================================
  // PROMPT
  // ==========================================================

  private buildPrompt(video: {
    title: string;

    url: string;

    content?: string;

    publishedDate?: string;
  }): string {
    const videoId = this.extractYoutubeVideoId(video.url);

    if (!videoId) {
      throw new BadRequestException('Invalid YouTube video result');
    }

    return `
Create a short football community comment about this
verified YouTube video.

============================================================
VIDEO
============================================================

Title:
${video.title}

URL:
${video.url}

Published:
${video.publishedDate || 'Unknown'}

Available description:
${video.content || 'No description supplied.'}

============================================================
RULES
============================================================

The video URL has already been discovered by Tavily.

Do not change the URL.

Do not invent another video.

Do not pretend to have watched the video if the supplied
information does not establish what happened.

Write a short analytical football comment.

Maximum:
700 characters.

Encourage discussion.

Do not simply repeat the video title.

============================================================
OUTPUT
============================================================

Return JSON only:

{
  "title": "${video.title}",
  "message": "string",
  "category": "Football Video",
  "video": {
    "url": "${video.url}",
    "platform": "youtube",
    "videoId": "${videoId}"
  },
  "source": {
    "title": "${video.title}",
    "url": "${video.url}"
  }
}

Return JSON only.
`.trim();
  }

  // ==========================================================
  // SYSTEM
  // ==========================================================

  private getSystemInstruction(): string {
    return `
You are the football video editor for 2xPredict.

The video has already been found by Tavily.

Never invent:

- a video
- a video URL
- a video ID
- a channel
- an event
- information about what happened

Use the supplied video information.

Write short original football commentary.

Return valid JSON only.
`.trim();
  }

  // ==========================================================
  // FIND YOUTUBE VIDEO
  // ==========================================================

  private findYoutubeVideo(results: any[]) {
    if (!Array.isArray(results)) {
      return null;
    }

    for (const result of results) {
      if (typeof result?.url !== 'string') {
        continue;
      }

      if (!this.extractYoutubeVideoId(result.url)) {
        continue;
      }

      return {
        title:
          typeof result.title === 'string'
            ? result.title.trim()
            : 'Football Video',

        url: result.url.trim(),

        content:
          typeof result.content === 'string'
            ? result.content.trim()
            : undefined,

        publishedDate:
          typeof result.publishedDate === 'string'
            ? result.publishedDate
            : undefined,
      };
    }

    return null;
  }

  // ==========================================================
  // VALIDATE
  // ==========================================================

  private validateResult(
    result: AiVideoPostResult,
    verifiedUrl: string,
  ): AiVideoPostResult {
    if (!result) {
      throw new BadRequestException('Invalid AI video result');
    }

    const title = typeof result.title === 'string' ? result.title.trim() : '';

    const message =
      typeof result.message === 'string' ? result.message.trim() : '';

    const category =
      typeof result.category === 'string'
        ? result.category.trim()
        : 'Football Video';

    if (!title) {
      throw new BadRequestException('AI video title is missing');
    }

    if (!message) {
      throw new BadRequestException('AI video commentary is missing');
    }

    if (title.length > 100) {
      throw new BadRequestException('AI video title is too long');
    }

    if (message.length > 700) {
      throw new BadRequestException('AI video commentary is too long');
    }

    const verifiedVideoId = this.extractYoutubeVideoId(verifiedUrl);

    if (!verifiedVideoId) {
      throw new BadRequestException('Verified YouTube video is invalid');
    }

    return {
      title,

      message,

      category,

      video: {
        url: verifiedUrl,

        platform: 'youtube',

        videoId: verifiedVideoId,
      },

      source: {
        title: result.source?.title?.trim() || title,

        url: verifiedUrl,

        channel: result.source?.channel?.trim() || undefined,
      },
    };
  }

  // ==========================================================
  // YOUTUBE ID
  // ==========================================================

  private extractYoutubeVideoId(url: string): string | null {
    try {
      const parsed = new URL(url);

      const hostname = parsed.hostname.toLowerCase();

      if (hostname === 'youtu.be' || hostname === 'www.youtu.be') {
        return parsed.pathname.replace(/^\/+/, '').split('/')[0] || null;
      }

      if (hostname === 'youtube.com' || hostname === 'www.youtube.com') {
        const id = parsed.searchParams.get('v');

        if (id) {
          return id;
        }

        const parts = parsed.pathname.split('/').filter(Boolean);

        const shortsIndex = parts.indexOf('shorts');

        if (shortsIndex !== -1 && parts[shortsIndex + 1]) {
          return parts[shortsIndex + 1] || null;
        }
      }

      return null;
    } catch {
      return null;
    }
  }
}
