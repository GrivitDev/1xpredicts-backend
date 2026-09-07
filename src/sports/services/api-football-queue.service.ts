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

import { SportsProviderRateLimitService } from './sports-provider-rate-limit.service';

import { SPORTS_DATA_COLLECTION_CONFIG } from '../config/sports-data-collection.config';

@Injectable()
export class ApiFootballQueueService {
  private readonly maxAttempts =
    SPORTS_DATA_COLLECTION_CONFIG.API_FOOTBALL.queue.maxAttempts;

  private readonly retryDelayMinutes =
    SPORTS_DATA_COLLECTION_CONFIG.API_FOOTBALL.queue.retryDelayMinutes;

  constructor(
    @InjectModel(ApiFootballQueue.name)
    private readonly queueModel: Model<ApiFootballQueueDocument>,

    private readonly rateLimitService: SportsProviderRateLimitService,
  ) {}

  async addJob(job: {
    jobType: ApiFootballQueueJobType;
    competitionId: string;
    apiFootballLeagueId: number;
    season: number;
    collectionDate: string;
    priority?: number;
    scheduledFor?: Date;
  }): Promise<ApiFootballQueueDocument | null> {
    const competitionId = job.competitionId.trim().toLowerCase();

    const existing = await this.queueModel
      .findOne({
        competitionId,
        apiFootballLeagueId: job.apiFootballLeagueId,
        season: job.season,
        collectionDate: job.collectionDate,
        type: job.jobType,
        status: {
          $in: [
            ApiFootballQueueStatus.PENDING,
            ApiFootballQueueStatus.PROCESSING,
          ],
        },
      })
      .lean()
      .exec();

    if (existing) {
      return null;
    }

    try {
      return await this.queueModel.create({
        competitionId,

        apiFootballLeagueId: job.apiFootballLeagueId,

        season: job.season,

        collectionDate: job.collectionDate,

        type: job.jobType,

        priority: job.priority ?? 100,

        status: ApiFootballQueueStatus.PENDING,

        attempts: 0,

        maxAttempts: this.maxAttempts,

        scheduledFor: job.scheduledFor ?? new Date(),
      });
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        return null;
      }

      throw error;
    }
  }

  async getNextJob(): Promise<ApiFootballQueueDocument | null> {
    const remaining = await this.getRemainingDailyRequests();

    if (remaining <= 0) {
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

          returnDocument: 'after',
        },
      )
      .exec();
  }

  async complete(jobId: string): Promise<void> {
    await this.queueModel.updateOne(
      {
        _id: jobId,
      },
      {
        $set: {
          status: ApiFootballQueueStatus.COMPLETED,
          completedAt: new Date(),
          nextAttemptAt: null,
        },

        $unset: {
          lastError: 1,
        },
      },
    );
  }

  async fail(jobId: string, error: string): Promise<void> {
    const job = await this.queueModel.findById(jobId).exec();

    if (!job) {
      return;
    }

    if (job.attempts >= job.maxAttempts) {
      await this.queueModel.updateOne(
        {
          _id: jobId,
        },
        {
          $set: {
            status: ApiFootballQueueStatus.FAILED,
            failedAt: new Date(),
            lastError: error,
            nextAttemptAt: null,
          },
        },
      );

      return;
    }

    await this.queueModel.updateOne(
      {
        _id: jobId,
      },
      {
        $set: {
          status: ApiFootballQueueStatus.PENDING,

          nextAttemptAt: new Date(Date.now() + this.retryDelayMinutes * 60_000),

          lastError: error,
        },
      },
    );
  }

  async recoverStaleJobs(staleMinutes: number): Promise<number> {
    const staleBefore = new Date(Date.now() - staleMinutes * 60_000);

    const result = await this.queueModel.updateMany(
      {
        status: ApiFootballQueueStatus.PROCESSING,

        startedAt: {
          $lte: staleBefore,
        },
      },
      {
        $set: {
          status: ApiFootballQueueStatus.PENDING,
          nextAttemptAt: new Date(),
          lastError: 'Recovered stale processing job',
        },
      },
    );

    return result.modifiedCount;
  }

  async cleanupCompleted(olderThanDays = 7): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    const result = await this.queueModel.deleteMany({
      status: ApiFootballQueueStatus.COMPLETED,

      completedAt: {
        $lt: cutoff,
      },
    });

    return result.deletedCount;
  }

  async getRemainingDailyRequests(): Promise<number> {
    return (
      (await this.rateLimitService.getRemainingDailyRequests('api-football')) ??
      0
    );
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return Boolean(
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: number }).code === 11000,
    );
  }
}
