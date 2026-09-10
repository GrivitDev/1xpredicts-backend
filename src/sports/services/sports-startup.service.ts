import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { EspnActiveCompetitionService } from './espn-active-competition.service';
import { EspnQueueBuilderService } from './espn-queue-builder.service';
import { EspnQueueService } from './espn-queue.service';

@Injectable()
export class SportsStartupService implements OnModuleInit {
  private readonly logger = new Logger(SportsStartupService.name);

  constructor(
    private readonly espnActiveCompetitionService: EspnActiveCompetitionService,
    private readonly espnQueueBuilderService: EspnQueueBuilderService,
    private readonly espnQueueService: EspnQueueService,
  ) {}

  /**
   * Do not block NestJS bootstrap.
   *
   * ESPN catalogue discovery and league-detail discovery are
   * intentionally slow because every outbound ESPN request
   * shares the provider-wide rate limiter.
   */
  onModuleInit(): void {
    this.logger.log('Starting ESPN background initialization');

    setTimeout(() => {
      void this.initializeEspn();
    }, 0);
  }

  /**
   * Startup flow:
   *
   * 1. Discover the complete ESPN catalogue.
   * 2. Store/classify every league.
   * 3. Process every league detail one-by-one.
   * 4. Extract the current season and season dates.
   * 5. Create/update ActiveCompetition records.
   * 6. Build the initial queue from stored information.
   *
   * getLeagues() is only called here at startup and by the
   * dedicated monthly catalogue refresh scheduler.
   */
  private async initializeEspn(): Promise<void> {
    // ==========================================================
    // STEP 1 — COMPLETE ESPN CATALOGUE
    // ==========================================================

    let leagues: unknown[] = [];

    try {
      leagues =
        await this.espnActiveCompetitionService.synchronizeLeagueCatalogue();

      this.logger.log(
        `ESPN league catalogue synchronized: ${leagues.length} leagues`,
      );
    } catch (error) {
      this.logger.error(
        'ESPN league catalogue synchronization failed',
        error instanceof Error ? error.stack : String(error),
      );

      return;
    }

    // ==========================================================
    // STEP 2 — LEAGUE DETAILS + ACTIVE SEASONS
    // ==========================================================

    try {
      const result =
        await this.espnActiveCompetitionService.synchronizeLeagueDetails();

      this.logger.log(
        `ESPN league season discovery completed: ` +
          `processed=${result.processed}, ` +
          `synchronized=${result.synchronized}, ` +
          `skipped=${result.skipped}, ` +
          `failed=${result.failed}`,
      );
    } catch (error) {
      this.logger.error(
        'ESPN league detail synchronization failed',
        error instanceof Error ? error.stack : String(error),
      );

      return;
    }

    // ==========================================================
    // STEP 3 — INITIAL PRIORITY QUEUE
    // ==========================================================

    try {
      const result =
        await this.espnQueueBuilderService.buildInitialLeagueQueue();

      this.logger.log(
        `ESPN initial queue built: ` +
          `queued=${result.queued}, ` +
          `skipped=${result.skipped}`,
      );
    } catch (error) {
      this.logger.error(
        'ESPN initial queue construction failed',
        error instanceof Error ? error.stack : String(error),
      );

      return;
    }

    // ==========================================================
    // STEP 4 — QUEUE STATE
    // ==========================================================

    try {
      const stats = await this.getQueueStats();

      this.logger.log(
        `ESPN queue state: ` +
          `pending=${stats.pending}, ` +
          `processing=${stats.processing}, ` +
          `completed=${stats.completed}, ` +
          `failed=${stats.failed}`,
      );
    } catch (error) {
      this.logger.warn(
        `Unable to read ESPN queue state at startup: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    this.logger.log('ESPN background initialization completed');
  }

  private async getQueueStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    return {
      pending: await this.espnQueueService.countPending(),
      processing: await this.espnQueueService.countProcessing(),
      completed: await this.espnQueueService.countCompleted(),
      failed: await this.espnQueueService.countFailed(),
    };
  }
}
