import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { ApiFootballActiveCompetitionService } from './api-football-active-competition.service';

import { ApiFootballQueueBuilderService } from './api-football-queue-builder.service';

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
        `API-Football startup synchronization completed: ` +
          `catalog=${result.discovered}, ` +
          `supported=${result.supported}, ` +
          `matched=${result.matched}, ` +
          `active=${result.updated}, ` +
          `skipped=${result.skipped}`,
      );
    } catch (error) {
      this.logger.error(
        'API-Football startup synchronization failed',
        error instanceof Error ? error.stack : String(error),
      );

      return;
    }

    // MongoDB only. No provider call here.
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
}
