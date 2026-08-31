// src/ai/ai-content-scheduler.service.ts

import { Injectable, Logger } from '@nestjs/common';

import { Cron } from '@nestjs/schedule';

import { CommunityService } from '../community/community.service';

import { AiCommunityPostService } from './community-post/ai-community-post.service';

import { AiCommunityDiscussionService } from './community-discussions/ai-community-discussion.service';

import { AiVideoService } from './videos/ai-video.service';

import { CommunityPostType } from '../community/enums/community-post-type.enum';

@Injectable()
export class AiContentSchedulerService {
  private readonly logger = new Logger(AiContentSchedulerService.name);

  private running = false;

  // ==========================================================
  // CONTENT WINDOW
  // ==========================================================
  //
  // 06:00
  // 06:15
  // ...
  // 09:45
  //
  // ==========================================================

  @Cron('*/15 6-9 * * *')
  async generateMorningContent(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      await this.generateOne();
    } catch (error) {
      this.logger.error(
        'Morning AI content generation failed.',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }

  // ==========================================================
  // ONE CONTENT ITEM
  // ==========================================================

  private async generateOne(): Promise<void> {
    const counts = await this.communityService.getAiDailyContentCounts();

    const type = this.selectType(counts);

    if (!type) {
      this.logger.log('Daily AI content limits reached.');

      return;
    }

    if (type === 'news') {
      await this.aiCommunityPostService.generateAndPublish({
        publish: true,
      });

      return;
    }

    if (type === 'discussion') {
      await this.generateDiscussion();

      return;
    }

    await this.aiVideoService.generateAndPublish();
  }

  // ==========================================================
  // SELECT TYPE
  // ==========================================================

  private selectType(counts: {
    news: number;
    discussions: number;
    videos: number;
  }): 'news' | 'discussion' | 'video' | null {
    const items = [
      {
        type: 'news' as const,
        count: counts.news,
      },

      {
        type: 'discussion' as const,
        count: counts.discussions,
      },

      {
        type: 'video' as const,
        count: counts.videos,
      },
    ];

    // --------------------------------------------------------
    // Minimum daily target = 3
    // --------------------------------------------------------

    const missingMinimum = items
      .filter((item) => item.count < 3)
      .sort((a, b) => a.count - b.count);

    if (missingMinimum.length) {
      return missingMinimum[0].type;
    }

    // --------------------------------------------------------
    // Optional target = 5
    // --------------------------------------------------------

    const belowMaximum = items
      .filter((item) => item.count < 5)
      .sort((a, b) => a.count - b.count);

    if (belowMaximum.length) {
      return belowMaximum[0].type;
    }

    return null;
  }

  // ==========================================================
  // DISCUSSION
  // ==========================================================

  private async generateDiscussion(): Promise<void> {
    const context = `
Create a short football discussion around an important
upcoming match or popular football team.

Prefer a match happening today or within the next few days.

The discussion should be connected to a current 2xPredict
prediction when one is available.

Use current information.

Keep the sentences short.

Do not write an article.
`.trim();

    const generated =
      await this.aiCommunityDiscussionService.generateDiscussion(context);

    const userId = process.env.AI_COMMUNITY_USER_ID;

    if (!userId) {
      throw new Error('AI_COMMUNITY_USER_ID is missing');
    }

    await this.communityService.createAiPost({
      userId,

      username: process.env.AI_COMMUNITY_USERNAME || '2xpredict_ai',

      fullName: process.env.AI_COMMUNITY_FULL_NAME || '2xPredict AI',

      type: CommunityPostType.DISCUSSION,

      title: generated.title,

      message: generated.message,

      category: generated.category,

      sources: [],
    });
  }

  constructor(
    private readonly communityService: CommunityService,

    private readonly aiCommunityPostService: AiCommunityPostService,

    private readonly aiCommunityDiscussionService: AiCommunityDiscussionService,

    private readonly aiVideoService: AiVideoService,
  ) {}
}
