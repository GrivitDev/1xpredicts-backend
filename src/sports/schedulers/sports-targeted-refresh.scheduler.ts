import { Injectable, Logger } from '@nestjs/common';

import { Cron } from '@nestjs/schedule';

import { SportsCollectionService } from '../services/sports-collection.service';

import { ApiFootballQueueService } from '../services/api-football-queue.service';

import { YoutubeHighlightService } from '../services/youtube-highlight.service';

@Injectable()
export class SportsTargetedRefreshScheduler {
  private readonly logger = new Logger(SportsTargetedRefreshScheduler.name);

  constructor(
    private readonly sportsCollectionService: SportsCollectionService,

    private readonly apiFootballQueueService: ApiFootballQueueService,

    private readonly youtubeHighlightService: YoutubeHighlightService,
  ) {}

  // ============================================================
  // API-FOOTBALL QUEUE
  // EVERY MINUTE
  // ============================================================

  @Cron('0 * * * * *', {
    name: 'sports-api-football-queue-worker',
  })
  async processApiFootballQueue(): Promise<void> {
    try {
      await this.sportsCollectionService.processNextApiFootballJob();
    } catch (error) {
      this.logger.error(
        'API-Football queue worker failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ============================================================
  // YOUTUBE HIGHLIGHTS
  // EVERY 20 MINUTES
  // ============================================================

  @Cron('0 */20 * * * *', {
    name: 'sports-youtube-highlight-worker',
  })
  async processYoutubeHighlights(): Promise<void> {
    try {
      await this.youtubeHighlightService.processNext();
    } catch (error) {
      this.logger.error(
        'YouTube highlight worker failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ============================================================
  // STALE API-FOOTBALL JOBS
  // EVERY 10 MINUTES
  // ============================================================

  @Cron('0 */10 * * * *', {
    name: 'sports-api-football-stale-jobs',
  })
  async recoverStaleApiFootballJobs(): Promise<void> {
    try {
      await this.apiFootballQueueService.requeueStaleProcessingJobs(30);
    } catch (error) {
      this.logger.error(
        'Failed to recover stale API-Football jobs',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ============================================================
  // CLEAN COMPLETED QUEUE
  // DAILY 3:30 AM
  // ============================================================

  @Cron('0 30 3 * * *', {
    name: 'sports-api-football-queue-cleanup',
  })
  async cleanApiFootballQueue(): Promise<void> {
    try {
      await this.apiFootballQueueService.removeOldCompletedJobs(30);
    } catch (error) {
      this.logger.error(
        'Failed to clean API-Football queue',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
