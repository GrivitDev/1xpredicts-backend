// src/predictions-engine/interfaces/ensemble-input.interface.ts

import { ProbabilityModelResult } from './probability-result.interface';
import { SafetyResult } from './safety-result.interface';

export interface EnsembleInput {
  probability: ProbabilityModelResult;

  safety: SafetyResult;

  calibrationReliability: number;

  calibrationAdjustment: number;

  calibrationError?: number;

  /*
   * Team-comparison evidence propagated from the probability layer.
   */
  comparisonConfidence?: number;

  directionalDifference?: number;

  goalProductionDifference?: number;

  goalPreventionDifference?: number;

  evidenceCoherence?: number;
}
