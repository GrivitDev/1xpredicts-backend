import { PredictionMarket } from '../../predictions/constants/prediction-markets';
import { PredictionSource } from '../enums/prediction-source.enum';
import { PredictionStatus } from '../enums/prediction-status.enum';

export interface PredictionSignalRecommendation {
  market: PredictionMarket;
  selection: string;
  probability: number;
  confidence: number;
  odds: number;
  reasonCodes: string[];
}

export interface PredictionSignal {
  source: PredictionSource;

  status: PredictionStatus;

  generatedAt: Date;

  modelName: string;

  modelVersion: string;

  matchProbability?: {
    home: number;
    draw: number;
    away: number;
  };

  recommendations: PredictionSignalRecommendation[];

  dataQuality?: number;

  errorCode?: string;

  errorMessage?: string;
}
