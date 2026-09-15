import { Injectable, Logger } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Prediction, PredictionDocument } from '../schemas/prediction.schema';

import {
  PredictionCalibration,
  PredictionCalibrationDocument,
} from '../schemas/prediction-calibration.schema';

import { PredictionStatus } from '../enums/prediction-status.enum';

import { CalibrationEngine } from './calibration.engine';
import { PredictionMarket } from '../enums/prediction-market.enum';

@Injectable()
export class CalibrationService {
  private readonly logger = new Logger(CalibrationService.name);

  constructor(
    @InjectModel(Prediction.name)
    private readonly predictionModel: Model<PredictionDocument>,

    @InjectModel(PredictionCalibration.name)
    private readonly calibrationModel: Model<PredictionCalibrationDocument>,

    private readonly calibrationEngine: CalibrationEngine,
  ) {}

  async rebuild(
    market: PredictionMarket,
    selection: string,
    modelVersion: string,
  ): Promise<PredictionCalibrationDocument> {
    const predictions = await this.predictionModel
      .find({
        market,
        selection,
        modelVersion,
        status: {
          $in: [PredictionStatus.WON, PredictionStatus.LOST],
        },
      })
      .select({
        probability: 1,
        confidence: 1,
        status: 1,
      })
      .lean()
      .exec();

    const sampleSize = predictions.length;

    const wins = predictions.filter(
      (prediction) => prediction.status === PredictionStatus.WON,
    ).length;

    const losses = predictions.filter(
      (prediction) => prediction.status === PredictionStatus.LOST,
    ).length;

    const actualSuccessRate = sampleSize > 0 ? wins / sampleSize : 0;

    const averageProbability =
      sampleSize > 0
        ? predictions.reduce(
            (sum, prediction) => sum + this.clamp(prediction.probability, 0, 1),
            0,
          ) / sampleSize
        : 0;

    const averageConfidence =
      sampleSize > 0
        ? predictions.reduce(
            (sum, prediction) => sum + this.clamp(prediction.confidence, 0, 98),
            0,
          ) / sampleSize
        : 0;

    const result = this.calibrationEngine.calculate({
      market,
      selection,
      modelVersion,

      sampleSize,
      averageProbability,
      actualSuccessRate,
      averageConfidence,
    });

    const saved = await this.calibrationModel
      .findOneAndUpdate(
        {
          market,
          selection,
          modelVersion,
        },
        {
          $set: {
            market,
            selection,
            modelVersion,

            sampleSize,
            wins,
            losses,

            averageProbability: result.averageProbability,

            actualSuccessRate: result.actualSuccessRate,

            calibrationError: result.calibrationError,

            adjustment: result.adjustment,

            reliabilityScore: result.reliabilityScore,

            confidenceReliability: result.confidenceReliability,

            shouldAdjust: result.shouldAdjust,

            calculatedAt: new Date(),
          },
        },
        {
          upsert: true,
          returnDocument: 'after',
          setDefaultsOnInsert: true,
        },
      )
      .exec();

    if (!saved) {
      throw new Error(
        `Unable to persist calibration for ${market}:${selection ?? 'default'}:${modelVersion}`,
      );
    }

    this.logger.debug(
      `Calibration rebuilt: market=${market} selection=${selection ?? 'default'} model=${modelVersion} sample=${sampleSize} accuracy=${actualSuccessRate.toFixed(4)} error=${result.calibrationError.toFixed(4)}`,
    );

    return saved;
  }

  async rebuildEvent(eventId: string): Promise<void> {
    const predictions = await this.predictionModel
      .find({
        eventId,
        status: {
          $in: [PredictionStatus.WON, PredictionStatus.LOST],
        },
      })
      .select({
        market: 1,
        selection: 1,
        modelVersion: 1,
      })
      .lean()
      .exec();

    const groups = new Map<
      string,
      {
        market: PredictionMarket;
        selection: string;
        modelVersion: string;
      }
    >();

    for (const prediction of predictions) {
      const key = [
        prediction.market,
        prediction.selection ?? '',
        prediction.modelVersion,
      ].join('|');

      if (!groups.has(key)) {
        groups.set(key, {
          market: prediction.market,
          selection: prediction.selection,
          modelVersion: prediction.modelVersion,
        });
      }
    }

    for (const group of groups.values()) {
      await this.rebuild(group.market, group.selection, group.modelVersion);
    }
  }

  async getCalibration(
    market: PredictionMarket,
    selection: string,
    modelVersion: string,
  ): Promise<PredictionCalibrationDocument | null> {
    return this.calibrationModel
      .findOne({
        market,
        selection,
        modelVersion,
      })
      .lean()
      .exec();
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
