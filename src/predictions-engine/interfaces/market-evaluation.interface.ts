import { PredictionMarket } from '../enums/prediction-market.enum';

import { EnsembleResult } from './ensemble-result.interface';
import { ValueResult } from './value-result.interface';
import { FinalDecision } from './final-decision.interface';

export interface MatchResultProbabilities {
  home: number;
  draw: number;
  away: number;
}

export interface MarketEvaluation {
  market: PredictionMarket;

  candidates: EnsembleResult[];

  valueResults: ValueResult[];

  decision?: FinalDecision;

  matchResultProbabilities?: MatchResultProbabilities;

  matchResultConfidence?: number;

  /*
   * Fair odds belonging to the selected prediction.
   */
  fairOdds?: number;
}
