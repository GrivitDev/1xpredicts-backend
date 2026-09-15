import { Injectable, Logger } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Prediction, PredictionDocument } from '../schemas/prediction.schema';

import {
  PredictionRun,
  PredictionRunDocument,
} from '../schemas/prediction-run.schema';

import { PredictionStatus } from '../enums/prediction-status.enum';
import { SettlementStatus } from '../enums/settlement-status.enum';

@Injectable()
export class PredictionRunSettlementService {
  private readonly logger = new Logger(PredictionRunSettlementService.name);

  constructor(
    @InjectModel(PredictionRun.name)
    private readonly predictionRunModel: Model<PredictionRunDocument>,

    @InjectModel(Prediction.name)
    private readonly predictionModel: Model<PredictionDocument>,
  ) {}

  async rebuild(eventId: string): Promise<{
    status: SettlementStatus;
    total: number;
    settled: number;
    won: number;
    lost: number;
    void: number;
    settledAt: Date | null;
  }> {
    const run = await this.predictionRunModel
      .findOne({
        eventId,
      })
      .exec();

    if (!run) {
      throw new Error(`Prediction run not found for ${eventId}.`);
    }

    const predictions = await this.predictionModel
      .find({
        eventId,
        status: {
          $in: [
            PredictionStatus.WON,
            PredictionStatus.LOST,
            PredictionStatus.VOID,
            PredictionStatus.ACTIVE,
            PredictionStatus.PENDING,
          ],
        },
      })
      .select({
        status: 1,
      })
      .lean()
      .exec();

    const total = predictions.length;

    const won = predictions.filter(
      (prediction) => prediction.status === PredictionStatus.WON,
    ).length;

    const lost = predictions.filter(
      (prediction) => prediction.status === PredictionStatus.LOST,
    ).length;

    const voidCount = predictions.filter(
      (prediction) => prediction.status === PredictionStatus.VOID,
    ).length;

    const settled = won + lost + voidCount;

    const pending = total - settled;

    let status: SettlementStatus;

    if (total === 0) {
      status = SettlementStatus.PENDING;
    } else if (pending > 0) {
      status = SettlementStatus.PENDING;
    } else if (won === 0 && lost === 0 && voidCount > 0) {
      status = SettlementStatus.VOID;
    } else {
      /*
       * The run is fully settled regardless of whether
       * individual predictions have mixed outcomes.
       */
      status = SettlementStatus.PARTIAL;
    }

    const settledAt = pending === 0 && total > 0 ? new Date() : null;

    run.settlement = {
      status,

      total,

      settled,

      won,

      lost,

      void: voidCount,

      settledAt,

      source: 'ESPN_FIXTURE',

      settlementVersion: 'settlement-v2',
    };

    await run.save();

    this.logger.debug(
      `Prediction run settlement rebuilt: event=${eventId} total=${total} settled=${settled} won=${won} lost=${lost} void=${voidCount}`,
    );

    return {
      status,
      total,
      settled,
      won,
      lost,
      void: voidCount,
      settledAt,
    };
  }
}
