import { Injectable, Logger } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  PredictionEnginePrediction,
  PredictionEnginePredictionDocument,
} from '../schemas/prediction.schema';

import { PredictionMarket } from '../enums/prediction-market.enum';
import { PredictionStatus } from '../enums/prediction-status.enum';
import { SettlementStatus } from '../enums/settlement-status.enum';

import { SettlementOutcomeUtil } from '../utils/settlement-outcome.util';

import { EspnSettlementScore } from '../interfaces/espn-settlement-score.interface';

import { CalibrationService } from '../calibration/calibration.service';

@Injectable()
export class PredictionSettlementService {
  private readonly logger = new Logger(PredictionSettlementService.name);

  constructor(
    @InjectModel(PredictionEnginePrediction.name)
    private readonly predictionModel: Model<PredictionEnginePredictionDocument>,

    private readonly calibrationService: CalibrationService,
  ) {}

  async settleEvent(
    eventId: string,
    input: EspnSettlementScore,
  ): Promise<{
    eventId: string;
    total: number;
    settled: number;
    won: number;
    lost: number;
    void: number;
    pending: number;
  }> {
    const normalizedEventId = String(eventId).trim();

    const predictions = await this.predictionModel
      .find({
        eventId: normalizedEventId,
        status: {
          $in: [PredictionStatus.ACTIVE, PredictionStatus.PENDING],
        },
      })
      .exec();

    if (!predictions.length) {
      return {
        eventId: normalizedEventId,
        total: 0,
        settled: 0,
        won: 0,
        lost: 0,
        void: 0,
        pending: 0,
      };
    }

    let settled = 0;
    let won = 0;
    let lost = 0;
    let voidCount = 0;
    let pending = 0;

    const recalibrationKeys = new Set<string>();

    for (const prediction of predictions) {
      /*
       * A settled prediction is never recalculated.
       */
      if (
        prediction.status === PredictionStatus.WON ||
        prediction.status === PredictionStatus.LOST ||
        prediction.status === PredictionStatus.VOID
      ) {
        continue;
      }

      const evaluation = SettlementOutcomeUtil.evaluate(
        prediction.market,
        prediction.selection,
        {
          finalHomeScore: input.finalHomeScore,
          finalAwayScore: input.finalAwayScore,
          halfTimeHomeScore: input.halfTimeHomeScore,
          halfTimeAwayScore: input.halfTimeAwayScore,
        },
      );

      if (evaluation.status === SettlementStatus.PENDING) {
        pending++;
        continue;
      }

      const now = new Date();

      const nextStatus = this.mapSettlementStatus(evaluation.status);

      prediction.status = nextStatus;

      prediction.actualOutcome = evaluation.actualOutcome;

      prediction.settledAt = now;

      prediction.settlement = {
        status: evaluation.status,

        actualOutcome: evaluation.actualOutcome,

        actualValue: evaluation.actualValue,

        resultLabel: evaluation.resultLabel,

        finalHomeScore: input.finalHomeScore,

        finalAwayScore: input.finalAwayScore,

        halfTimeHomeScore: input.halfTimeHomeScore,

        halfTimeAwayScore: input.halfTimeAwayScore,

        source: 'ESPN_FIXTURE',

        settlementVersion: 'settlement-v2',

        settledAt: now,
      };

      await prediction.save();

      settled++;

      if (evaluation.status === SettlementStatus.WON) {
        won++;
      } else if (evaluation.status === SettlementStatus.LOST) {
        lost++;
      } else if (evaluation.status === SettlementStatus.VOID) {
        voidCount++;
      }

      if (
        evaluation.status === SettlementStatus.WON ||
        evaluation.status === SettlementStatus.LOST
      ) {
        recalibrationKeys.add(
          [
            prediction.market,
            prediction.selection,
            prediction.modelVersion,
          ].join('|'),
        );
      }
    }

    for (const key of recalibrationKeys) {
      const [market, selection, modelVersion] = key.split('|');

      await this.calibrationService.rebuild(
        market as PredictionMarket,
        selection,
        modelVersion,
      );
    }

    this.logger.log(
      `Settlement completed: event=${normalizedEventId} total=${predictions.length} settled=${settled} won=${won} lost=${lost} void=${voidCount} pending=${pending}`,
    );

    return {
      eventId: normalizedEventId,
      total: predictions.length,
      settled,
      won,
      lost,
      void: voidCount,
      pending,
    };
  }

  private mapSettlementStatus(status: SettlementStatus): PredictionStatus {
    switch (status) {
      case SettlementStatus.WON:
        return PredictionStatus.WON;

      case SettlementStatus.LOST:
        return PredictionStatus.LOST;

      case SettlementStatus.VOID:
        return PredictionStatus.VOID;

      case SettlementStatus.PENDING:
      default:
        return PredictionStatus.ACTIVE;
    }
  }
}
