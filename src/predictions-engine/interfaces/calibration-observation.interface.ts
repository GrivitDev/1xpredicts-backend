import { PredictionMarket } from '../enums/prediction-market.enum';

export interface CalibrationObservation {
  eventId: string;

  market: PredictionMarket;

  selection: string;

  predictedProbability: number;

  predictedConfidence: number;

  actualOutcome: boolean;

  probabilityError: number;

  confidenceBand: number;

  modelVersion: string;

  predictedAt: Date;

  settledAt: Date;
}
