import { PredictionMarket } from '../enums/prediction-market.enum';

import { MarketModelInput } from './market-model-input.interface';
import { ProbabilityModelResult } from './probability-result.interface';

export interface MarketModel {
  readonly market?: PredictionMarket;

  readonly supportedMarkets?: readonly PredictionMarket[];

  supports?(market: PredictionMarket): boolean;

  calculate(input: MarketModelInput): ProbabilityModelResult;
}
