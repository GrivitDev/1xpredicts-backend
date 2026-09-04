import { Injectable } from '@nestjs/common';

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

@Injectable()
export class ApiFootballQueueService {
  private readonly dailyRequestLimit = 100;

  private readonly maxAttempts = 3;

  constructor(
    @InjectModel(ApiFootballQueue.name)
    private readonly queueModel: Model<ApiFootballQueueDocument>,
  ) {}

  // ============================================================
  // ADD JOB
  // ============================================================

  async addJob(job: {
    competitionId: string;
    apiFootballLeagueId?: number;
    season?: number;
    apiFootballTeamId?: number;
    apiFootballFixtureId?: number;
    type: ApiFootballQueueJobType;
    priority: number;
    scheduledFor?: Date;
  }): Promise<{
    job: ApiFootballQueueDocument;
    isNew: boolean;
  }> {
    const existing = await this.queueModel
      .findOne({
        competitionId: job.competitionId,

        apiFootballLeagueId: job.apiFootballLeagueId,

        season: job.season,

        apiFootballTeamId: job.apiFootballTeamId,

        apiFootballFixtureId: job.apiFootballFixtureId,

        type: job.type,

        status: {
          $in: [
            ApiFootballQueueStatus.PENDING,
            ApiFootballQueueStatus.PROCESSING,
          ],
        },
      })
      .exec();

    if (existing) {
      return {
        job: existing,
        isNew: false,
      };
    }

    const created = await this.queueModel.create({
      ...job,

      status: ApiFootballQueueStatus.PENDING,

      attempts: 0,

      scheduledFor: job.scheduledFor ?? new Date(),
    });

    return {
      job: created,
      isNew: true,
    };
  }

  // ============================================================
  // ADD MANY
  // ============================================================

  async addJobs(
    jobs: Array<{
      competitionId: string;
      apiFootballLeagueId?: number;
      season?: number;
      apiFootballTeamId?: number;
      apiFootballFixtureId?: number;
      type: ApiFootballQueueJobType;
      priority: number;
      scheduledFor?: Date;
    }>,
  ): Promise<number> {
    let added = 0;

    for (const job of jobs) {
      const existing = await this.queueModel.exists({
        competitionId: job.competitionId,

        apiFootballLeagueId: job.apiFootballLeagueId,

        season: job.season,

        apiFootballTeamId: job.apiFootballTeamId,

        apiFootballFixtureId: job.apiFootballFixtureId,

        type: job.type,

        status: {
          $in: [
            ApiFootballQueueStatus.PENDING,
            ApiFootballQueueStatus.PROCESSING,
          ],
        },
      });

      if (existing) {
        continue;
      }

      await this.queueModel.create({
        ...job,

        status: ApiFootballQueueStatus.PENDING,

        attempts: 0,

        scheduledFor: job.scheduledFor ?? new Date(),
      });

      added += 1;
    }

    return added;
  }

  // ============================================================
  // GET NEXT JOB
  // ============================================================

  async getNextJob(): Promise<ApiFootballQueueDocument | null> {
    const remaining = await this.getRemainingDailyQuota();

    if (remaining <= 0) {
      return null;
    }

    return this.queueModel
      .findOneAndUpdate(
        {
          status: ApiFootballQueueStatus.PENDING,

          scheduledFor: {
            $lte: new Date(),
          },

          attempts: {
            $lt: this.maxAttempts,
          },
        },
        {
          $set: {
            status: ApiFootballQueueStatus.PROCESSING,
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

          returnDocument: 'after',
        },
      )
      .exec();
  }

  // ============================================================
  // COMPLETE
  // ============================================================

  async markCompleted(jobId: string): Promise<void> {
    await this.queueModel
      .updateOne(
        {
          _id: jobId,
        },
        {
          $set: {
            status: ApiFootballQueueStatus.COMPLETED,

            processedAt: new Date(),

            error: null,
          },
        },
      )
      .exec();
  }

  // ============================================================
  // FAILED
  // ============================================================

  async markFailed(jobId: string, error: string): Promise<void> {
    const job = await this.queueModel.findById(jobId).exec();

    if (!job) {
      return;
    }

    if (job.attempts >= this.maxAttempts) {
      await this.queueModel
        .updateOne(
          {
            _id: jobId,
          },
          {
            $set: {
              status: ApiFootballQueueStatus.FAILED,

              error,

              processedAt: new Date(),
            },
          },
        )
        .exec();

      return;
    }

    await this.queueModel
      .updateOne(
        {
          _id: jobId,
        },
        {
          $set: {
            status: ApiFootballQueueStatus.PENDING,

            scheduledFor: new Date(Date.now() + 15 * 60 * 1000),

            error,
          },
        },
      )
      .exec();
  }

  // ============================================================
  // SKIP
  // ============================================================

  async markSkipped(jobId: string, reason: string): Promise<void> {
    await this.queueModel
      .updateOne(
        {
          _id: jobId,
        },
        {
          $set: {
            status: ApiFootballQueueStatus.SKIPPED,

            error: reason,

            processedAt: new Date(),
          },
        },
      )
      .exec();
  }

  // ============================================================
  // RECOVER STALE JOBS
  // ============================================================

  async requeueStaleProcessingJobs(staleMinutes = 30): Promise<number> {
    const cutoff = new Date(Date.now() - staleMinutes * 60 * 1000);

    const result = await this.queueModel
      .updateMany(
        {
          status: ApiFootballQueueStatus.PROCESSING,

          updatedAt: {
            $lt: cutoff,
          },
        },
        {
          $set: {
            status: ApiFootballQueueStatus.PENDING,

            scheduledFor: new Date(),

            error: 'Requeued after stale processing state',
          },
        },
      )
      .exec();

    return result.modifiedCount;
  }

  // ============================================================
  // DAILY QUOTA
  // ============================================================

  async getDailyProcessedCount(date = new Date()): Promise<number> {
    const start = new Date(date);

    start.setHours(0, 0, 0, 0);

    const end = new Date(start);

    end.setDate(end.getDate() + 1);

    return this.queueModel
      .countDocuments({
        status: ApiFootballQueueStatus.COMPLETED,

        processedAt: {
          $gte: start,
          $lt: end,
        },
      })
      .exec();
  }

  async getRemainingDailyQuota(): Promise<number> {
    const used = await this.getDailyProcessedCount();

    return Math.max(this.dailyRequestLimit - used, 0);
  }

  // ============================================================
  // COUNTS
  // ============================================================

  async getCounts() {
    const [
      pending,
      processing,
      completed,
      failed,
      skipped,
      remainingDailyQuota,
    ] = await Promise.all([
      this.queueModel.countDocuments({
        status: ApiFootballQueueStatus.PENDING,
      }),

      this.queueModel.countDocuments({
        status: ApiFootballQueueStatus.PROCESSING,
      }),

      this.queueModel.countDocuments({
        status: ApiFootballQueueStatus.COMPLETED,
      }),

      this.queueModel.countDocuments({
        status: ApiFootballQueueStatus.FAILED,
      }),

      this.queueModel.countDocuments({
        status: ApiFootballQueueStatus.SKIPPED,
      }),

      this.getRemainingDailyQuota(),
    ]);

    return {
      pending,
      processing,
      completed,
      failed,
      skipped,
      remainingDailyQuota,
    };
  }

  // ============================================================
  // CLEAN OLD JOBS
  // ============================================================

  async removeOldCompletedJobs(days = 30): Promise<number> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await this.queueModel
      .deleteMany({
        status: ApiFootballQueueStatus.COMPLETED,

        processedAt: {
          $lt: cutoff,
        },
      })
      .exec();

    return result.deletedCount ?? 0;
  }
}
