// src/prediction/utils/market-key.util.ts

import { PredictionMarket } from '../enums/prediction-market.enum';

export class MarketKeyUtil {
  static marketKey(market: PredictionMarket, selection: string): string {
    return `${market}_${selection}`;
  }

  static handicapKey(selection: string): string {
    return `HANDICAP_${selection}`;
  }

  static resultKey(selection: string): string {
    return `MATCH_${selection}`;
  }

  static bttsKey(selection: string): string {
    return `BOTH_TEAMS_TO_SCORE_${selection}`;
  }

  static halfTimeResultKey(selection: string): string {
    return `HALF_TIME_RESULT_${selection}`;
  }

  static secondHalfResultKey(selection: string): string {
    return `SECOND_HALF_RESULT_${selection}`;
  }

  static firstHalfGoalsKey(selection: string): string {
    return `FIRST_HALF_GOALS_${selection}`;
  }

  static secondHalfGoalsKey(selection: string): string {
    return `SECOND_HALF_GOALS_${selection}`;
  }
}
