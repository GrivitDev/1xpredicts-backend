import { PredictionMarket } from '../enums/prediction-market.enum';
import { EnsembleResult } from './ensemble-result.interface';
import { FinalDecision } from './final-decision.interface';

export interface MarketEvaluation {
  market: PredictionMarket;

  candidates: EnsembleResult[];

  decision?: FinalDecision;
}
