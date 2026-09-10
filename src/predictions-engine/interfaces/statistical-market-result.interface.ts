import { PredictionMarket } from '../enums/prediction-market.enum';

export interface StatisticalMarketSelectionResult {
  market: PredictionMarket;

  selection: string;

  label: string;

  probability: number;
}

export interface StatisticalMarketResult {
  market: PredictionMarket;

  selections: StatisticalMarketSelectionResult[];
}
