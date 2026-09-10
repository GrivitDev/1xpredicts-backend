import { PredictionSignal } from './prediction-signal.interface';

export interface PredictionSourceRun {
  statistical: PredictionSignal;

  grok: PredictionSignal;

  gemini: PredictionSignal;

  completedAt: Date;

  successfulSources: number;

  attemptedSources: number;
}
