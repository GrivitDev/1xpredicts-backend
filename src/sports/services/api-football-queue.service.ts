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

@Injectable()
export class ApiFootballQueueService {
  private readonly logger = new Logger(ApiFootballQueueService.name);

  private readonly maxAttempts = 3;

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

    const successfulJob = await this.queueModel
      .findOne({
        ...identity,
        status: ApiFootballQueueStatus.COMPLETED,
      })
      .sort({
        completedAt: -1,
        updatedAt: -1,
      })
      .exec();

    if (successfulJob) {
      return null;
    }

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
      const retryDelay = Math.min(
        60_000 * Math.pow(2, Math.max(attempts - 1, 0)),
        15 * 60_000,
      );

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

    return remaining ?? 0;
  }

  // ============================================================
  // STALE JOB RECOVERY
  // ============================================================

  async requeueStaleProcessingJobs(staleMinutes = 30): Promise<number> {
    const cutoff = new Date(Date.now() - staleMinutes * 60 * 1000);

    const result = await this.queueModel
      .updateMany(
        {
          status: ApiFootballQueueStatus.PROCESSING,

          startedAt: {
            $lt: cutoff,
          },
        },
        {
          $set: {
            status: ApiFootballQueueStatus.PENDING,
            nextAttemptAt: new Date(),
          },

          $unset: {
            startedAt: 1,
          },
        },
      )
      .exec();

    return result.modifiedCount;
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
