import { PredictionMarket } from '../enums/prediction-market.enum';

export interface MarketSelection {
  market: PredictionMarket;

  selection: string;

  enabled: boolean;
}
