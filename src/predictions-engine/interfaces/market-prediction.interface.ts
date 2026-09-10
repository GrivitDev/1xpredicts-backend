import { PredictionMarket } from '../../predictions/constants/prediction-markets';
import { PredictionStatus } from '../enums/prediction-status.enum';
import { MarketRecommendation } from './market-recommendation.interface';

export interface MarketSelectionProbability {
  selection: string;

  label: string;

  probability: number;

  confidence: number;

  odds: number;
}

export interface MarketPrediction {
  market: PredictionMarket;

  status: PredictionStatus;

  selections: MarketSelectionProbability[];

  recommendations: {
    low?: MarketRecommendation;
    medium?: MarketRecommendation;
    high?: MarketRecommendation;
  };
}
