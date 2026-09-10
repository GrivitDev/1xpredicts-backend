import { PredictionMarket } from '../enums/prediction-market.enum';

export interface FinalMarketCandidate {
  market: PredictionMarket;

  selection: string;

  label: string;

  probability: number;

  confidence: number;

  odds: number;

  sourceAgreement: number;

  dataQuality: number;

  calibration: number;

  availableSources: number;

  reasonCodes: string[];
}
