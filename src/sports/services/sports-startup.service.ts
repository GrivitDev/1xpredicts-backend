import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { EspnActiveCompetitionService } from './espn-active-competition.service';
import { EspnQueueBuilderService } from './espn-queue-builder.service';
import { EspnQueueService } from './espn-queue.service';
import { SportsCollectionService } from './sports-collection.service';

@Injectable()
export class SportsStartupService implements OnModuleInit {
  private readonly logger = new Logger(SportsStartupService.name);

  constructor(
    private readonly espnActiveCompetitionService: EspnActiveCompetitionService,

    private readonly sportsCollectionService: SportsCollectionService,

    private readonly espnQueueBuilderService: EspnQueueBuilderService,

    private readonly espnQueueService: EspnQueueService,
  ) {}

  /**
   * Do not block NestJS bootstrap.
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
   * 1. Discover complete ESPN catalogue.
   * 2. Synchronize league details.
   * 3. Determine current active seasons.
   * 4. Bootstrap fixtures:
   *
   *       seasonStartDate
   *              ->
   *       today + 4 days
   *
   * 5. Build league refresh queue.
   * 6. Read queue state.
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
        `ESPN league catalogue synchronized: ` + `${leagues.length} leagues`,
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

    let detailResult: {
      processed: number;
      synchronized: number;
      active: number;
      inactive: number;
      skipped: number;
      failed: number;
    };

    try {
      detailResult =
        await this.espnActiveCompetitionService.synchronizeLeagueDetails();

      this.logger.log(
        `ESPN league season discovery completed: ` +
          `processed=${detailResult.processed}, ` +
          `synchronized=${detailResult.synchronized}, ` +
          `active=${detailResult.active}, ` +
          `inactive=${detailResult.inactive}, ` +
          `skipped=${detailResult.skipped}, ` +
          `failed=${detailResult.failed}`,
      );
    } catch (error) {
      this.logger.error(
        'ESPN league detail synchronization failed',
        error instanceof Error ? error.stack : String(error),
      );

      return;
    }

    // ==========================================================
    // STEP 3 — INITIAL FULL-SEASON FIXTURE COLLECTION
    // ==========================================================

    try {
      const activeLeagues =
        await this.espnActiveCompetitionService.getActiveLeagues();

      let processed = 0;
      let collected = 0;
      let failed = 0;

      this.logger.log(
        `Starting ESPN fixture bootstrap for ` +
          `${activeLeagues.length} active leagues`,
      );

      for (const league of activeLeagues) {
        if (!league.isActive) {
          continue;
        }

        if (typeof league.season !== 'number' || !league.seasonStartDate) {
          this.logger.warn(
            `Skipping startup fixture bootstrap for ` +
              `${league.leagueId}: missing season or seasonStartDate`,
          );

          continue;
        }

        processed += 1;

        try {
          const result =
            await this.sportsCollectionService.collectEspnSeasonFixtures({
              leagueId: league.slug || league.leagueId,

              season: league.season,

              seasonStartDate: league.seasonStartDate,
            });

          collected += result.collected;

          this.logger.log(
            `ESPN startup fixture bootstrap complete for ` +
              `${league.leagueId}: ` +
              `collected=${result.collected}, ` +
              `range=${result.dateFrom}->${result.dateTo}`,
          );
        } catch (error) {
          failed += 1;

          this.logger.error(
            `ESPN startup fixture bootstrap failed for ` +
              `${league.leagueId}: ` +
              `${error instanceof Error ? error.message : String(error)}`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }

      this.logger.log(
        `ESPN startup fixture bootstrap completed: ` +
          `processed=${processed}, ` +
          `collected=${collected}, ` +
          `failed=${failed}`,
      );
    } catch (error) {
      this.logger.error(
        'ESPN startup fixture bootstrap failed',
        error instanceof Error ? error.stack : String(error),
      );

      return;
    }

    // ==========================================================
    // STEP 4 — INITIAL LEAGUE QUEUE
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
    // STEP 5 — QUEUE STATE
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
