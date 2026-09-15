import { Injectable } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import {
  PredictionRun,
  PredictionRunDocument,
} from '../schemas/prediction-run.schema';

@Injectable()
export class PredictionRunReadService {
  constructor(
    @InjectModel(PredictionRun.name)
    private readonly predictionRunModel: Model<PredictionRunDocument>,
  ) {}

  async findByEvent(eventId: string): Promise<PredictionRunDocument | null> {
    return this.predictionRunModel
      .findOne({
        eventId: String(eventId).trim(),
      })
      .lean()
      .exec();
  }

  async findRecent(limit = 20): Promise<PredictionRunDocument[]> {
    const safeLimit = this.normalizeLimit(limit);

    return this.predictionRunModel
      .find({})
      .sort({
        fixtureDate: -1,
        generatedAt: -1,
      })
      .limit(safeLimit)
      .lean()
      .exec();
  }

  async findUpcoming(limit = 20): Promise<PredictionRunDocument[]> {
    const safeLimit = this.normalizeLimit(limit);

    return this.predictionRunModel
      .find({
        fixtureDate: {
          $gte: new Date(),
        },
      })
      .sort({
        fixtureDate: 1,
        generatedAt: -1,
      })
      .limit(safeLimit)
      .lean()
      .exec();
  }

  private normalizeLimit(value?: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 20;
    }

    return Math.min(Math.max(Math.floor(value), 1), 100);
  }
}
