import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { GeminiService } from '../gemini/gemini.service';

import { AiImageService } from '../images/ai-image.service';

import { CommunityService } from '../../community/community.service';

import { CommunityPostType } from '../../community/enums/community-post-type.enum';

import { CommunityMediaType } from '../../community/enums/community-media-type.enum';

import {
  AiCommunityPostRequest,
  AiCommunityPostResult,
  AiPublishedCommunityPost,
} from './ai-community-post.interfaces';

@Injectable()
export class AiCommunityPostService {
  private readonly logger = new Logger(AiCommunityPostService.name);

  constructor(
    private readonly geminiService: GeminiService,

    private readonly aiImageService: AiImageService,

    private readonly communityService: CommunityService,

    private readonly configService: ConfigService,
  ) {}

  // ==========================================================
  // GENERATE
  // ==========================================================

  async generatePost(
    request: AiCommunityPostRequest = {},
  ): Promise<AiCommunityPostResult> {
    const result = await this.geminiService.generateJson<AiCommunityPostResult>(
      {
        task: 'community_post',

        prompt: this.buildPrompt(request),

        options: {
          temperature: 0.4,

          maxOutputTokens: 3000,

          useGoogleSearch: true,

          systemInstruction: this.systemInstruction(),
        },
      },
    );

    if (!result.data) {
      throw new BadRequestException('Gemini returned no community post');
    }

    const post = this.validateResult(result.data);

    return {
      ...post,

      sources: this.mergeSources(result.sources || [], post.sources),
    };
  }

  // ==========================================================
  // GENERATE + PUBLISH
  // ==========================================================

  async generateAndPublish(
    request: AiCommunityPostRequest = {},
  ): Promise<AiPublishedCommunityPost> {
    const generated = await this.generatePost(request);

    const userId = this.configService.get<string>('AI_COMMUNITY_USER_ID');

    if (!userId) {
      throw new BadRequestException('AI_COMMUNITY_USER_ID is missing');
    }

    const username =
      this.configService.get<string>('AI_COMMUNITY_USERNAME') || '2xpredict_ai';

    const fullName =
      this.configService.get<string>('AI_COMMUNITY_FULL_NAME') ||
      '2xPredict AI';

    const image = await this.aiImageService.generateCommunityImage(
      generated.imagePrompt || generated.title,
    );

    const post = await this.communityService.createAiPost({
      userId,

      username,

      fullName,

      type: CommunityPostType.MEDIA,

      title: generated.title,

      message: generated.message,

      category: generated.category,

      media: {
        type: CommunityMediaType.IMAGE,

        url: image.url,

        publicId: image.publicId,
      },

      sources: generated.sources,
    });

    this.logger.log(`AI community news post published: ${post._id}`);

    return {
      post,

      ai: {
        grounded: generated.sources.length > 0,

        sources: generated.sources,
      },
    };
  }

  // ==========================================================
  // PROMPT
  // ==========================================================

  private buildPrompt(request: AiCommunityPostRequest): string {
    return `
Create one important and current football news post
for 2xPredict.

${
  request.topic
    ? `Preferred topic:

${request.topic}`
    : ''
}

${
  request.category
    ? `Preferred category:

${request.category}`
    : ''
}

============================================================
RESEARCH
============================================================

Use Google Search.

Find a genuinely important current football story.

Prioritize:

- major transfers
- major injury developments
- significant player availability updates
- suspensions
- manager changes
- major club announcements
- important tournament developments
- important league developments
- major upcoming football events
- significant team news
- major player news

Do not choose trivial stories just to create content.

============================================================
FACTUAL STANDARD
============================================================

Verify important claims.

Prefer:

- official club sources
- official competition sources
- UEFA
- FIFA
- national football associations
- established broadcasters
- established sports journalists
- reputable statistics websites

Do not treat speculation as confirmed.

Do not invent quotations.

Do not invent statistics.

============================================================
WRITING
============================================================

Title:
Maximum 100 characters.

Message:
Maximum 1000 characters.

Explain:

1. What happened.
2. Why it matters.

Use concise football journalism.

Do not mention AI.

Do not copy the source article.

============================================================
IMAGE
============================================================

Provide an original image prompt.

Do not reproduce a copyrighted news photograph.

============================================================
OUTPUT
============================================================

Return JSON only:

{
  "type": "media",
  "title": "string",
  "message": "string",
  "category": "Football News",
  "importance": "high",
  "imageNeeded": true,
  "imagePrompt": "string",
  "sources": [
    {
      "title": "string",
      "url": "https://example.com"
    }
  ]
}

At least one source is required.

Return JSON only.
`.trim();
  }

  // ==========================================================
  // SYSTEM
  // ==========================================================

  private systemInstruction(): string {
    return `
You are the football news editor for 2xPredict.

Research current football information with Google Search.

Accuracy is more important than volume.

Never fabricate:

- football news
- injuries
- transfers
- statistics
- lineups
- quotations
- results
- player availability

Use reputable sources.

Cross-check important claims where possible.

Write original concise summaries.

Do not copy articles.

Return valid JSON only.
`.trim();
  }

  // ==========================================================
  // VALIDATE
  // ==========================================================

  private validateResult(result: AiCommunityPostResult): AiCommunityPostResult {
    const title = typeof result.title === 'string' ? result.title.trim() : '';

    const message =
      typeof result.message === 'string' ? result.message.trim() : '';

    const category =
      typeof result.category === 'string'
        ? result.category.trim()
        : 'Football News';

    if (!title) {
      throw new BadRequestException('AI post title is missing');
    }

    if (!message) {
      throw new BadRequestException('AI post message is missing');
    }

    if (title.length > 100) {
      throw new BadRequestException('AI post title is too long');
    }

    if (message.length > 1000) {
      throw new BadRequestException('AI post message is too long');
    }

    const sources = Array.isArray(result.sources)
      ? result.sources
          .filter(
            (source) =>
              source &&
              typeof source.title === 'string' &&
              typeof source.url === 'string',
          )
          .map((source) => ({
            title: source.title.trim(),

            url: source.url.trim(),
          }))
          .filter((source) => source.title && /^https?:\/\//i.test(source.url))
      : [];

    if (!sources.length) {
      throw new BadRequestException('AI post has no valid sources');
    }

    return {
      type: CommunityPostType.MEDIA,

      title,

      message,

      category,

      importance: result.importance === 'high' ? 'high' : 'medium',

      imageNeeded: true,

      imagePrompt:
        typeof result.imagePrompt === 'string'
          ? result.imagePrompt.trim()
          : title,

      sources,
    };
  }

  // ==========================================================
  // SOURCES
  // ==========================================================

  private mergeSources(
    ...groups: {
      title: string;
      url: string;
    }[][]
  ) {
    const map = new Map<
      string,
      {
        title: string;
        url: string;
      }
    >();

    for (const group of groups) {
      for (const source of group) {
        if (!map.has(source.url)) {
          map.set(source.url, source);
        }
      }
    }

    return Array.from(map.values());
  }
}
