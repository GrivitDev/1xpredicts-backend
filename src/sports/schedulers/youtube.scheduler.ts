import { Injectable, Logger } from '@nestjs/common';

import { Cron } from '@nestjs/schedule';

import { YoutubeHighlightService } from '../services/youtube-highlight.service';

@Injectable()
export class YoutubeScheduler {
  private readonly logger = new Logger(YoutubeScheduler.name);

  constructor(
    private readonly youtubeHighlightService: YoutubeHighlightService,
  ) {}

  // ============================================================
  // HIGHLIGHT QUEUE WORKER
  //
  // YouTube runs only during the final 3 hours of the
  // daily collection window:
  //
  // 11:00 PM - 2:00 AM WAT
  //
  // The worker checks the queue every minute.
  //
  // The central provider rate limiter controls:
  // - 1 actual request per 60 seconds
  // - daily YouTube quota
  // ============================================================

  @Cron('0 * 23 * * *', {
    name: 'youtube-highlight-queue-23',
    timeZone: 'Africa/Lagos',
  })
  async processHighlightQueueLate(): Promise<void> {
    await this.processHighlightQueue();
  }

  @Cron('0 * 0-1 * * *', {
    name: 'youtube-highlight-queue-night',
    timeZone: 'Africa/Lagos',
  })
  async processHighlightQueueNight(): Promise<void> {
    await this.processHighlightQueue();
  }

  private async processHighlightQueue(): Promise<void> {
    try {
      await this.youtubeHighlightService.processNext();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `YouTube highlight queue processing failed: ${message}`,
      );
    }
  }
}
