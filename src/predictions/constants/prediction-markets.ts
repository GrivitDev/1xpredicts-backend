// ==================================================
// PREDICTION MARKETS ENUM
// ==================================================

export const PredictionMarkets = {
  // ==================================================
  // MATCH RESULT
  // ==================================================

  DOUBLE_CHANCE: 'DOUBLE_CHANCE',
  DRAW_NO_BET: 'DRAW_NO_BET',

  // ==================================================
  // GOALS
  // ==================================================

  OVER_UNDER: 'OVER_UNDER',
  BOTH_TEAMS_TO_SCORE: 'BOTH_TEAMS_TO_SCORE',
  BTTS_GOALS: 'BTTS_GOALS',
  GOAL_RANGE: 'GOAL_RANGE',
  TEAM_TOTAL_GOALS: 'TEAM_TOTAL_GOALS',
  CLEAN_SHEET: 'CLEAN_SHEET',

  // ==================================================
  // HALF GOALS
  // ==================================================

  FIRST_HALF_GOALS: 'FIRST_HALF_GOALS',
  SECOND_HALF_GOALS: 'SECOND_HALF_GOALS',

  // ==================================================
  // HANDICAP
  // ==================================================

  ASIAN_HANDICAP: 'ASIAN_HANDICAP',
  EUROPEAN_HANDICAP: 'EUROPEAN_HANDICAP',
} as const;

export type PredictionMarket =
  (typeof PredictionMarkets)[keyof typeof PredictionMarkets];
