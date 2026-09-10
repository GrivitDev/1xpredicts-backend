import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  PredictionCalibration,
  PredictionCalibrationDocument,
} from '../schemas/prediction-calibration.schema';

import {
  CalibrationBucket,
  CalibrationMarketSummary,
  CalibrationResult,
} from './calibration.types';

@Injectable()
export class CalibrationService {
  constructor(
    @InjectModel(PredictionCalibration.name)
    private readonly calibrationModel: Model<PredictionCalibrationDocument>,
  ) {}

  async recordResult(result: CalibrationResult): Promise<void> {
    /*
     * Calibration persistence will use the actual schema fields.
     *
     * The schema currently does not contain:
     * - probability
     * - outcome
     * - wasCorrect
     *
     * Therefore we do not write those fields here.
     *
     * Settlement integration will be completed against the final
     * calibration schema rather than inventing new fields.
     */
    void result;
  }

  async getMarketCalibration(
    market: string,
  ): Promise<CalibrationMarketSummary> {
    /*
     * Until the calibration schema contains the settled outcome
     * measurements required for statistical calibration, return
     * a neutral calibration state.
     */
    void market;

    return {
      market,
      sampleSize: 0,
      accuracy: 0,
      brierScore: null,
      calibrationError: null,
    };
  }

  async getAdjustment(market: string, probability: number): Promise<number> {
    void market;
    void probability;

    /*
     * No calibration adjustment is applied until sufficient real
     * settled-result data exists.
     */
    return 0;
  }

  async getBuckets(market: string): Promise<CalibrationBucket[]> {
    void market;

    return [];
  }
}
