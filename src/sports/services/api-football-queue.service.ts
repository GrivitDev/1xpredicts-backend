import { Injectable, Logger } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  ApiFootballQueue,
  ApiFootballQueueDocument,
} from '../schemas/api-football-queue.schema';

import {
  ApiFootballQueueJobType,
  ApiFootballQueueStatus,
} from '../interfaces/api-football-queue.interface';

import { SportsProviderRateLimitService } from './sports-provider-rate-limit.service';

import { SPORTS_DATA_COLLECTION_CONFIG } from '../config/sports-data-collection.config';

@Injectable()
export class ApiFootballQueueService {
  private readonly logger = new Logger(ApiFootballQueueService.name);

  private readonly maxAttempts =
    SPORTS_DATA_COLLECTION_CONFIG.API_FOOTBALL.queue.maxAttempts;

  private readonly dailyRequestLimit =
    SPORTS_DATA_COLLECTION_CONFIG.API_FOOTBALL.dailyRequestLimit;

  constructor(
    @InjectModel(ApiFootballQueue.name)
    private readonly queueModel: Model<ApiFootballQueueDocument>,

    private readonly rateLimitService: SportsProviderRateLimitService,
  ) {}

  // ============================================================
  // ADD JOB
  // ============================================================

  async addJob(job: {
    jobType: ApiFootballQueueJobType;
    competitionId: string;
    apiFootballLeagueId?: number;
    season?: number;
    apiFootballTeamId?: number;
    apiFootballFixtureId?: number;
    priority?: number;
    scheduledFor?: Date;
  }): Promise<ApiFootballQueueDocument | null> {
    const identity: Record<string, unknown> = {
      type: job.jobType,
      competitionId: job.competitionId,
    };

    if (job.apiFootballLeagueId !== undefined) {
      identity.apiFootballLeagueId = job.apiFootballLeagueId;
    }

    if (job.season !== undefined) {
      identity.season = job.season;
    }

    if (job.apiFootballTeamId !== undefined) {
      identity.apiFootballTeamId = job.apiFootballTeamId;
    }

    if (job.apiFootballFixtureId !== undefined) {
      identity.apiFootballFixtureId = job.apiFootballFixtureId;
    }

    /*
     * A job already pending or processing is still active.
     *
     * Do not create another copy.
     */
    const activeJob = await this.queueModel
      .findOne({
        ...identity,
        status: {
          $in: [
            ApiFootballQueueStatus.PENDING,
            ApiFootballQueueStatus.PROCESSING,
          ],
        },
      })
      .sort({
        createdAt: -1,
      })
      .exec();

    if (activeJob) {
      return null;
    }

    /*
     * IMPORTANT:
     *
     * We intentionally do NOT reject a job merely because an older
     * completed job exists.
     *
     * API-Football collection is recurring. A completed job from
     * yesterday must not prevent today's refresh.
     *
     * The scheduler/builder controls when a new collection is needed.
     */
    return this.queueModel.create({
      competitionId: job.competitionId,
      apiFootballLeagueId: job.apiFootballLeagueId,
      season: job.season,
      apiFootballTeamId: job.apiFootballTeamId,
      apiFootballFixtureId: job.apiFootballFixtureId,

      type: job.jobType,

      priority: job.priority ?? 100,

      status: ApiFootballQueueStatus.PENDING,

      attempts: 0,

      maxAttempts: this.maxAttempts,

      scheduledFor: job.scheduledFor ?? new Date(),
    });
  }

  // ============================================================
  // GET NEXT JOB
  // ============================================================

  async getNextJob(): Promise<ApiFootballQueueDocument | null> {
    /*
     * Never claim another API-Football job once the daily budget
     * has already been consumed.
     */
    const remainingQuota = await this.getRemainingDailyQuota();

    if (remainingQuota <= 0) {
      return null;
    }

    const now = new Date();

    return this.queueModel
      .findOneAndUpdate(
        {
          status: ApiFootballQueueStatus.PENDING,

          scheduledFor: {
            $lte: now,
          },

          $or: [
            {
              nextAttemptAt: {
                $exists: false,
              },
            },
            {
              nextAttemptAt: {
                $lte: now,
              },
            },
          ],
        },
        {
          $set: {
            status: ApiFootballQueueStatus.PROCESSING,
            startedAt: now,
          },

          $inc: {
            attempts: 1,
          },
        },
        {
          sort: {
            priority: 1,
            scheduledFor: 1,
            createdAt: 1,
          },

          new: true,
        },
      )
      .exec();
  }

  // ============================================================
  // COMPLETE JOB
  // ============================================================

  async completeJob(jobId: string): Promise<void> {
    const now = new Date();

    await this.queueModel
      .findByIdAndUpdate(
        jobId,
        {
          $set: {
            status: ApiFootballQueueStatus.COMPLETED,
            completedAt: now,
            processedAt: now,
          },

          $unset: {
            error: 1,
            nextAttemptAt: 1,
            startedAt: 1,
          },
        },
        {
          new: true,
        },
      )
      .exec();
  }

  async markCompleted(jobId: string): Promise<void> {
    await this.completeJob(jobId);
  }

  // ============================================================
  // FAIL JOB
  // ============================================================

  async failJob(jobId: string, error: unknown): Promise<void> {
    const job = await this.queueModel.findById(jobId).exec();

    if (!job) {
      return;
    }

    const message = error instanceof Error ? error.message : String(error);

    const attempts = job.attempts ?? 0;
    const maxAttempts = job.maxAttempts ?? this.maxAttempts;

    const shouldRetry = attempts < maxAttempts;

    if (shouldRetry) {
      /*
       * Retry scheduling does NOT bypass the provider limiter.
       *
       * When this job is processed again:
       *
       * retry -> SportsProviderRateLimitService
       *       -> 60-second provider window
       *       -> daily quota check
       *       -> actual API call
       *
       * The failed original request has already consumed its quota
       * because quota accounting happens before the external request.
       */
      const retryDelayMinutes =
        SPORTS_DATA_COLLECTION_CONFIG.API_FOOTBALL.queue.retryDelayMinutes;

      const retryDelay = retryDelayMinutes * 60 * 1000;

      await this.queueModel
        .findByIdAndUpdate(
          jobId,
          {
            $set: {
              status: ApiFootballQueueStatus.PENDING,
              error: message,
              nextAttemptAt: new Date(Date.now() + retryDelay),
            },

            $unset: {
              startedAt: 1,
            },
          },
          {
            new: true,
          },
        )
        .exec();
    } else {
      const now = new Date();

      await this.queueModel
        .findByIdAndUpdate(
          jobId,
          {
            $set: {
              status: ApiFootballQueueStatus.FAILED,
              error: message,
              completedAt: now,
              processedAt: now,
            },

            $unset: {
              startedAt: 1,
              nextAttemptAt: 1,
            },
          },
          {
            new: true,
          },
        )
        .exec();
    }

    this.logger.warn(
      `API-Football job ${jobId} ${
        shouldRetry ? 'will retry' : 'failed permanently'
      }: ${message}`,
    );
  }

  async markFailed(jobId: string, error: unknown): Promise<void> {
    await this.failJob(jobId, error);
  }

  // ============================================================
  // PROCESS NEXT JOB
  // ============================================================

  async processNextJob(
    processor: (job: ApiFootballQueueDocument) => Promise<void>,
  ): Promise<boolean> {
    const job = await this.getNextJob();

    if (!job) {
      return false;
    }

    try {
      await processor(job);

      await this.completeJob(job._id.toString());

      return true;
    } catch (error) {
      await this.failJob(job._id.toString(), error);

      return false;
    }
  }

  // ============================================================
  // DAILY QUOTA
  // ============================================================

  async getDailyProcessedCount(): Promise<number> {
    return this.rateLimitService.getDailyUsage('api-football');
  }

  async getRemainingDailyQuota(): Promise<number> {
    const remaining =
      await this.rateLimitService.getRemainingDailyRequests('api-football');

    /*
     * Fail closed if Redis/quota state is unavailable.
     */
    if (remaining === null || remaining === undefined) {
      return 0;
    }

    return Math.max(0, Math.min(remaining, this.dailyRequestLimit));
  }

  // ============================================================
  // STALE JOB RECOVERY
  // ============================================================

  async requeueStaleProcessingJobs(staleMinutes = 30): Promise<number> {
    const cutoff = new Date(Date.now() - staleMinutes * 60 * 1000);

    /*
     * Jobs that still have attempts available can return to PENDING.
     *
     * Jobs already at maxAttempts are permanently failed instead.
     */
    const retryResult = await this.queueModel
      .updateMany(
        {
          status: ApiFootballQueueStatus.PROCESSING,

          startedAt: {
            $lt: cutoff,
          },

          $expr: {
            $lt: ['$attempts', '$maxAttempts'],
          },
        },
        {
          $set: {
            status: ApiFootballQueueStatus.PENDING,
            nextAttemptAt: new Date(),
            error: 'Recovered from stale processing state',
          },

          $unset: {
            startedAt: 1,
          },
        },
      )
      .exec();

    const failedResult = await this.queueModel
      .updateMany(
        {
          status: ApiFootballQueueStatus.PROCESSING,

          startedAt: {
            $lt: cutoff,
          },

          $expr: {
            $gte: ['$attempts', '$maxAttempts'],
          },
        },
        {
          $set: {
            status: ApiFootballQueueStatus.FAILED,
            completedAt: new Date(),
            processedAt: new Date(),
            error: 'Processing became stale after maximum attempts',
          },

          $unset: {
            startedAt: 1,
            nextAttemptAt: 1,
          },
        },
      )
      .exec();

    const recovered = retryResult.modifiedCount + failedResult.modifiedCount;

    if (recovered > 0) {
      this.logger.warn(
        `Recovered ${retryResult.modifiedCount} stale API-Football job(s); ` +
          `${failedResult.modifiedCount} exceeded maximum attempts`,
      );
    }

    return recovered;
  }

  // ============================================================
  // OLD JOB CLEANUP
  // ============================================================

  async removeOldCompletedJobs(olderThanDays = 30): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    const result = await this.queueModel
      .deleteMany({
        status: {
          $in: [
            ApiFootballQueueStatus.COMPLETED,
            ApiFootballQueueStatus.FAILED,
          ],
        },

        $or: [
          {
            completedAt: {
              $lt: cutoff,
            },
          },
          {
            completedAt: {
              $exists: false,
            },

            updatedAt: {
              $lt: cutoff,
            },
          },
        ],
      })
      .exec();

    return result.deletedCount ?? 0;
  }

  // ============================================================
  // LEGACY CLEANUP
  // ============================================================

  async cleanupCompletedJobs(): Promise<void> {
    await this.removeOldCompletedJobs(7);
  }

  // ============================================================
  // LEGACY STALE RECOVERY
  // ============================================================

  async recoverStaleJobs(): Promise<void> {
    await this.requeueStaleProcessingJobs(10);
  }
}
