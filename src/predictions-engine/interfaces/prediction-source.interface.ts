import { PredictionSource } from '../enums/prediction-source.enum';

import { PredictionStatus } from '../enums/prediction-status.enum';

export interface PredictionSourceStatus {
  source: PredictionSource;

  status: PredictionStatus;

  available: boolean;

  startedAt?: Date;

  completedAt?: Date;

  durationMs?: number;

  errorCode?: string;

  errorMessage?: string;
}

export interface PredictionSourceWeights {
  statistical: number;

  grok: number;

  gemini: number;
}
