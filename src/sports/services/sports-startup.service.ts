import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { EspnActiveCompetitionService } from './espn-active-competition.service';
import { EspnQueueService } from './espn-queue.service';

@Injectable()
export class SportsStartupService implements OnModuleInit {
  private readonly logger = new Logger(SportsStartupService.name);

  constructor(
    private readonly espnActiveCompetitionService: EspnActiveCompetitionService,
    private readonly espnQueueService: EspnQueueService,
  ) {}

  /**
   * Start the ESPN initialization process without blocking
   * NestJS application startup.
   *
   * This is important because ESPN requests are subject to
   * the shared provider-wide 60-second rate limiter.
   *
   * The application must begin listening before the catalogue
   * synchronization performs potentially multiple requests.
   */
  onModuleInit(): void {
    this.logger.log('Starting ESPN background initialization');

    setTimeout(() => {
      void this.initializeEspn();
    }, 0);
  }

  /**
   * Performs the complete ESPN startup initialization after
   * NestJS has been allowed to finish bootstrapping.
   */
  private async initializeEspn(): Promise<void> {
    /*
     * ============================================================
     * ESPN CATALOGUE
     * ============================================================
     *
     * Catalogue synchronization discovers and stores the ESPN
     * leagues.
     *
     * This can require multiple provider requests because the
     * ESPN catalogue is paginated and every request is subject
     * to the shared ESPN rate limiter.
     */
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

    /*
     * ============================================================
     * INITIAL LEAGUE QUEUE
     * ============================================================
     *
     * One LEAGUE_REFRESH job is created for every discovered
     * league.
     *
     * No detailed ESPN requests are made directly here.
     * The ESPN queue worker performs those requests.
     */
    let queued = 0;
    let skipped = 0;

    for (const value of leagues) {
      if (!value || typeof value !== 'object') {
        skipped += 1;
        continue;
      }

      const league = value as Record<string, unknown>;

      const leagueId =
        typeof league.id === 'string'
          ? league.id.trim()
          : typeof league.leagueId === 'string'
            ? league.leagueId.trim()
            : typeof league.slug === 'string'
              ? league.slug.trim()
              : '';

      if (!leagueId) {
        skipped += 1;
        continue;
      }

      const season =
        typeof league.season === 'number' ? league.season : undefined;

      const priority =
        typeof league.priority === 'number' ? league.priority : 99;

      try {
        const job = await this.espnQueueService.addLeagueRefreshJob({
          leagueId,
          season,
          priority,
          scheduledFor: new Date(),
        });

        if (job) {
          queued += 1;
        } else {
          skipped += 1;
        }
      } catch (error) {
        skipped += 1;

        this.logger.warn(
          `Unable to queue ESPN league ${leagueId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    this.logger.log(
      `ESPN initial league queue created: ` +
        `${queued} queued, ${skipped} skipped`,
    );

    /*
     * ============================================================
     * QUEUE STATE
     * ============================================================
     *
     * MongoDB only. No provider request is made here.
     */
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
    type QueueStats = {
      pending: number;
      processing: number;
      completed: number;
      failed: number;
    };

    type QueueStatsService = {
      getQueueStats?: () => Promise<QueueStats>;
      getCounts?: () => Promise<QueueStats>;
      getQueueCounts?: () => Promise<QueueStats>;
    };

    const service = this.espnQueueService as unknown as QueueStatsService;

    if (typeof service.getQueueStats === 'function') {
      return service.getQueueStats();
    }

    if (typeof service.getCounts === 'function') {
      return service.getCounts();
    }

    if (typeof service.getQueueCounts === 'function') {
      return service.getQueueCounts();
    }

    return {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };
  }
}
