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
}
