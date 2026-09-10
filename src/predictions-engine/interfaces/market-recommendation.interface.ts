import { PredictionRisk } from '../enums/prediction-risk.enum';

export interface MarketRecommendation {
  risk: PredictionRisk;

  selection: string;

  label: string;

  probability: number;

  confidence: number;

  odds: number;

  reasonCodes: string[];

  sourceAgreement: number;

  dataQuality: number;
}
