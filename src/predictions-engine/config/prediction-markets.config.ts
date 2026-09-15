import { PredictionMarket } from '../enums/prediction-market.enum';

export interface PredictionMarketCandidate {
  market: PredictionMarket;
  selection: string;
  enabled: boolean;
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
  },
  {
    market: PredictionMarket.MATCH_RESULT,
    selection: 'DRAW',
    enabled,
  },
  {
    market: PredictionMarket.MATCH_RESULT,
    selection: 'AWAY',
    enabled,
  },

  // ============================================================
  // DOUBLE CHANCE
  // ============================================================

  {
    market: PredictionMarket.DOUBLE_CHANCE,
    selection: 'HOME_OR_DRAW',
    enabled,
  },
  {
    market: PredictionMarket.DOUBLE_CHANCE,
    selection: 'AWAY_OR_DRAW',
    enabled,
  },
  {
    market: PredictionMarket.DOUBLE_CHANCE,
    selection: 'HOME_OR_AWAY',
    enabled,
  },

  // ============================================================
  // DRAW NO BET
  // ============================================================

  {
    market: PredictionMarket.DRAW_NO_BET,
    selection: 'HOME',
    enabled,
  },
  {
    market: PredictionMarket.DRAW_NO_BET,
    selection: 'AWAY',
    enabled,
  },

  // ============================================================
  // OVER / UNDER
  // ============================================================

  ...['0.5', '1.5', '2.5', '3.5', '4.5', '5.5'].flatMap((line) => [
    {
      market: PredictionMarket.OVER_UNDER,
      selection: `OVER_${line}`,
      enabled,
    },
    {
      market: PredictionMarket.OVER_UNDER,
      selection: `UNDER_${line}`,
      enabled,
    },
  ]),

  // ============================================================
  // BOTH TEAMS TO SCORE
  // ============================================================

  {
    market: PredictionMarket.BOTH_TEAMS_TO_SCORE,
    selection: 'YES',
    enabled,
  },
  {
    market: PredictionMarket.BOTH_TEAMS_TO_SCORE,
    selection: 'NO',
    enabled,
  },

  // ============================================================
  // BTTS GOALS
  //
  // Retained as a market family, but the exact semantic meaning
  // of 1+, 2+, 3+ will be enforced by the market model.
  // ============================================================

  ...['1+', '2+', '3+'].map((line) => ({
    market: PredictionMarket.BTTS_GOALS,
    selection: line,
    enabled,
  })),

  // ============================================================
  // GOAL RANGE
  // ============================================================

  ...['0', '1-2', '3-4', '5+'].map((selection) => ({
    market: PredictionMarket.GOAL_RANGE,
    selection,
    enabled,
  })),

  // ============================================================
  // TEAM TOTAL GOALS
  // ============================================================

  ...['0.5', '1.5', '2.5', '3.5'].flatMap((line) => [
    {
      market: PredictionMarket.TEAM_TOTAL_GOALS,
      selection: `HOME_OVER_${line}`,
      enabled,
    },
    {
      market: PredictionMarket.TEAM_TOTAL_GOALS,
      selection: `HOME_UNDER_${line}`,
      enabled,
    },
    {
      market: PredictionMarket.TEAM_TOTAL_GOALS,
      selection: `AWAY_OVER_${line}`,
      enabled,
    },
    {
      market: PredictionMarket.TEAM_TOTAL_GOALS,
      selection: `AWAY_UNDER_${line}`,
      enabled,
    },
  ]),

  // ============================================================
  // EXACT TEAM GOALS
  // ============================================================

  ...Array.from({ length: 7 }, (_, goals) => ({
    market: PredictionMarket.EXACT_GOALS,
    selection: `HOME_${goals}`,
    enabled,
  })),

  ...Array.from({ length: 7 }, (_, goals) => ({
    market: PredictionMarket.EXACT_GOALS,
    selection: `AWAY_${goals}`,
    enabled,
  })),

  // ============================================================
  // CLEAN SHEET
  // ============================================================

  {
    market: PredictionMarket.CLEAN_SHEET,
    selection: 'HOME',
    enabled,
  },
  {
    market: PredictionMarket.CLEAN_SHEET,
    selection: 'AWAY',
    enabled,
  },

  // ============================================================
  // HALF TIME RESULT
  // ============================================================

  ...['HOME', 'DRAW', 'AWAY'].map((selection) => ({
    market: PredictionMarket.HALF_TIME_RESULT,
    selection,
    enabled,
  })),

  // ============================================================
  // SECOND HALF RESULT
  // ============================================================

  ...['HOME', 'DRAW', 'AWAY'].map((selection) => ({
    market: PredictionMarket.SECOND_HALF_RESULT,
    selection,
    enabled,
  })),

  // ============================================================
  // HALF TIME / FULL TIME
  // ============================================================

  ...[
    'HOME_HOME',
    'HOME_DRAW',
    'HOME_AWAY',
    'DRAW_HOME',
    'DRAW_DRAW',
    'DRAW_AWAY',
    'AWAY_HOME',
    'AWAY_DRAW',
    'AWAY_AWAY',
  ].map((selection) => ({
    market: PredictionMarket.HALF_TIME_FULL_TIME,
    selection,
    enabled,
  })),

  // ============================================================
  // FIRST HALF GOALS
  // ============================================================

  ...['0.5', '1.5', '2.5', '3.5'].flatMap((line) => [
    {
      market: PredictionMarket.FIRST_HALF_GOALS,
      selection: `OVER_${line}`,
      enabled,
    },
    {
      market: PredictionMarket.FIRST_HALF_GOALS,
      selection: `UNDER_${line}`,
      enabled,
    },
  ]),

  // ============================================================
  // SECOND HALF GOALS
  // ============================================================

  ...['0.5', '1.5', '2.5', '3.5'].flatMap((line) => [
    {
      market: PredictionMarket.SECOND_HALF_GOALS,
      selection: `OVER_${line}`,
      enabled,
    },
    {
      market: PredictionMarket.SECOND_HALF_GOALS,
      selection: `UNDER_${line}`,
      enabled,
    },
  ]),

  // ============================================================
  // FIRST TO SCORE
  // ============================================================

  {
    market: PredictionMarket.FIRST_TO_SCORE,
    selection: 'HOME',
    enabled,
  },
  {
    market: PredictionMarket.FIRST_TO_SCORE,
    selection: 'AWAY',
    enabled,
  },
  {
    market: PredictionMarket.FIRST_TO_SCORE,
    selection: 'NONE',
    enabled,
  },

  // ============================================================
  // ASIAN HANDICAP
  // ============================================================

  ...['-2', '-1.5', '-1', '-0.5', '0', '0.5', '1', '1.5', '2'].map((line) => ({
    market: PredictionMarket.ASIAN_HANDICAP,
    selection: `HOME_${line}`,
    enabled,
  })),

  // ============================================================
  // EUROPEAN HANDICAP
  // ============================================================

  ...['-2', '-1', '0', '1', '2'].flatMap((line) => [
    {
      market: PredictionMarket.EUROPEAN_HANDICAP,
      selection: `HOME_${line}`,
      enabled,
    },
    {
      market: PredictionMarket.EUROPEAN_HANDICAP,
      selection: `DRAW_${line}`,
      enabled,
    },
    {
      market: PredictionMarket.EUROPEAN_HANDICAP,
      selection: `AWAY_${line}`,
      enabled,
    },
  ]),
];
