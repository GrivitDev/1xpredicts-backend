import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Prediction, PredictionDocument } from '../schemas/prediction.schema';

type SettlementResult = 'HOME' | 'AWAY' | 'DRAW' | 'VOID';

@Injectable()
export class SettlementService {
  constructor(
    @InjectModel(Prediction.name)
    private readonly predictionModel: Model<PredictionDocument>,
  ) {}

  // ============================================================
  // MANUAL SETTLEMENT
  // ============================================================

  async settlePrediction(id: string, actualResult: SettlementResult) {
    const prediction = await this.predictionModel.findById(id);

    if (!prediction || prediction.deleted) {
      throw new NotFoundException('Prediction not found');
    }

    if (prediction.settled) {
      throw new BadRequestException('Prediction already settled');
    }

    if (actualResult === 'VOID') {
      prediction.status = 'void';
    } else {
      prediction.status =
        prediction.prediction === actualResult ? 'won' : 'lost';
    }

    prediction.settled = true;
    prediction.settledAt = new Date();

    return prediction.save();
  }

  // ============================================================
  // AUTOMATIC SETTLEMENT
  //
  // Temporarily disabled.
  //
  // Settlement will be rebuilt later using the new sports
  // data architecture.
  // ============================================================

  settlePendingPredictions() {
    return {
      processed: 0,
      settled: 0,
      skipped: 0,
      disabled: true,
      message:
        'Automatic settlement is temporarily disabled while the settlement system is being rebuilt.',
    };
  }

  // ============================================================
  // DETERMINE MATCH RESULT
  // ============================================================

  private determineResult(
    homeScore: number,
    awayScore: number,
  ): Exclude<SettlementResult, 'VOID'> {
    if (homeScore > awayScore) {
      return 'HOME';
    }

    if (awayScore > homeScore) {
      return 'AWAY';
    }

    return 'DRAW';
  }
}
