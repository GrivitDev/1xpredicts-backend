import { PredictionMarket } from '../enums/prediction-market.enum';

import { RawPredictionFeatures } from './raw-prediction-features.interface';

export interface MarketModelInput {
  features: RawPredictionFeatures;

  market: PredictionMarket;

  selection: string;

  calibrationAdjustment?: number;
}
