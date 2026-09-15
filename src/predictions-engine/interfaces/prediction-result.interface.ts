import { PredictionMarket } from '../enums/prediction-market.enum';
import { PredictionRisk } from '../enums/prediction-risk.enum';
import { PredictionSource } from '../enums/prediction-source.enum';
import { PredictionStatus } from '../enums/prediction-status.enum';

export interface PredictionResult {
  eventId: string;
  competitionId: string;
  season: number;
  fixtureDate: Date;

  homeTeamId: string;
  awayTeamId: string;

  homeTeamName: string;
  awayTeamName: string;

  market: PredictionMarket;
  selection: string;

  probability: number;
  confidence: number;

  safetyScore: number;
  modelAgreement: number;
  dataQuality: number;
  calibrationReliability: number;

  risk: PredictionRisk;
  decisionScore: number;

  source: PredictionSource;
  modelVersion: string;

  status?: PredictionStatus;

  generatedAt: Date;
}
