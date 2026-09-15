import { PredictionMarket } from '../enums/prediction-market.enum';

export interface MarketModelSelection {
  market: PredictionMarket;

  selection: string;

  probability: number;

  confidence: number;

  score: number;
}
