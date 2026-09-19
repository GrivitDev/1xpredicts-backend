import { PredictionMarket } from '../enums/prediction-market.enum';

export type PredictionMeaningfulnessTier = 'BROAD' | 'STANDARD' | 'SPECIFIC';

export interface PredictionMarketCandidate {
  market: PredictionMarket;
  selection: string;
  enabled: boolean;
  meaningfulness: PredictionMeaningfulnessTier;
}

const enabled = true;

export const ENABLED_PREDICTION_MARKETS: PredictionMarketCandidate[] = [
  // ============================================================
  // MATCH RESULT
  // ============================================================

  {
    market: PredictionMarket.MATCH_RESULT,
    selection: 'HOME',
    enabled,
    meaningfulness: 'STANDARD',
  },
  {
    market: PredictionMarket.MATCH_RESULT,
    selection: 'DRAW',
    enabled,
    meaningfulness: 'SPECIFIC',
  },
  {
    market: PredictionMarket.MATCH_RESULT,
    selection: 'AWAY',
    enabled,
    meaningfulness: 'STANDARD',
  },

  // ============================================================
  // DOUBLE CHANCE
  // ============================================================

  {
    market: PredictionMarket.DOUBLE_CHANCE,
    selection: 'HOME_OR_DRAW',
    enabled,
    meaningfulness: 'BROAD',
  },
  {
    market: PredictionMarket.DOUBLE_CHANCE,
    selection: 'AWAY_OR_DRAW',
    enabled,
    meaningfulness: 'BROAD',
  },
  {
    market: PredictionMarket.DOUBLE_CHANCE,
    selection: 'HOME_OR_AWAY',
    enabled,
    meaningfulness: 'BROAD',
  },

  // ============================================================
  // DRAW NO BET
  // ============================================================

  {
    market: PredictionMarket.DRAW_NO_BET,
    selection: 'HOME',
    enabled,
    meaningfulness: 'STANDARD',
  },
  {
    market: PredictionMarket.DRAW_NO_BET,
    selection: 'AWAY',
    enabled,
    meaningfulness: 'STANDARD',
  },

  // ============================================================
  // OVER / UNDER GOALS
  // ============================================================

  {
    market: PredictionMarket.OVER_UNDER,
    selection: 'OVER_1.5',
    enabled,
    meaningfulness: 'STANDARD',
  },
  {
    market: PredictionMarket.OVER_UNDER,
    selection: 'UNDER_1.5',
    enabled,
    meaningfulness: 'STANDARD',
  },
  {
    market: PredictionMarket.OVER_UNDER,
    selection: 'OVER_2.5',
    enabled,
    meaningfulness: 'SPECIFIC',
  },
  {
    market: PredictionMarket.OVER_UNDER,
    selection: 'UNDER_2.5',
    enabled,
    meaningfulness: 'SPECIFIC',
  },
  {
    market: PredictionMarket.OVER_UNDER,
    selection: 'OVER_3.5',
    enabled,
    meaningfulness: 'SPECIFIC',
  },
  {
    market: PredictionMarket.OVER_UNDER,
    selection: 'UNDER_3.5',
    enabled,
    meaningfulness: 'SPECIFIC',
  },
  {
    market: PredictionMarket.OVER_UNDER,
    selection: 'OVER_4.5',
    enabled,
    meaningfulness: 'BROAD',
  },
  {
    market: PredictionMarket.OVER_UNDER,
    selection: 'UNDER_4.5',
    enabled,
    meaningfulness: 'BROAD',
  },

  // ============================================================
  // BOTH TEAMS TO SCORE
  // ============================================================

  {
    market: PredictionMarket.BOTH_TEAMS_TO_SCORE,
    selection: 'YES',
    enabled,
    meaningfulness: 'SPECIFIC',
  },
  {
    market: PredictionMarket.BOTH_TEAMS_TO_SCORE,
    selection: 'NO',
    enabled,
    meaningfulness: 'SPECIFIC',
  },

  // ============================================================
  // GOAL RANGE
  // ============================================================

  {
    market: PredictionMarket.GOAL_RANGE,
    selection: '0-1',
    enabled,
    meaningfulness: 'SPECIFIC',
  },
  {
    market: PredictionMarket.GOAL_RANGE,
    selection: '2',
    enabled,
    meaningfulness: 'SPECIFIC',
  },
  {
    market: PredictionMarket.GOAL_RANGE,
    selection: '3-4',
    enabled,
    meaningfulness: 'SPECIFIC',
  },
  {
    market: PredictionMarket.GOAL_RANGE,
    selection: '5+',
    enabled,
    meaningfulness: 'STANDARD',
  },

  // ============================================================
  // HOME TEAM TOTAL GOALS
  // ============================================================

  {
    market: PredictionMarket.TEAM_TOTAL_GOALS,
    selection: 'HOME_OVER_1.5',
    enabled,
    meaningfulness: 'STANDARD',
  },
  {
    market: PredictionMarket.TEAM_TOTAL_GOALS,
    selection: 'HOME_UNDER_1.5',
    enabled,
    meaningfulness: 'STANDARD',
  },
  {
    market: PredictionMarket.TEAM_TOTAL_GOALS,
    selection: 'HOME_OVER_2.5',
    enabled,
    meaningfulness: 'SPECIFIC',
  },
  {
    market: PredictionMarket.TEAM_TOTAL_GOALS,
    selection: 'HOME_UNDER_2.5',
    enabled,
    meaningfulness: 'SPECIFIC',
  },
  {
    market: PredictionMarket.TEAM_TOTAL_GOALS,
    selection: 'HOME_OVER_3.5',
    enabled,
    meaningfulness: 'SPECIFIC',
  },
  {
    market: PredictionMarket.TEAM_TOTAL_GOALS,
    selection: 'HOME_UNDER_3.5',
    enabled,
    meaningfulness: 'BROAD',
  },

  // ============================================================
  // AWAY TEAM TOTAL GOALS
  // ============================================================

  {
    market: PredictionMarket.TEAM_TOTAL_GOALS,
    selection: 'AWAY_OVER_1.5',
    enabled,
    meaningfulness: 'STANDARD',
  },
  {
    market: PredictionMarket.TEAM_TOTAL_GOALS,
    selection: 'AWAY_UNDER_1.5',
    enabled,
    meaningfulness: 'STANDARD',
  },
  {
    market: PredictionMarket.TEAM_TOTAL_GOALS,
    selection: 'AWAY_OVER_2.5',
    enabled,
    meaningfulness: 'SPECIFIC',
  },
  {
    market: PredictionMarket.TEAM_TOTAL_GOALS,
    selection: 'AWAY_UNDER_2.5',
    enabled,
    meaningfulness: 'SPECIFIC',
  },
  {
    market: PredictionMarket.TEAM_TOTAL_GOALS,
    selection: 'AWAY_OVER_3.5',
    enabled,
    meaningfulness: 'SPECIFIC',
  },
  {
    market: PredictionMarket.TEAM_TOTAL_GOALS,
    selection: 'AWAY_UNDER_3.5',
    enabled,
    meaningfulness: 'BROAD',
  },

  // ============================================================
  // HALF TIME RESULT
  // ============================================================

  {
    market: PredictionMarket.HALF_TIME_RESULT,
    selection: 'HOME',
    enabled,
    meaningfulness: 'STANDARD',
  },
  {
    market: PredictionMarket.HALF_TIME_RESULT,
    selection: 'DRAW',
    enabled,
    meaningfulness: 'SPECIFIC',
  },
  {
    market: PredictionMarket.HALF_TIME_RESULT,
    selection: 'AWAY',
    enabled,
    meaningfulness: 'STANDARD',
  },

  // ============================================================
  // SECOND HALF RESULT
  // ============================================================

  {
    market: PredictionMarket.SECOND_HALF_RESULT,
    selection: 'HOME',
    enabled,
    meaningfulness: 'STANDARD',
  },
  {
    market: PredictionMarket.SECOND_HALF_RESULT,
    selection: 'DRAW',
    enabled,
    meaningfulness: 'SPECIFIC',
  },
  {
    market: PredictionMarket.SECOND_HALF_RESULT,
    selection: 'AWAY',
    enabled,
    meaningfulness: 'STANDARD',
  },

  // ============================================================
  // FIRST HALF GOALS
  // ============================================================

  {
    market: PredictionMarket.FIRST_HALF_GOALS,
    selection: 'OVER_1.5',
    enabled,
    meaningfulness: 'STANDARD',
  },
  {
    market: PredictionMarket.FIRST_HALF_GOALS,
    selection: 'UNDER_1.5',
    enabled,
    meaningfulness: 'STANDARD',
  },
  {
    market: PredictionMarket.FIRST_HALF_GOALS,
    selection: 'OVER_2.5',
    enabled,
    meaningfulness: 'SPECIFIC',
  },
  {
    market: PredictionMarket.FIRST_HALF_GOALS,
    selection: 'UNDER_2.5',
    enabled,
    meaningfulness: 'SPECIFIC',
  },
  {
    market: PredictionMarket.FIRST_HALF_GOALS,
    selection: 'OVER_3.5',
    enabled,
    meaningfulness: 'SPECIFIC',
  },
  {
    market: PredictionMarket.FIRST_HALF_GOALS,
    selection: 'UNDER_3.5',
    enabled,
    meaningfulness: 'BROAD',
  },

  // ============================================================
  // SECOND HALF GOALS
  // ============================================================

  {
    market: PredictionMarket.SECOND_HALF_GOALS,
    selection: 'OVER_1.5',
    enabled,
    meaningfulness: 'STANDARD',
  },
  {
    market: PredictionMarket.SECOND_HALF_GOALS,
    selection: 'UNDER_1.5',
    enabled,
    meaningfulness: 'STANDARD',
  },
  {
    market: PredictionMarket.SECOND_HALF_GOALS,
    selection: 'OVER_2.5',
    enabled,
    meaningfulness: 'SPECIFIC',
  },
  {
    market: PredictionMarket.SECOND_HALF_GOALS,
    selection: 'UNDER_2.5',
    enabled,
    meaningfulness: 'SPECIFIC',
  },
  {
    market: PredictionMarket.SECOND_HALF_GOALS,
    selection: 'OVER_3.5',
    enabled,
    meaningfulness: 'SPECIFIC',
  },
  {
    market: PredictionMarket.SECOND_HALF_GOALS,
    selection: 'UNDER_3.5',
    enabled,
    meaningfulness: 'BROAD',
  },

  // ============================================================
  // ASIAN HANDICAP
  // ============================================================

  {
    market: PredictionMarket.ASIAN_HANDICAP,
    selection: 'HOME_-1.5',
    enabled,
    meaningfulness: 'SPECIFIC',
  },
  {
    market: PredictionMarket.ASIAN_HANDICAP,
    selection: 'AWAY_-1.5',
    enabled,
    meaningfulness: 'SPECIFIC',
  },
  {
    market: PredictionMarket.ASIAN_HANDICAP,
    selection: 'HOME_-1',
    enabled,
    meaningfulness: 'SPECIFIC',
  },
  {
    market: PredictionMarket.ASIAN_HANDICAP,
    selection: 'AWAY_-1',
    enabled,
    meaningfulness: 'SPECIFIC',
  },
  {
    market: PredictionMarket.ASIAN_HANDICAP,
    selection: 'HOME_-0.5',
    enabled,
    meaningfulness: 'STANDARD',
  },
  {
    market: PredictionMarket.ASIAN_HANDICAP,
    selection: 'AWAY_-0.5',
    enabled,
    meaningfulness: 'STANDARD',
  },
  {
    market: PredictionMarket.ASIAN_HANDICAP,
    selection: 'HOME_0.5',
    enabled,
    meaningfulness: 'STANDARD',
  },
  {
    market: PredictionMarket.ASIAN_HANDICAP,
    selection: 'AWAY_0.5',
    enabled,
    meaningfulness: 'STANDARD',
  },
  {
    market: PredictionMarket.ASIAN_HANDICAP,
    selection: 'HOME_1',
    enabled,
    meaningfulness: 'SPECIFIC',
  },
  {
    market: PredictionMarket.ASIAN_HANDICAP,
    selection: 'AWAY_1',
    enabled,
    meaningfulness: 'SPECIFIC',
  },
  {
    market: PredictionMarket.ASIAN_HANDICAP,
    selection: 'HOME_1.5',
    enabled,
    meaningfulness: 'SPECIFIC',
  },
  {
    market: PredictionMarket.ASIAN_HANDICAP,
    selection: 'AWAY_1.5',
    enabled,
    meaningfulness: 'SPECIFIC',
  },

  // ============================================================
  // EUROPEAN HANDICAP
  // ============================================================

  {
    market: PredictionMarket.EUROPEAN_HANDICAP,
    selection: 'HOME_-1',
    enabled,
    meaningfulness: 'SPECIFIC',
  },
  {
    market: PredictionMarket.EUROPEAN_HANDICAP,
    selection: 'DRAW_-1',
    enabled,
    meaningfulness: 'STANDARD',
  },
  {
    market: PredictionMarket.EUROPEAN_HANDICAP,
    selection: 'AWAY_-1',
    enabled,
    meaningfulness: 'SPECIFIC',
  },
  {
    market: PredictionMarket.EUROPEAN_HANDICAP,
    selection: 'HOME_0',
    enabled,
    meaningfulness: 'STANDARD',
  },
  {
    market: PredictionMarket.EUROPEAN_HANDICAP,
    selection: 'DRAW_0',
    enabled,
    meaningfulness: 'STANDARD',
  },
  {
    market: PredictionMarket.EUROPEAN_HANDICAP,
    selection: 'AWAY_0',
    enabled,
    meaningfulness: 'STANDARD',
  },
  {
    market: PredictionMarket.EUROPEAN_HANDICAP,
    selection: 'HOME_1',
    enabled,
    meaningfulness: 'SPECIFIC',
  },
  {
    market: PredictionMarket.EUROPEAN_HANDICAP,
    selection: 'DRAW_1',
    enabled,
    meaningfulness: 'STANDARD',
  },
  {
    market: PredictionMarket.EUROPEAN_HANDICAP,
    selection: 'AWAY_1',
    enabled,
    meaningfulness: 'SPECIFIC',
  },
];
