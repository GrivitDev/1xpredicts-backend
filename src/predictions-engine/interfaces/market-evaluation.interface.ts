import { PredictionMarket } from '../enums/prediction-market.enum';

import { EnsembleResult } from './ensemble-result.interface';
import { FinalDecision } from './final-decision.interface';
import { ValueResult } from './value-result.interface';

export interface MarketEvaluation {
  market: PredictionMarket;

  candidates: EnsembleResult[];

  valueResults: ValueResult[];

  decision?: FinalDecision;
}
