import { Injectable, Logger } from '@nestjs/common';

import { Cron } from '@nestjs/schedule';

import { EspnService } from '../providers/espn.service';

@Injectable()
export class NewsScheduler {
  private readonly logger = new Logger(NewsScheduler.name);

  private running = false;

  constructor(private readonly espnService: EspnService) {}

  // ============================================================
  // MORNING NEWS
  // ============================================================

  @Cron('0 8 * * *', {
    name: 'espn-news-morning',
    timeZone: 'Africa/Lagos',
  })
  async collectMorningNews(): Promise<void> {
    await this.collectNews('morning');
  }

  // ============================================================
  // EVENING NEWS
  // ============================================================

  @Cron('0 20 * * *', {
    name: 'espn-news-evening',
    timeZone: 'Africa/Lagos',
  })
  async collectEveningNews(): Promise<void> {
    await this.collectNews('evening');
  }

  // ============================================================
  // COLLECT NEWS
  // ============================================================

  private async collectNews(period: 'morning' | 'evening'): Promise<void> {
    if (this.running) {
      this.logger.warn(
        `Skipping ${period} ESPN news collection because another news collection is already running`,
      );

      return;
    }

    this.running = true;

    try {
      const response = await this.espnService.getNews();

      const itemCount = Array.isArray(response.items)
        ? response.items.length
        : 0;

      this.logger.log(
        `ESPN ${period} news collection completed: ${itemCount} articles received`,
      );
    } catch (error) {
      this.logger.error(
        `ESPN ${period} news collection failed`,
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }
}
