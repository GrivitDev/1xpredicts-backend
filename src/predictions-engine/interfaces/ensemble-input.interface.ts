import { ProbabilityModelResult } from './probability-result.interface';
import { SafetyResult } from './safety-result.interface';

export interface EnsembleInput {
  probability: ProbabilityModelResult;

  safety: SafetyResult;

  calibrationReliability: number;

  calibrationAdjustment: number;
}
