import { PredictionMarket } from '../enums/prediction-market.enum';

export interface OddsResult {
  market: PredictionMarket;

  selection: string;

  modelProbability: number;

  fairOdds: number | null;

  winProbability?: number;

  pushProbability?: number;

  lossProbability?: number;

  pricingMethod: 'PROBABILITY' | 'ASIAN_HANDICAP' | 'UNAVAILABLE';
}
