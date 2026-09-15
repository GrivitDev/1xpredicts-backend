import { PredictionMarket } from '../enums/prediction-market.enum';

export interface ValueResult {
  market: PredictionMarket;

  selection: string;

  availableOdds?: number;

  impliedProbability?: number;

  modelProbability: number;

  probabilityEdge?: number;

  expectedValue?: number;

  valueScore?: number;

  hasValue: boolean;
}
