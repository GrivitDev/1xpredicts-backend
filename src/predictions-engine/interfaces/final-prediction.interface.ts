import { PredictionStatus } from '../enums/prediction-status.enum';
import { MarketPrediction } from './market-prediction.interface';
import { PredictionSignal } from './prediction-signal.interface';

export interface FinalMatchProbability {
  home: number;
  draw: number;
  away: number;
  confidence: number;
}

export interface FinalPredictionMetadata {
  engineVersion: string;

  calibrationVersion: string;

  generatedAt: Date;

  completedSources: number;

  availableSources: number;

  sourceAgreement: number;

  dataQuality: number;
}

export interface FinalPrediction {
  fixtureId: number;

  competitionId: string;

  leagueId: number;

  season: number;

  kickoff: Date;

  homeTeam: {
    id: number;
    name: string;
  };

  awayTeam: {
    id: number;
    name: string;
  };

  status: PredictionStatus;

  matchProbability: FinalMatchProbability;

  markets: MarketPrediction[];

  sourceSignals: PredictionSignal[];

  metadata: FinalPredictionMetadata;
}
