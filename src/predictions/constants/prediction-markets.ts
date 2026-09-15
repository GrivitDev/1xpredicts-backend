// ==================================================
// PREDICTION MARKETS ENUM
// ==================================================

export const PredictionMarkets = {
  // ==================================================
  // PART 1 — CORE MARKETS
  // ==================================================

  DOUBLE_CHANCE: 'DOUBLE_CHANCE',

  DRAW_NO_BET: 'DRAW_NO_BET',

  OVER_UNDER: 'OVER_UNDER',

  BOTH_TEAMS_TO_SCORE: 'BOTH_TEAMS_TO_SCORE',

  GOAL_RANGE: 'GOAL_RANGE',

  TEAM_TOTAL_GOALS: 'TEAM_TOTAL_GOALS',

  EXACT_GOALS: 'EXACT_GOALS',

  CLEAN_SHEET: 'CLEAN_SHEET',

  HALF_TIME_RESULT: 'HALF_TIME_RESULT',

  SECOND_HALF_RESULT: 'SECOND_HALF_RESULT',

  HALF_TIME_FULL_TIME: 'HALF_TIME_FULL_TIME',

  FIRST_HALF_GOALS: 'FIRST_HALF_GOALS',

  SECOND_HALF_GOALS: 'SECOND_HALF_GOALS',

  ASIAN_HANDICAP: 'ASIAN_HANDICAP',

  EUROPEAN_HANDICAP: 'EUROPEAN_HANDICAP',

  // ==================================================
  // PART 2 — SECONDARY MARKETS
  // ==================================================

  BTTS_GOALS: 'BTTS_GOALS',

  CORNERS_TOTAL: 'CORNERS_TOTAL',

  TEAM_CORNERS: 'TEAM_CORNERS',

  CORNER_HANDICAP: 'CORNER_HANDICAP',

  FIRST_HALF_CORNERS: 'FIRST_HALF_CORNERS',

  CARDS_TOTAL: 'CARDS_TOTAL',

  TEAM_CARDS: 'TEAM_CARDS',

  CARD_HANDICAP: 'CARD_HANDICAP',

  FIRST_HALF_CARDS: 'FIRST_HALF_CARDS',

  FIRST_GOAL: 'FIRST_GOAL',

  LAST_GOAL: 'LAST_GOAL',

  WIN_TO_NIL: 'WIN_TO_NIL',

  POSSESSION_WINNER: 'POSSESSION_WINNER',

  MOST_SHOTS: 'MOST_SHOTS',

  MOST_SHOTS_ON_TARGET: 'MOST_SHOTS_ON_TARGET',

  GOAL_TIMING: 'GOAL_TIMING',

  OFFSIDES_TOTAL: 'OFFSIDES_TOTAL',

  TEAM_OFFSIDES: 'TEAM_OFFSIDES',

  FOULS_TOTAL: 'FOULS_TOTAL',

  TEAM_FOULS: 'TEAM_FOULS',
} as const;

export type PredictionMarket =
  (typeof PredictionMarkets)[keyof typeof PredictionMarkets];
