import { PredictionMarket } from '../enums/prediction-market.enum';

export interface ProbabilityModelResult {
  market: PredictionMarket;

  selection: string;

  /**
   * Final model probability for the requested selection.
   *
   * Range:
   *   0..1
   */
  probability: number;

  /**
   * Optional supporting probability retained for compatibility
   * with the existing probability pipeline.
   *
   * This must never be treated as an independent model probability
   * unless its source is explicitly identified.
   */
  supportingProbability?: number;

  /**
   * Independent probability estimates used to determine
   * model agreement.
   *
   * Each key identifies a genuinely distinct factual/statistical
   * estimation approach.
   */
  modelOutputs?: Record<string, number>;

  /**
   * Agreement between genuinely independent probability estimates.
   *
   * 0 = disagreement
   * 1 = strong agreement
   */
  modelAgreement?: number;

  /**
   * Additional probability-engine signals.
   *
   * These are evidence/model diagnostics and are not automatically
   * independent probabilities.
   */
  modelSignals: Record<string, number>;

  /**
   * Settlement probabilities for markets where PUSH is possible.
   *
   * Examples:
   *   DRAW_NO_BET
   *   ASIAN_HANDICAP
   *
   * winProbability + pushProbability + lossProbability should
   * represent the complete settlement distribution.
   */
  winProbability?: number;

  pushProbability?: number;

  lossProbability?: number;

  /**
   * Number of observations supporting the model calculation.
   */
  sampleSize: number;

  /**
   * Quality of the underlying input data.
   *
   * Range:
   *   0..100
   */
  dataQuality: number;

  /**
   * Reliability of the probability model.
   *
   * Range:
   *   0..1
   */
  modelReliability: number;

  modelName?: string;

  modelVersion?: string;
}
