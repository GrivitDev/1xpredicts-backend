import { Injectable, Logger } from '@nestjs/common';

import { ApiFootballQueueBuilderService } from './api-football-queue-builder.service';

import { ApiFootballActiveCompetitionService } from './api-football-active-competition.service';

@Injectable()
export class SportsStartupService {
  private readonly logger = new Logger(SportsStartupService.name);

  private hasRun = false;

  constructor(
    private readonly apiFootballQueueBuilderService: ApiFootballQueueBuilderService,

    private readonly apiFootballActiveCompetitionService: ApiFootballActiveCompetitionService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.hasRun) {
      return;
    }

    this.hasRun = true;

    try {
      this.logger.log('Sports startup bootstrap started');

      await this.initializeApiFootballCompetitions();

      await this.initializeApiFootballQueue();

      this.logger.log('Sports startup bootstrap completed');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(`Sports startup bootstrap failed: ${message}`);
    }
  }

  // ============================================================
  // API-FOOTBALL ACTIVE COMPETITIONS
  // ============================================================

  private async initializeApiFootballCompetitions(): Promise<void> {
    try {
      const result =
        await this.apiFootballActiveCompetitionService.refreshCurrentCompetitions();

      this.logger.log(
        `API-Football competition discovery completed: ` +
          `${result.discovered} discovered, ` +
          `${result.matched} matched, ` +
          `${result.updated} active competitions initialized`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.warn(
        `Initial API-Football competition discovery failed: ${message}`,
      );
    }
  }

  // ============================================================
  // API-FOOTBALL QUEUE
  // ============================================================

  private async initializeApiFootballQueue(): Promise<void> {
    try {
      const result =
        await this.apiFootballQueueBuilderService.buildFixtureQueue();

      this.logger.log(
        `Initial API-Football fixture queue built: ` +
          `${result.queued} queued, ` +
          `${result.skipped} skipped`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.warn(`Initial API-Football queue build failed: ${message}`);
    }
  }
}
