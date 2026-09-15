import { PredictionMarket } from '../enums/prediction-market.enum';

import { PredictionRisk } from '../enums/prediction-risk.enum';

export interface SafetyResult {
  market: PredictionMarket;

  selection: string;

  safetyScore: number;

  dataRisk: number;

  modelRisk: number;

  marketRisk: number;

  calibrationRisk: number;

  sampleRisk: number;

  risk: PredictionRisk;

  riskScore: number;

  isSafe: boolean;

  reasons: string[];
}
