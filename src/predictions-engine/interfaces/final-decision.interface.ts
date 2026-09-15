import { PredictionMarket } from '../enums/prediction-market.enum';
import { PredictionRisk } from '../enums/prediction-risk.enum';
import { PredictionSource } from '../enums/prediction-source.enum';

export interface FinalDecision {
  market: PredictionMarket;

  selection: string;

  probability: number;

  /*
   * Complete normalized 1X2 distribution.
   */
  matchResultProbabilities?: {
    home: number;
    draw: number;
    away: number;
  };

  /*
   * One confidence value for the complete 1X2 market.
   */
  confidence: number;

  safetyScore: number;

  modelAgreement: number;

  dataQuality: number;

  calibrationReliability: number;

  risk: PredictionRisk;

  decisionScore: number;

  source: PredictionSource;

  accepted: boolean;

  rejectionReason?: string;
}
