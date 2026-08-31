// src/ai/videos/ai-video.service.ts

import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { GeminiService } from '../gemini/gemini.service';

import { CommunityService } from '../../community/community.service';

import { CommunityPostType } from '../../community/enums/community-post-type.enum';

import { CommunityMediaType } from '../../community/enums/community-media-type.enum';

import { AiVideoPostResult } from './ai-video.interfaces';

@Injectable()
export class AiVideoService {
  private readonly logger = new Logger(AiVideoService.name);

  constructor(
    private readonly geminiService: GeminiService,

    private readonly communityService: CommunityService,

    private readonly configService: ConfigService,
  ) {}

  // ==========================================================
  // FIND AND ANALYZE VIDEO
  // ==========================================================

  async generateVideoPost(): Promise<AiVideoPostResult> {
    const result = await this.geminiService.generateJson<AiVideoPostResult>({
      task: 'general',

      prompt: this.buildPrompt(),

      options: {
        temperature: 0.5,

        maxOutputTokens: 2500,

        useGoogleSearch: true,

        systemInstruction: this.getSystemInstruction(),
      },
    });

    if (!result.data) {
      throw new BadRequestException('Gemini returned no video post');
    }

    return this.validateResult(result.data);
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

        // We are not uploading the video to Cloudinary.
        // The YouTube ID is stored here as the media identifier.
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

  private buildPrompt(): string {
    return `
Find one relevant and interesting football video that is
suitable for a 2xPredict community video post.

The video should preferably be recent.

Prioritize:

- major football moments
- important match moments
- tactical moments
- great goals
- controversial football incidents
- major team news shown in video
- important press conferences
- important football analysis
- highly relevant football stories

The video must be publicly accessible on YouTube.

Do not select:

- pirated uploads
- obviously stolen full-match broadcasts
- illegal streams
- harmful content
- unrelated videos
- old videos unless the event is currently highly relevant

============================================================
RESEARCH
============================================================

Use Google Search to find the video.

Verify the video's title, relevance and public URL.

The video URL must be a real public YouTube URL.

============================================================
COMMENTARY
============================================================

Write a short football comment about the video.

The comment should:

- be interesting
- be analytical
- be concise
- use short sentences
- avoid pretending opinions are facts
- encourage discussion
- not simply repeat the video title

Maximum comment length:
700 characters.

============================================================
OUTPUT
============================================================

Return JSON only:

{
  "title": "string",
  "message": "string",
  "category": "Football Video",
  "video": {
    "url": "https://www.youtube.com/watch?v=VIDEO_ID",
    "platform": "youtube",
    "videoId": "VIDEO_ID"
  },
  "source": {
    "title": "string",
    "url": "https://www.youtube.com/watch?v=VIDEO_ID",
    "channel": "string"
  }
}

The video platform must be:

"youtube"

The URL must be a public YouTube URL.

Return JSON only.
`.trim();
  }

  // ==========================================================
  // SYSTEM INSTRUCTION
  // ==========================================================

  private getSystemInstruction(): string {
    return `
You are the football video editor for 2xPredict.

Find relevant public football videos.

Prefer current and important football moments.

Never invent a video.

Never invent its title.

Never invent its channel.

Never invent information about what happened in the video.

The supplied YouTube video must actually exist as a public URL.

Write short original football commentary.

Do not download or rehost the video.

Return valid JSON only.
`.trim();
  }

  // ==========================================================
  // VALIDATE
  // ==========================================================

  private validateResult(result: AiVideoPostResult): AiVideoPostResult {
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

    if (result.video?.platform !== 'youtube') {
      throw new BadRequestException('Only YouTube videos are supported');
    }

    const videoUrl = result.video?.url?.trim();

    if (!videoUrl || !this.isYoutubeUrl(videoUrl)) {
      throw new BadRequestException('Invalid YouTube video URL');
    }

    const videoId = this.extractYoutubeVideoId(videoUrl);

    if (!videoId) {
      throw new BadRequestException('Unable to extract YouTube video ID');
    }

    const sourceUrl = result.source?.url?.trim();

    if (!sourceUrl || !this.isYoutubeUrl(sourceUrl)) {
      throw new BadRequestException('Invalid video source URL');
    }

    return {
      title,

      message,

      category,

      video: {
        url: videoUrl,

        platform: 'youtube',

        videoId,
      },

      source: {
        title: result.source.title?.trim() || title,

        url: sourceUrl,

        channel: result.source.channel?.trim() || undefined,
      },
    };
  }

  // ==========================================================
  // YOUTUBE URL CHECK
  // ==========================================================

  private isYoutubeUrl(url: string): boolean {
    try {
      const parsed = new URL(url);

      return (
        parsed.hostname === 'youtube.com' ||
        parsed.hostname === 'www.youtube.com' ||
        parsed.hostname === 'youtu.be' ||
        parsed.hostname === 'www.youtu.be'
      );
    } catch {
      return false;
    }
  }

  // ==========================================================
  // YOUTUBE ID
  // ==========================================================

  private extractYoutubeVideoId(url: string): string | null {
    try {
      const parsed = new URL(url);

      if (
        parsed.hostname === 'youtu.be' ||
        parsed.hostname === 'www.youtu.be'
      ) {
        return parsed.pathname.replace(/^\/+/, '').split('/')[0] || null;
      }

      const id = parsed.searchParams.get('v');

      if (id) {
        return id;
      }

      const parts = parsed.pathname.split('/');

      const index = parts.indexOf('shorts');

      if (index !== -1 && parts[index + 1]) {
        return parts[index + 1];
      }

      return null;
    } catch {
      return null;
    }
  }
}
