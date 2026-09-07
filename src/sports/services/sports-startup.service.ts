import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { ApiFootballActiveCompetitionService } from './api-football-active-competition.service';

import { ApiFootballQueueBuilderService } from './api-football-queue-builder.service';

import { SPORTS_DATA_COLLECTION_CONFIG } from '../config/sports-data-collection.config';

@Injectable()
export class SportsStartupService implements OnModuleInit {
  private readonly logger = new Logger(SportsStartupService.name);

  constructor(
    private readonly apiFootballActiveCompetitionService: ApiFootballActiveCompetitionService,

    private readonly apiFootballQueueBuilderService: ApiFootballQueueBuilderService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const result =
        await this.apiFootballActiveCompetitionService.refreshCurrentCompetitions();

      this.logger.log(
        `API-Football discovery completed: ` +
          `${result.matched} matched, ` +
          `${result.updated} updated, ` +
          `${result.skipped} skipped`,
      );
    } catch (error) {
      this.logger.error(
        'API-Football startup discovery failed',
        error instanceof Error ? error.stack : String(error),
      );

      return;
    }

    const delay =
      SPORTS_DATA_COLLECTION_CONFIG.API_FOOTBALL.startup
        .initialFixtureDelayMinutes;

    if (delay > 0) {
      await this.sleep(delay * 60_000);
    }

    try {
      const result =
        await this.apiFootballQueueBuilderService.buildInitialQueue();

      this.logger.log(
        `API-Football initial queue: ` +
          `${result.queued} queued, ` +
          `${result.skipped} skipped`,
      );
    } catch (error) {
      this.logger.error(
        'API-Football initial queue creation failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}
