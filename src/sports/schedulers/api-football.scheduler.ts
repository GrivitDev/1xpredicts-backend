import { Injectable, Logger } from '@nestjs/common';

import { Cron } from '@nestjs/schedule';

import { ApiFootballActiveCompetitionService } from '../services/api-football-active-competition.service';

import { ApiFootballQueueBuilderService } from '../services/api-football-queue-builder.service';

import { ApiFootballQueueService } from '../services/api-football-queue.service';

import { SportsCollectionService } from '../services/sports-collection.service';

import { ActiveCompetitionService } from '../services/active-competition.service';

@Injectable()
export class ApiFootballScheduler {
  private readonly logger = new Logger(ApiFootballScheduler.name);

  constructor(
    private readonly apiFootballActiveCompetitionService: ApiFootballActiveCompetitionService,

    private readonly apiFootballQueueBuilderService: ApiFootballQueueBuilderService,

    private readonly apiFootballQueueService: ApiFootballQueueService,

    private readonly sportsCollectionService: SportsCollectionService,

    private readonly activeCompetitionService: ActiveCompetitionService,
  ) {}

  // ============================================================
  // CURRENT LEAGUES / SEASONS
  // DAILY
  // ============================================================

  @Cron('0 5 0 * * *', {
    name: 'api-football-league-discovery',
  })
  async refreshCurrentCompetitions(): Promise<void> {
    try {
      const result =
        await this.apiFootballActiveCompetitionService.refreshCurrentCompetitions();

      this.logger.log(
        `API-Football discovery: ` +
          `${result.discovered} discovered, ` +
          `${result.matched} matched, ` +
          `${result.updated} updated`,
      );
    } catch (error) {
      this.logger.error(
        'API-Football league discovery failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ============================================================
  // FIXTURE QUEUE
  // EVERY 30 MINUTES
  // ============================================================

  @Cron('0 */30 * * * *', {
    name: 'api-football-fixture-queue',
  })
  async buildFixtureQueue(): Promise<void> {
    try {
      const result =
        await this.apiFootballQueueBuilderService.buildFixtureQueue();

      this.logger.log(
        `API-Football fixture queue: ` +
          `${result.queued} queued, ` +
          `${result.skipped} skipped, ` +
          `${result.remainingQuota} remaining`,
      );
    } catch (error) {
      this.logger.error(
        'API-Football fixture queue build failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ============================================================
  // STANDINGS QUEUE
  // EVERY HOUR
  // ============================================================

  @Cron('0 10 * * * *', {
    name: 'api-football-standings-queue',
  })
  async buildStandingsQueue(): Promise<void> {
    try {
      const result =
        await this.apiFootballQueueBuilderService.buildStandingsQueue();

      this.logger.log(
        `API-Football standings queue: ` +
          `${result.queued} queued, ` +
          `${result.skipped} skipped, ` +
          `${result.remainingQuota} remaining`,
      );
    } catch (error) {
      this.logger.error(
        'API-Football standings queue build failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ============================================================
  // TEAM STATISTICS QUEUE
  // EVERY 6 HOURS
  // ============================================================

  @Cron('0 20 */6 * * *', {
    name: 'api-football-team-statistics-queue',
  })
  async buildTeamStatisticsQueue(): Promise<void> {
    try {
      const result =
        await this.apiFootballQueueBuilderService.buildTeamStatisticsQueue();

      this.logger.log(
        `API-Football team statistics queue: ` +
          `${result.queued} queued, ` +
          `${result.skipped} skipped, ` +
          `${result.remainingQuota} remaining`,
      );
    } catch (error) {
      this.logger.error(
        'API-Football team statistics queue build failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ============================================================
  // INJURIES QUEUE
  // EVERY 6 HOURS
  // ============================================================

  @Cron('0 30 */6 * * *', {
    name: 'api-football-injury-queue',
  })
  async buildInjuryQueue(): Promise<void> {
    try {
      const result =
        await this.apiFootballQueueBuilderService.buildInjuryQueue();

      this.logger.log(
        `API-Football injury queue: ` +
          `${result.queued} queued, ` +
          `${result.skipped} skipped, ` +
          `${result.remainingQuota} remaining`,
      );
    } catch (error) {
      this.logger.error(
        'API-Football injury queue build failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ============================================================
  // PREDICTION QUEUE
  // EVERY 6 HOURS
  // ============================================================

  @Cron('0 40 */6 * * *', {
    name: 'api-football-prediction-queue',
  })
  async buildPredictionQueue(): Promise<void> {
    try {
      const result =
        await this.apiFootballQueueBuilderService.buildPredictionQueue();

      this.logger.log(
        `API-Football prediction queue: ` +
          `${result.queued} queued, ` +
          `${result.skipped} skipped, ` +
          `${result.remainingQuota} remaining`,
      );
    } catch (error) {
      this.logger.error(
        'API-Football prediction queue build failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ============================================================
  // QUEUE WORKER
  // EVERY MINUTE
  // ============================================================

  @Cron('0 * * * * *', {
    name: 'api-football-queue-worker',
  })
  async processQueue(): Promise<void> {
    try {
      await this.sportsCollectionService.processNextApiFootballJob();
    } catch (error) {
      this.logger.error(
        'API-Football queue worker failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ============================================================
  // STALE JOB RECOVERY
  // EVERY 10 MINUTES
  // ============================================================

  @Cron('0 */10 * * * *', {
    name: 'api-football-stale-jobs',
  })
  async recoverStaleJobs(): Promise<void> {
    try {
      const recovered =
        await this.apiFootballQueueService.requeueStaleProcessingJobs(30);

      if (recovered > 0) {
        this.logger.warn(`Recovered ${recovered} stale API-Football jobs`);
      }
    } catch (error) {
      this.logger.error(
        'API-Football stale-job recovery failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ============================================================
  // QUEUE CLEANUP
  // DAILY 3:30 AM
  // ============================================================

  @Cron('0 30 3 * * *', {
    name: 'api-football-queue-cleanup',
  })
  async cleanupQueue(): Promise<void> {
    try {
      const removed =
        await this.apiFootballQueueService.removeOldCompletedJobs(30);

      if (removed > 0) {
        this.logger.log(`Removed ${removed} old API-Football queue jobs`);
      }
    } catch (error) {
      this.logger.error(
        'API-Football queue cleanup failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ============================================================
  // ACTIVE STATUS
  // DAILY
  // ============================================================

  @Cron('0 50 23 * * *', {
    name: 'api-football-active-status-refresh',
  })
  async refreshStatuses(): Promise<void> {
    try {
      await this.activeCompetitionService.refreshStatuses();
    } catch (error) {
      this.logger.error(
        'API-Football active competition status refresh failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
