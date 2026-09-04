import { Injectable, Logger } from '@nestjs/common';

import { Cron } from '@nestjs/schedule';

import { YoutubeHighlightService } from '../services/youtube-highlight.service';

@Injectable()
export class YoutubeScheduler {
  private readonly logger = new Logger(YoutubeScheduler.name);

  constructor(
    private readonly youtubeHighlightService: YoutubeHighlightService,
  ) {}

  @Cron('0 * * * * *')
  async processHighlightQueue(): Promise<void> {
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
