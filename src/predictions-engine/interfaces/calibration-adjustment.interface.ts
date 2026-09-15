import { PredictionMarket } from '../enums/prediction-market.enum';

export interface CalibrationAdjustment {
  market: PredictionMarket;

  modelVersion: string;

  sampleSize: number;

  averagePredictedProbability: number;

  actualSuccessRate: number;

  calibrationError: number;

  adjustment: number;

  reliabilityScore: number;

  shouldAdjust: boolean;
}
