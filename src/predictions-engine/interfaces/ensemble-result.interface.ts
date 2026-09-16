// src/predictions-engine/interfaces/ensemble-result.interface.ts

import { PredictionMarket } from '../enums/prediction-market.enum';

import { ProbabilityModelResult } from './probability-result.interface';
import { SafetyResult } from './safety-result.interface';

export interface EnsembleResult {
  market: PredictionMarket;

  selection: string;

  probability: number;

  confidence: number;

  modelAgreement: number;

  dataQuality: number;

  calibrationReliability: number;

  probabilityResult: ProbabilityModelResult;

  safetyResult: SafetyResult;

  /*
   * Independent model outputs/signals are retained through the
   * ensemble so the final decision layer can inspect the evidence
   * that produced the prediction.
   */
  modelOutputs?: Record<string, number>;

  modelSignals?: Record<string, number>;

  /*
   * Team-comparison evidence propagated through the ensemble.
   */
  comparisonConfidence?: number;

  directionalDifference?: number;

  goalProductionDifference?: number;

  goalPreventionDifference?: number;

  evidenceCoherence?: number;
}
