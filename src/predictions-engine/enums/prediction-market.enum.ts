// src/prediction/enums/prediction-market.enum.ts

export enum PredictionMarket {
  // ============================================================
  // MATCH RESULT
  // ============================================================

  MATCH_RESULT = 'MATCH_RESULT',
  DOUBLE_CHANCE = 'DOUBLE_CHANCE',
  DRAW_NO_BET = 'DRAW_NO_BET',

  // ============================================================
  // GOALS
  // ============================================================

  OVER_UNDER = 'OVER_UNDER',
  BOTH_TEAMS_TO_SCORE = 'BOTH_TEAMS_TO_SCORE',
  GOAL_RANGE = 'GOAL_RANGE',
  TEAM_TOTAL_GOALS = 'TEAM_TOTAL_GOALS',

  // ============================================================
  // HALF / MATCH PERIODS
  // ============================================================

  HALF_TIME_RESULT = 'HALF_TIME_RESULT',
  SECOND_HALF_RESULT = 'SECOND_HALF_RESULT',
  FIRST_HALF_GOALS = 'FIRST_HALF_GOALS',
  SECOND_HALF_GOALS = 'SECOND_HALF_GOALS',

  // ============================================================
  // HANDICAPS
  // ============================================================

  ASIAN_HANDICAP = 'ASIAN_HANDICAP',
  EUROPEAN_HANDICAP = 'EUROPEAN_HANDICAP',
}
