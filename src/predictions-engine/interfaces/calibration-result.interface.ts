import { PredictionMarket } from '../enums/prediction-market.enum';

export interface CalibrationResult {
  market: PredictionMarket;
  selection: string;
  modelVersion: string;

  sampleSize: number;

  averageProbability: number;
  actualSuccessRate: number;

  calibrationError: number;
  adjustment: number;

  reliabilityScore: number;
  confidenceReliability: number;

  shouldAdjust: boolean;
}
