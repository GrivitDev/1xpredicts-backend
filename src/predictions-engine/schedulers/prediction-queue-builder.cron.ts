import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { SportsDataReadService } from '../../sports/services/sports-data-read.service';
import { PredictionSchedulerService } from '../services/prediction-scheduler.service';

@Injectable()
export class PredictionQueueBuilderCron {
  private readonly logger = new Logger(PredictionQueueBuilderCron.name);

  constructor(
    private readonly sportsDataReadService: SportsDataReadService,
    private readonly predictionSchedulerService: PredictionSchedulerService,
  ) {}

  /**
   * Builds the prediction queue every day at 05:55.
   *
   * The queue only covers fixtures scheduled within the next 3 days.
   */
  @Cron('0 55 5 * * *')
  async buildDailyQueue(): Promise<void> {
    const now = new Date();
    const end = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    try {
      const fixtures = await this.sportsDataReadService.getUpcomingFixtures(
        now,
        end,
      );

      const queueFixtures = fixtures
        .map((fixture) => {
          const record = fixture as Record<string, unknown>;
          const kickoffValue =
            record.fixtureDate ?? record.kickoffAt ?? record.date;

          return {
            fixtureId: String(record.fixtureId ?? record.id ?? record.eventId),
            kickoffAt:
              kickoffValue instanceof Date ||
              typeof kickoffValue === 'string' ||
              typeof kickoffValue === 'number'
                ? new Date(kickoffValue)
                : new Date(NaN),
          };
        })
        .filter(
          (fixture) =>
            fixture.fixtureId !== 'undefined' &&
            fixture.fixtureId !== 'null' &&
            Number.isFinite(fixture.kickoffAt.getTime()),
        );

      const queued =
        await this.predictionSchedulerService.buildQueue(queueFixtures);

      this.logger.log(
        `Prediction queue built: ${queued} new fixtures queued from ${queueFixtures.length} eligible fixtures.`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown queue builder error';

      this.logger.error(`Daily prediction queue build failed: ${message}`);
    }
  }
}
