import { PredictionMarket } from '../enums/prediction-market.enum';

export interface CalibrationProfile {
  market: PredictionMarket;

  modelVersion: string;

  sampleSize: number;

  averageProbability: number;

  actualSuccessRate: number;

  calibrationError: number;

  reliabilityScore: number;

  adjustment: number;

  confidenceReliability: number;
}
