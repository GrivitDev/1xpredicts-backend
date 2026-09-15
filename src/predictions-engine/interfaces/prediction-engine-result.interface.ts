import { PredictionResult } from './prediction-result.interface';
import { PredictionRunInput } from './prediction-run.interface';

export interface PredictionEngineResult {
  eventId: string;
  generatedAt: Date;

  run: PredictionRunInput;

  predictions: PredictionResult[];

  marketsProcessed: number;
  accepted: number;
  rejected: number;

  acceptedMarkets: string[];

  lowRiskCount: number;
  mediumRiskCount: number;
  highRiskCount: number;

  strongestPrediction: PredictionResult | null;
}
