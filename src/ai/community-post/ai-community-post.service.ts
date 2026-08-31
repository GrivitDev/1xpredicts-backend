// src/ai/community-post/ai-community-post.service.ts

import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { GeminiService } from '../gemini/gemini.service';

import { TavilyService } from '../../tavily/tavily.service';

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

    private readonly tavilyService: TavilyService,

    private readonly communityService: CommunityService,

    private readonly configService: ConfigService,
  ) {}

  // ==========================================================
  // GENERATE
  // ==========================================================

  async generatePost(
    request: AiCommunityPostRequest = {},
  ): Promise<AiCommunityPostResult> {
    const research = await this.searchNews(request);

    if (!research.results.length) {
      throw new BadRequestException('Tavily returned no current football news');
    }

    const imageUrl = research.images?.[0];

    if (!imageUrl) {
      throw new BadRequestException('Tavily returned no news image');
    }

    const result = await this.geminiService.generateJson<AiCommunityPostResult>(
      {
        task: 'community_post',

        prompt: this.buildPrompt(request, research, imageUrl),

        options: {
          maxOutputTokens: 2200,

          systemInstruction: this.systemInstruction(),
        },
      },
    );

    if (!result.data) {
      throw new BadRequestException('Gemini returned no community post');
    }

    return this.validateResult(result.data, research, imageUrl);
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

        url: generated.imageUrl,

        // External Tavily image URL.
        publicId: generated.imageUrl,
      },

      sources: generated.sources,
    });

    this.logger.log(`AI football news post published: ${post._id}`);

    return {
      post,

      ai: {
        grounded: generated.sources.length > 0,

        sources: generated.sources.map((source) => ({
          title: source.title,

          url: source.url,
        })),
      },
    };
  }

  // ==========================================================
  // TAVILY SEARCH
  // ==========================================================

  private async searchNews(request: AiCommunityPostRequest) {
    const query = `
${request.topic ? `${request.topic} football` : 'important football news'}

${request.category ? request.category : ''}

latest football news today
major transfers injuries suspensions
team news manager news player availability
important football developments
    `.trim();

    return this.tavilyService.searchNews(query, {
      searchDepth: 'basic',

      maxResults: 8,

      timeRange: 'day',

      includeImages: true,

      includeImageDescriptions: false,

      includeRawContent: false,
    });
  }

  // ==========================================================
  // PROMPT
  // ==========================================================

  private buildPrompt(
    request: AiCommunityPostRequest,
    research: any,
    imageUrl: string,
  ): string {
    const researchText = research.results
      .map((item: any, index: number) =>
        `
${index + 1}. ${item.title}

URL:
${item.url}

Published:
${item.publishedDate || 'Unknown'}

Information:
${item.content || 'No summary supplied.'}
`.trim(),
      )
      .join('\n\n');

    return `
Create one important and current football news post
for 2xPredict.

Do NOT search the web yourself.

Current web research has already been supplied by Tavily.

============================================================
CURRENT RESEARCH
============================================================

${researchText}

============================================================
IMAGE
============================================================

A current football image was found by Tavily.

Use this exact image URL:

${imageUrl}

Do not create another image URL.

============================================================
TOPIC PREFERENCE
============================================================

${request.topic || 'Choose the most important current story.'}

============================================================
CATEGORY
============================================================

${request.category || 'Football News'}

============================================================
EDITORIAL STANDARD
============================================================

Choose a genuinely important story.

Prioritize:

- major transfers
- major injury developments
- suspensions
- major player availability
- manager changes
- major club announcements
- important competition developments
- significant team news
- major football events

Do not choose trivial stories simply to create content.

Do not invent quotations.

Do not invent statistics.

Do not present speculation as confirmed fact.

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

Use concise original football journalism.

Do not copy an article.

Do not mention AI.

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
  "imagePrompt": "",
  "imageUrl": "${imageUrl}",
  "sources": [
    {
      "title": "string",
      "url": "https://example.com"
    }
  ]
}

The imageUrl MUST remain exactly:

"${imageUrl}"

Return JSON only.
`.trim();
  }

  // ==========================================================
  // SYSTEM
  // ==========================================================

  private systemInstruction(): string {
    return `
You are the football news editor for 2xPredict.

Tavily has already performed the web research.

Do not claim that you searched the web.

Write original concise football news.

Never fabricate:

- football news
- injuries
- transfers
- statistics
- lineups
- quotations
- results
- player availability

Use the supplied research.

Use the supplied image URL exactly.

Return valid JSON only.
`.trim();
  }

  // ==========================================================
  // VALIDATE
  // ==========================================================

  private validateResult(
    result: AiCommunityPostResult,
    research: any,
    imageUrl: string,
  ): AiCommunityPostResult {
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

      imagePrompt: '',

      imageUrl,

      sources: this.mergeSources(
        research.results.map((item: any) => ({
          title: item.title,

          url: item.url,
        })),

        sources,
      ),
    };
  }

  // ==========================================================
  // MERGE SOURCES
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
