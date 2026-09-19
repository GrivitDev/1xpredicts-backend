import { PredictionMarket } from '../enums/prediction-market.enum';
import { PredictionRisk } from '../enums/prediction-risk.enum';
import { PredictionMeaningfulnessTier } from '../config/prediction-markets.config';

export interface MarketCandidate {
  market: PredictionMarket;

  selection: string;

  probability: number;

  confidence: number;

  safetyScore: number;

  modelAgreement: number;

  dataQuality: number;

  calibrationReliability: number;

  meaningfulness: PredictionMeaningfulnessTier;

  risk: PredictionRisk;

  decisionScore: number;

  riskScore: number;

  eligible: boolean;

  rejectionReason?: string;
}
