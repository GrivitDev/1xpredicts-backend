import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  PredictionQueue,
  PredictionQueueDocument,
} from '../schemas/prediction-queue.schema';
import { PredictionQueueStatus } from '../enums/prediction-queue-status.enum';

@Injectable()
export class PredictionQueueService {
  constructor(
    @InjectModel(PredictionQueue.name)
    private readonly queueModel: Model<PredictionQueueDocument>,
  ) {}

  async enqueue(
    fixtureId: number,
    kickoffAt: Date,
  ): Promise<PredictionQueueDocument | null> {
    const existing = await this.queueModel
      .findOne({
        fixtureId,
        status: {
          $in: [
            PredictionQueueStatus.PENDING,
            PredictionQueueStatus.PROCESSING,
          ],
        },
      })
      .exec();

    if (existing) {
      return existing;
    }

    const queueItem: Partial<PredictionQueueDocument> = {
      fixtureId,
      kickoff: kickoffAt,
      status: PredictionQueueStatus.PENDING,
      attempts: 0,
    };

    return this.queueModel.create(queueItem);
  }

  async claimNext(limit = 20): Promise<PredictionQueueDocument[]> {
    const claimed: PredictionQueueDocument[] = [];

    for (let index = 0; index < limit; index += 1) {
      const queueItem = await this.queueModel
        .findOneAndUpdate(
          {
            status: PredictionQueueStatus.PENDING,
          },
          {
            $set: {
              status: PredictionQueueStatus.PROCESSING,
              startedAt: new Date(),
              updatedAt: new Date(),
            },
            $inc: {
              attempts: 1,
            },
          },
          {
            new: true,
            sort: {
              kickoffAt: 1,
              createdAt: 1,
            },
          },
        )
        .exec();

      if (!queueItem) {
        break;
      }

      claimed.push(queueItem);
    }

    return claimed;
  }

  async markCompleted(id: string): Promise<void> {
    await this.queueModel.updateOne(
      { _id: id },
      {
        $set: {
          status: PredictionQueueStatus.COMPLETED,
          completedAt: new Date(),
          updatedAt: new Date(),
        },
      },
    );
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.queueModel.updateOne(
      { _id: id },
      {
        $set: {
          status: PredictionQueueStatus.FAILED,
          error,
          updatedAt: new Date(),
        },
      },
    );
  }

  async resetProcessingJobs(): Promise<void> {
    await this.queueModel.updateMany(
      {
        status: PredictionQueueStatus.PROCESSING,
      },
      {
        $set: {
          status: PredictionQueueStatus.PENDING,
          updatedAt: new Date(),
        },
      },
    );
  }
}
