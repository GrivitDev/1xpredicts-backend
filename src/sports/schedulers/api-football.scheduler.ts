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

  /**
   * Refresh API-Football competition information shortly before
   * the daily collection window starts.
   *
   * Collection window:
   * 13:00 - 02:00 WAT
   */
  @Cron('50 12 * * *', {
    name: 'api-football-league-discovery',
    timeZone: 'Africa/Lagos',
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
  // EARLY COLLECTION
  // 13:00 WAT
  // ============================================================

  /**
   * Supporting data comes first:
   *
   * - team statistics
   * - injuries
   *
   * These are needed by the prediction pipeline later in the day.
   */
  @Cron('10 13 * * *', {
    name: 'api-football-early-supporting-data',
    timeZone: 'Africa/Lagos',
  })
  async buildEarlySupportingDataQueue(): Promise<void> {
    try {
      const result =
        await this.apiFootballQueueBuilderService.buildTeamStatisticsAndInjuryJobs();

      this.logger.log(
        `API-Football early supporting-data queue: ` +
          `${result.queued} queued, ` +
          `${result.skipped} skipped, ` +
          `${result.remainingQuota} remaining`,
      );
    } catch (error) {
      this.logger.error(
        'API-Football early supporting-data queue build failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ============================================================
  // SECOND SUPPORTING-DATA PASS
  // 15:30 WAT
  // ============================================================

  /**
   * Gives newly available fixture/team information another chance
   * to receive supporting data.
   *
   * The queue service prevents duplicate active jobs.
   */
  @Cron('30 15 * * *', {
    name: 'api-football-secondary-supporting-data',
    timeZone: 'Africa/Lagos',
  })
  async buildSecondarySupportingDataQueue(): Promise<void> {
    try {
      const result =
        await this.apiFootballQueueBuilderService.buildTeamStatisticsAndInjuryJobs();

      this.logger.log(
        `API-Football secondary supporting-data queue: ` +
          `${result.queued} queued, ` +
          `${result.skipped} skipped, ` +
          `${result.remainingQuota} remaining`,
      );
    } catch (error) {
      this.logger.error(
        'API-Football secondary supporting-data queue build failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ============================================================
  // MID-DAY TARGETED COLLECTION
  // 18:30 WAT
  // ============================================================

  /**
   * Targeted prediction preparation.
   *
   * This does not continuously poll API-Football. It only creates
   * prediction jobs for relevant upcoming fixtures already known
   * in MongoDB.
   */
  @Cron('30 18 * * *', {
    name: 'api-football-targeted-collection',
    timeZone: 'Africa/Lagos',
  })
  async buildTargetedQueue(): Promise<void> {
    try {
      const result =
        await this.apiFootballQueueBuilderService.buildTargetedJobs();

      this.logger.log(
        `API-Football targeted queue: ` +
          `${result.queued} queued, ` +
          `${result.skipped} skipped, ` +
          `${result.remainingQuota} remaining`,
      );
    } catch (error) {
      this.logger.error(
        'API-Football targeted queue build failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ============================================================
  // LATE COLLECTION
  // 00:05 WAT
  // ============================================================

  /**
   * Late-stage collection.
   *
   * This is where the system gives priority to:
   *
   * - fixtures
   * - standings
   * - predictions
   *
   * after most of the day's football activity has occurred.
   */
  @Cron('5 0 * * *', {
    name: 'api-football-late-collection',
    timeZone: 'Africa/Lagos',
  })
  async buildLateStageQueue(): Promise<void> {
    try {
      const result =
        await this.apiFootballQueueBuilderService.buildLateStageJobs();

      this.logger.log(
        `API-Football late-stage queue: ` +
          `${result.queued} queued, ` +
          `${result.skipped} skipped, ` +
          `${result.remainingQuota} remaining`,
      );
    } catch (error) {
      this.logger.error(
        'API-Football late-stage queue build failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ============================================================
  // FINAL COLLECTION PASS
  // 01:30 WAT
  // ============================================================

  /**
   * Final collection pass before the daily collection window closes.
   *
   * Duplicate active jobs are rejected by ApiFootballQueueService.
   */
  @Cron('30 1 * * *', {
    name: 'api-football-final-collection',
    timeZone: 'Africa/Lagos',
  })
  async buildFinalStageQueue(): Promise<void> {
    try {
      const result =
        await this.apiFootballQueueBuilderService.buildLateStageJobs();

      this.logger.log(
        `API-Football final-stage queue: ` +
          `${result.queued} queued, ` +
          `${result.skipped} skipped, ` +
          `${result.remainingQuota} remaining`,
      );
    } catch (error) {
      this.logger.error(
        'API-Football final-stage queue build failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ============================================================
  // QUEUE WORKER
  // 13:00 - 02:00 WAT
  // ============================================================

  /**
   * Processes one API-Football job per worker tick.
   *
   * The actual external request is still controlled by:
   *
   * SportsProviderRateLimitService
   *
   * Therefore the worker does NOT determine the API request rate.
   */
  @Cron('0 * 13-23 * * *', {
    name: 'api-football-queue-worker-day',
    timeZone: 'Africa/Lagos',
  })
  @Cron('0 * 0-1 * * *', {
    name: 'api-football-queue-worker-night',
    timeZone: 'Africa/Lagos',
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
  // EVERY 10 MINUTES DURING COLLECTION
  // ============================================================

  @Cron('0 */10 13-23 * * *', {
    name: 'api-football-stale-jobs-day',
    timeZone: 'Africa/Lagos',
  })
  @Cron('0 */10 0-1 * * *', {
    name: 'api-football-stale-jobs-night',
    timeZone: 'Africa/Lagos',
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
  // DAILY 03:30 WAT
  // ============================================================

  /**
   * Database maintenance only.
   *
   * This does not consume API-Football quota.
   */
  @Cron('0 30 3 * * *', {
    name: 'api-football-queue-cleanup',
    timeZone: 'Africa/Lagos',
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
  // ACTIVE COMPETITION STATUS
  // 23:50 WAT
  // ============================================================

  /**
   * Database-side competition status maintenance.
   */
  @Cron('0 50 23 * * *', {
    name: 'api-football-active-status-refresh',
    timeZone: 'Africa/Lagos',
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
