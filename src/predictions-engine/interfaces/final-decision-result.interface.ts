import { PredictionRisk } from '../enums/prediction-risk.enum';

import { PredictionStatus } from '../enums/prediction-status.enum';

import { FinalMarketCandidate } from './final-market-candidate.interface';

export interface FinalDecisionRecommendation {
  risk: PredictionRisk;

  selection: string;

  label: string;

  probability: number;

  confidence: number;

  odds: number;

  sourceAgreement: number;

  dataQuality: number;

  reasonCodes: string[];
}

export interface FinalMarketDecision {
  market: string;

  status: PredictionStatus;

  candidates: FinalMarketCandidate[];

  low?: FinalDecisionRecommendation;

  medium?: FinalDecisionRecommendation;

  high?: FinalDecisionRecommendation;
}
