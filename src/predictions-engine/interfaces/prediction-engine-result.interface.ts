import { FinalPrediction } from './final-prediction.interface';
import { PredictionSourceRun } from './prediction-source-run.interface';

export interface PredictionEngineResult {
  prediction: FinalPrediction;

  sourceRuns: PredictionSourceRun[];

  generatedAt: Date;

  processingTimeMs: number;
}
