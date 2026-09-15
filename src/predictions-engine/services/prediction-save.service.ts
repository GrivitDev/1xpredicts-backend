import { Injectable, Logger } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Prediction, PredictionDocument } from '../schemas/prediction.schema';

import {
  PredictionRun,
  PredictionRunDocument,
} from '../schemas/prediction-run.schema';

import { PredictionStatus } from '../enums/prediction-status.enum';

import { PredictionResult } from '../interfaces/prediction-result.interface';
import { PredictionRunInput } from '../interfaces/prediction-run.interface';

@Injectable()
export class PredictionSaveService {
  private readonly logger = new Logger(PredictionSaveService.name);

  constructor(
    @InjectModel(Prediction.name)
    private readonly predictionModel: Model<PredictionDocument>,

    @InjectModel(PredictionRun.name)
    private readonly predictionRunModel: Model<PredictionRunDocument>,
  ) {}

  async saveMany(
    event: PredictionRunInput,
    predictions: PredictionResult[],
  ): Promise<void> {
    if (!predictions.length) {
      await this.savePredictionRun(event, []);

      return;
    }

    const operations = predictions.map((prediction) => ({
      updateOne: {
        filter: {
          eventId: prediction.eventId,
          market: prediction.market,
          selection: prediction.selection,
        },
        update: {
          $set: {
            eventId: prediction.eventId,
            competitionId: prediction.competitionId,
            season: prediction.season,
            fixtureDate: prediction.fixtureDate,

            homeTeam: {
              id: prediction.homeTeamId,
              name: prediction.homeTeamName,
            },

            awayTeam: {
              id: prediction.awayTeamId,
              name: prediction.awayTeamName,
            },

            market: prediction.market,
            selection: prediction.selection,

            probability: prediction.probability,
            confidence: prediction.confidence,
            safetyScore: prediction.safetyScore,
            modelAgreement: prediction.modelAgreement,
            dataQuality: prediction.dataQuality,
            calibrationReliability: prediction.calibrationReliability,

            risk: prediction.risk,
            decisionScore: prediction.decisionScore,

            source: prediction.source,
            modelVersion: prediction.modelVersion,

            status: prediction.status ?? PredictionStatus.ACTIVE,

            generatedAt: prediction.generatedAt,
          },

          $setOnInsert: {
            settledAt: null,
            actualOutcome: null,
          },
        },
        upsert: true,
      },
    }));

    await this.predictionModel.bulkWrite(operations, {
      ordered: false,
    });

    await this.reconcileEvent(event.eventId, predictions);

    await this.savePredictionRun(event, predictions);

    this.logger.debug(
      `Saved ${predictions.length} predictions for ${event.eventId}`,
    );
  }

  private async reconcileEvent(
    eventId: string,
    predictions: PredictionResult[],
  ): Promise<void> {
    const acceptedKeys = new Set(
      predictions.map(
        (prediction) => `${prediction.market}:${prediction.selection}`,
      ),
    );

    const existing = await this.predictionModel
      .find({
        eventId,
        status: {
          $nin: [
            PredictionStatus.WON,
            PredictionStatus.LOST,
            PredictionStatus.VOID,
          ],
        },
      })
      .select({
        _id: 1,
        market: 1,
        selection: 1,
      })
      .lean()
      .exec();

    const staleIds = existing
      .filter(
        (prediction) =>
          !acceptedKeys.has(`${prediction.market}:${prediction.selection}`),
      )
      .map((prediction) => prediction._id);

    if (!staleIds.length) {
      return;
    }

    await this.predictionModel
      .updateMany(
        {
          _id: {
            $in: staleIds,
          },
        },
        {
          $set: {
            status: PredictionStatus.CANCELLED,
          },
        },
      )
      .exec();
  }

  private async savePredictionRun(
    event: PredictionRunInput,
    predictions: PredictionResult[],
  ): Promise<void> {
    const runPredictions = predictions.map((prediction) => ({
      market: prediction.market,
      selection: prediction.selection,
      probability: prediction.probability,
      confidence: prediction.confidence,
      predictionId: `${prediction.eventId}:${prediction.market}:${prediction.selection}`,
    }));

    await this.predictionRunModel
      .findOneAndUpdate(
        {
          eventId: event.eventId,
        },
        {
          $set: {
            eventId: event.eventId,
            competitionId: event.competitionId,
            season: event.season,
            fixtureDate: event.fixtureDate,

            homeTeam: event.homeTeam,
            awayTeam: event.awayTeam,

            predictions: runPredictions,

            generatedAt: new Date(),
          },

          $setOnInsert: {
            source: 'STATISTICAL',
            modelVersion: predictions[0]?.modelVersion ?? 'raw-ensemble-v1',

            settlement: {
              status: 'PENDING',
              totals: {
                total: predictions.length,
                settled: 0,
                won: 0,
                lost: 0,
                void: 0,
              },
              source: 'ESPN_FIXTURE',
              settlementVersion: 'settlement-v1',
            },
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      )
      .exec();
  }
}
