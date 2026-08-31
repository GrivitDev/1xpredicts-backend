// src/cron/cron.service.ts

import { Injectable, Logger } from '@nestjs/common';

import { Cron } from '@nestjs/schedule';

import { PaymentsService } from '../payments/payments.service';

import { CommunityService } from '../community/community.service';

import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly paymentsService: PaymentsService,

    private readonly communityService: CommunityService,

    private readonly telegramService: TelegramService,
  ) {}

  // ==========================================================
  // CLEANUP EXPIRED PAYMENTS
  // ==========================================================

  @Cron('*/5 * * * *')
  async cleanupExpiredGatewayPayments(): Promise<void> {
    this.logger.log('Checking for expired pending gateway payments...');

    try {
      const deletedCount =
        await this.paymentsService.deleteExpiredPendingGatewayPayments();

      if (deletedCount > 0) {
        this.logger.log(
          `Deleted ${deletedCount} expired pending gateway payment(s).`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Failed to clean up expired gateway payments.',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // src/cron/cron.service.ts

  // ==========================================================
  // DAILY TELEGRAM CONTENT
  // ==========================================================
  //
  // 10:00 AM every day.
  //
  // Sends:
  // - latest unsent discussion
  // - latest unsent image news post
  //
  // Videos are excluded.
  //
  // No Gemini call happens here.
  // ==========================================================

  @Cron('0 10 * * *')
  async distributeDailyTelegramContent(): Promise<void> {
    this.logger.log('Sending daily community content to Telegram...');

    // ========================================================
    // DISCUSSION
    // ========================================================

    try {
      const discussion =
        await this.communityService.getLatestTelegramDiscussion();

      if (discussion) {
        const sent = await this.telegramService.sendCommunityDiscussion({
          title: discussion.title,

          message: discussion.message,

          category: discussion.category,
        });

        if (sent) {
          await this.communityService.markTelegramSent(
            discussion._id.toString(),
          );

          this.logger.log(`Telegram discussion sent: ${discussion._id}`);
        }
      }
    } catch (error) {
      this.logger.error(
        'Telegram discussion distribution failed.',
        error instanceof Error ? error.stack : String(error),
      );
    }

    // ========================================================
    // NEWS IMAGE POST
    // ========================================================

    try {
      const post = await this.communityService.getLatestTelegramNewsPost();

      if (post && post.media?.type === 'image' && post.media.url) {
        const sent = await this.telegramService.sendCommunityNewsPost({
          title: post.title,

          message: post.message,

          category: post.category,

          imageUrl: post.media.url,
        });

        if (sent) {
          await this.communityService.markTelegramSent(post._id.toString());

          this.logger.log(`Telegram news post sent: ${post._id}`);
        }
      }
    } catch (error) {
      this.logger.error(
        'Telegram news distribution failed.',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
  // ==========================================================
  // WEEKLY DATABASE CLEANUP
  // ==========================================================

  @Cron('0 3 * * 0')
  async cleanupDatabase(): Promise<void> {
    this.logger.log('Running weekly database cleanup...');

    // Future weekly cleanup tasks
  }
}
