import { Injectable, Logger } from '@nestjs/common';

import { Cron } from '@nestjs/schedule';

import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import { SPORTS_DATA_COLLECTION_CONFIG } from '../config/sports-data-collection.config';

import {
  ApiFootballFixture,
  ApiFootballFixtureDocument,
} from '../schemas/api-football/api-football-fixture.schema';

import {
  YouTubeHighlight,
  YouTubeHighlightDocument,
} from '../schemas/youtube-highlight.schema';

import { YoutubeHighlightService } from '../services/youtube-highlight.service';

@Injectable()
export class YoutubeScheduler {
  private readonly logger = new Logger(YoutubeScheduler.name);

  private readonly config = SPORTS_DATA_COLLECTION_CONFIG.YOUTUBE;

  private running = false;

  constructor(
    private readonly youtubeHighlightService: YoutubeHighlightService,

    @InjectModel(ApiFootballFixture.name)
    private readonly apiFootballFixtureModel: Model<ApiFootballFixtureDocument>,

    @InjectModel(YouTubeHighlight.name)
    private readonly highlightModel: Model<YouTubeHighlightDocument>,
  ) {}

  @Cron('*/10 * * * *', {
    timeZone: 'Africa/Lagos',
  })
  async queueCompletedFixtures(): Promise<void> {
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const fixtures = await this.apiFootballFixtureModel
        .find({
          fixtureDate: {
            $gte: since,
          },
          'payload.fixture.status.short': {
            $in: ['FT', 'AET', 'PEN'],
          },
        })
        .sort({
          fixtureDate: -1,
        })
        .limit(100)
        .lean()
        .exec();

      for (const fixture of fixtures) {
        if (typeof fixture.fixtureId !== 'number') {
          continue;
        }

        const payload = fixture.payload as any;

        const homeTeam = payload?.teams?.home?.name;
        const awayTeam = payload?.teams?.away?.name;

        if (!homeTeam || !awayTeam) {
          continue;
        }

        await this.youtubeHighlightService.queueFixture(
          fixture.fixtureId,
          String(fixture.leagueId),
        );
      }
    } catch (error) {
      this.logger.error(
        'Failed to queue completed YouTube fixtures',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  @Cron('* * * * *', {
    timeZone: 'Africa/Lagos',
  })
  async processQueue(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      const remaining =
        await this.youtubeHighlightService.getRemainingDailyQuota();

      if (remaining <= 0) {
        return;
      }

      await this.youtubeHighlightService.processPending(1);
    } catch (error) {
      this.logger.error(
        'YouTube highlight queue processing failed',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }
}
