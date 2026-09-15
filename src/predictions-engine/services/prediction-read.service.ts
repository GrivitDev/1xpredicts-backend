import { Injectable } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import {
  PredictionEnginePrediction,
  PredictionEnginePredictionDocument,
} from '../schemas/prediction.schema';

import { PredictionStatus } from '../enums/prediction-status.enum';

import { PredictionQuery } from '../interfaces/prediction-query.interface';

import { PredictionListResult } from '../interfaces/prediction-list-result.interface';

@Injectable()
export class PredictionReadService {
  constructor(
    @InjectModel(PredictionEnginePrediction.name)
    private readonly predictionModel: Model<PredictionEnginePredictionDocument>,
  ) {}

  async find(
    query: PredictionQuery = {},
  ): Promise<PredictionListResult<PredictionEnginePredictionDocument>> {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const filter = this.buildFilter(query);

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.predictionModel
        .find(filter)
        .sort({
          fixtureDate: 1,
          confidence: -1,
          generatedAt: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),

      this.predictionModel.countDocuments(filter).exec(),
    ]);

    return {
      data: data,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByEvent(
    eventId: string,
  ): Promise<PredictionEnginePredictionDocument[]> {
    const normalized = this.normalizeRequiredId(eventId);

    return this.predictionModel
      .find({
        eventId: normalized,
      })
      .sort({
        confidence: -1,
        probability: -1,
      })
      .lean()
      .exec();
  }

  async findRun(eventId: string) {
    return this.predictionModel
      .find({
        eventId: this.normalizeRequiredId(eventId),
      })
      .sort({
        confidence: -1,
        probability: -1,
      })
      .lean()
      .exec();
  }

  async findUpcoming(
    limit = 20,
  ): Promise<PredictionEnginePredictionDocument[]> {
    const safeLimit = this.normalizeLimit(limit);

    return this.predictionModel
      .find({
        fixtureDate: {
          $gte: new Date(),
        },
        status: {
          $in: [PredictionStatus.ACTIVE, PredictionStatus.PENDING],
        },
      })
      .sort({
        fixtureDate: 1,
        confidence: -1,
        probability: -1,
      })
      .limit(safeLimit)
      .lean()
      .exec();
  }

  async findSettled(limit = 20): Promise<PredictionEnginePredictionDocument[]> {
    const safeLimit = this.normalizeLimit(limit);

    return this.predictionModel
      .find({
        status: {
          $in: [
            PredictionStatus.WON,
            PredictionStatus.LOST,
            PredictionStatus.VOID,
          ],
        },
      })
      .sort({
        settledAt: -1,
        fixtureDate: -1,
      })
      .limit(safeLimit)
      .lean()
      .exec();
  }

  private buildFilter(query: PredictionQuery): Record<string, unknown> {
    const filter: Record<string, unknown> = {};

    if (query.eventId?.trim()) {
      filter.eventId = query.eventId.trim();
    }

    if (query.competitionId?.trim()) {
      filter.competitionId = query.competitionId.trim().toLowerCase();
    }

    if (query.market) {
      filter.market = query.market;
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.from || query.to) {
      const fixtureDate: Record<string, Date> = {};

      if (query.from) {
        fixtureDate.$gte = query.from;
      }

      if (query.to) {
        fixtureDate.$lt = query.to;
      }

      filter.fixtureDate = fixtureDate;
    }

    return filter;
  }

  private normalizePage(value?: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 1;
    }

    return Math.max(Math.floor(value), 1);
  }

  private normalizeLimit(value?: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 20;
    }

    return Math.min(Math.max(Math.floor(value), 1), 100);
  }

  private normalizeRequiredId(value: string): string {
    return String(value).trim();
  }
}
