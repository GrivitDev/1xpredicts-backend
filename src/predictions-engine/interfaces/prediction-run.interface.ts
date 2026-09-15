import { PredictionMarket } from '../enums/prediction-market.enum';

export interface MatchResultProbabilities {
  home: number;
  draw: number;
  away: number;
}

export interface PredictionRunItemInput {
  market: PredictionMarket;

  selection: string;

  probability: number;

  confidence: number;

  predictionId: string;

  fairOdds?: number;

  matchResultProbabilities?: MatchResultProbabilities;
}

export interface PredictionRunInput {
  eventId: string;

  competitionId: string;

  season: number;

  fixtureDate: Date;

  homeTeam: {
    id: string;
    name: string;
  };

  awayTeam: {
    id: string;
    name: string;
  };

  source?: string;

  modelVersion?: string;

  predictions?: PredictionRunItemInput[];
}
