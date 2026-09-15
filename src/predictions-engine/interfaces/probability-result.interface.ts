import { PredictionMarket } from '../enums/prediction-market.enum';

export interface ProbabilityModelResult {
  market: PredictionMarket;

  selection: string;

  probability: number;

  supportingProbability?: number;

  /**
   * Independent probability estimates used to determine
   * model agreement.
   *
   * Keys identify different factual/statistical approaches,
   * not different selections of the same output.
   */
  modelOutputs?: Record<string, number>;

  /**
   * Agreement between the independent estimates.
   * 0 = disagreement
   * 1 = strong agreement
   */
  modelAgreement?: number;

  modelSignals: Record<string, number>;

  sampleSize: number;

  dataQuality: number;

  modelReliability: number;

  modelName?: string;

  modelVersion?: string;
}
