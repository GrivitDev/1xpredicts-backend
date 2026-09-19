import { PredictionMeaningfulnessTier } from '../config/prediction-markets.config';
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
   *
   * This is the model-estimated probability and is completely
   * independent from confidence.
   */
  probability: number;

  /*
   * Complete 1X2 distribution for MATCH_RESULT.
   */
  matchResultProbabilities?: MatchResultProbabilities;

  /*
   * Confidence in the probability estimate.
   *
   * Confidence measures how much the system trusts the
   * probability estimate. It is NOT another probability.
   */
  confidence: number;

  /*
   * Configured informational specificity of the selected
   * prediction.
   *
   * BROAD    = broader outcome
   * STANDARD = normal prediction specificity
   * SPECIFIC = more specific/actionable outcome
   *
   * This does not mean that SPECIFIC has a higher probability
   * of winning.
   */
  meaningfulness: PredictionMeaningfulnessTier;

  /*
   * Our calculated fair odds for the selected outcome.
   *
   * These are derived exclusively from our own model probability.
   * They are not bookmaker odds and do not represent external
   * betting value.
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
