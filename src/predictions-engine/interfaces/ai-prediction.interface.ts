import { PredictionMarket } from '../enums/prediction-market.enum';

export interface AiMarketDefinition {
  market: PredictionMarket;

  label: string;

  selections: Array<{
    value: string;
    label: string;
  }>;
}

export interface AiPredictionRecommendation {
  market: PredictionMarket;

  selection: string;

  label: string;

  probability: number;

  confidence: number;

  reasonCodes: string[];
}

export interface AiMatchProbability {
  home: number;

  draw: number;

  away: number;
}

export interface AiPredictionResponse {
  matchProbability?: AiMatchProbability;

  recommendations: AiPredictionRecommendation[];

  overallConfidence?: number;

  overallReasonCodes?: string[];
}

export interface AiPredictionRequest {
  fixture: {
    fixtureId: number;

    competitionId: string;

    leagueId: number;

    season: number;

    kickoff: string;

    homeTeam: {
      id: number;
      name: string;
    };

    awayTeam: {
      id: number;
      name: string;
    };
  };

  homeTeamStats: Record<string, unknown> | null;

  awayTeamStats: Record<string, unknown> | null;

  headToHead: Record<string, unknown> | null;

  odds: Record<string, unknown> | null;

  dataQuality: number;

  marketDefinitions: AiMarketDefinition[];
}

export interface AiPredictionEngine {
  generate(
    request: AiPredictionRequest,
  ): Promise<import('./prediction-signal.interface').PredictionSignal>;
}
