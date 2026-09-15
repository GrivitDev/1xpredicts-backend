import { PredictionMarket } from '../enums/prediction-market.enum';
import { PredictionRisk } from '../enums/prediction-risk.enum';
import { PredictionSource } from '../enums/prediction-source.enum';
import { PredictionStatus } from '../enums/prediction-status.enum';

export interface MatchResultProbabilities {
  home: number;
  draw: number;
  away: number;
}

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

  /*
   * Selected outcome.
   *
   * For MATCH_RESULT this is HOME, DRAW or AWAY.
   */
  selection: string;

  /*
   * Probability of the selected outcome.
   */
  probability: number;

  /*
   * Complete 1X2 distribution for MATCH_RESULT.
   */
  matchResultProbabilities?: MatchResultProbabilities;

  /*
   * One confidence value.
   *
   * For MATCH_RESULT this represents the whole 1X2 market.
   */
  confidence: number;

  /*
   * Our calculated fair odds for the selected outcome.
   */
  fairOdds?: number;

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
