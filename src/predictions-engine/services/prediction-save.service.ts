// src/predictions-engine/services/prediction-save.service.ts

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

    this.logger.log(
      `Prediction persistence starting: event=${event.eventId} collection=${this.predictionModel.collection.name} model=${this.predictionModel.modelName} database=${this.predictionModel.db.name} count=${predictions.length}`,
    );

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
            actualOutcome: null,

            settledAt: null,
          },
        },

        upsert: true,
      },
    }));

    let writeResult;

    try {
      writeResult = await this.predictionModel.bulkWrite(operations, {
        ordered: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Prediction bulkWrite failed: event=${event.eventId} error=${message}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw error;
    }

    this.logger.log(
      `Prediction bulkWrite result: event=${event.eventId} matched=${writeResult.matchedCount ?? 0} modified=${writeResult.modifiedCount ?? 0} upserted=${writeResult.upsertedCount ?? 0} inserted=${writeResult.insertedCount ?? 0}`,
    );

    let persistedCount = await this.predictionModel.countDocuments({
      eventId: event.eventId,
    });

    /*
     * Diagnostic fallback.
     *
     * If bulkWrite claims success but no document exists,
     * attempt one ordinary Mongoose create(). This is intended
     * to expose schema/connection/model problems explicitly.
     */
    if (persistedCount === 0) {
      const first = predictions[0];

      this.logger.error(
        `Bulk prediction write produced no document. Attempting direct create for event=${event.eventId} market=${first.market} selection=${first.selection}`,
      );

      try {
        const created = await this.predictionModel.create({
          eventId: first.eventId,

          competitionId: first.competitionId,

          season: first.season,

          fixtureDate: first.fixtureDate,

          homeTeam: {
            id: first.homeTeamId,

            name: first.homeTeamName,
          },

          awayTeam: {
            id: first.awayTeamId,

            name: first.awayTeamName,
          },

          market: first.market,

          selection: first.selection,

          probability: first.probability,

          confidence: first.confidence,

          safetyScore: first.safetyScore,

          modelAgreement: first.modelAgreement,

          dataQuality: first.dataQuality,

          calibrationReliability: first.calibrationReliability,

          risk: first.risk,

          decisionScore: first.decisionScore,

          source: first.source,

          modelVersion: first.modelVersion,

          status: first.status ?? PredictionStatus.ACTIVE,

          actualOutcome: null,

          settledAt: null,

          generatedAt: first.generatedAt,

          settlement: {
            status: 'PENDING',

            actualOutcome: null,

            actualValue: null,

            resultLabel: null,

            finalHomeScore: null,

            finalAwayScore: null,

            halfTimeHomeScore: null,

            halfTimeAwayScore: null,

            source: 'ESPN_FIXTURE',

            settlementVersion: 'settlement-v2',

            settledAt: null,
          },

          metadata: {},
        });

        this.logger.log(
          `Direct prediction create succeeded: event=${event.eventId} id=${String(created._id)}`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        this.logger.error(
          `Direct prediction create failed: event=${event.eventId} error=${message}`,
          error instanceof Error ? error.stack : undefined,
        );

        throw error;
      }

      persistedCount = await this.predictionModel.countDocuments({
        eventId: event.eventId,
      });
    }

    if (persistedCount === 0) {
      throw new Error(
        `Prediction documents were not persisted for event ${event.eventId}. collection=${this.predictionModel.collection.name} database=${this.predictionModel.db.name}`,
      );
    }

    await this.reconcileEvent(event.eventId, predictions);

    await this.savePredictionRun(event, predictions);

    this.logger.log(
      `Prediction persistence completed: event=${event.eventId} predictions=${predictions.length} persisted=${persistedCount}`,
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

            modelVersion: predictions[0]?.modelVersion ?? 'raw-ensemble-v2',

            settlement: {
              status: 'PENDING',

              total: predictions.length,

              settled: 0,

              won: 0,

              lost: 0,

              void: 0,

              settledAt: null,

              source: 'ESPN_FIXTURE',

              settlementVersion: 'settlement-v2',
            },
          },
        },

        {
          upsert: true,

          returnDocument: 'after',

          setDefaultsOnInsert: true,
        },
      )
      .exec();
  }
}
