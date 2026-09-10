// src/predictions/enums/prediction-market-options.ts

import { PredictionMarket, PredictionMarkets } from './prediction-markets';

// ============================================================
// TYPES
// ============================================================

export interface PredictionSelectionOption {
  label: string;
  value: string;
}

export interface PredictionMarketOption {
  label: string;
  value: PredictionMarket;
  selections: PredictionSelectionOption[];
}

// ============================================================
// CANONICAL MARKET CONFIGURATION
// ============================================================

export const PredictionMarketOptions: PredictionMarketOption[] = [
  // ==========================================================
  // GOALS O/U
  // ==========================================================

  {
    label: 'Goals O/U',
    value: PredictionMarkets.OVER_UNDER,
    selections: [
      { label: 'Over 0.5', value: 'OVER_0_5' },
      { label: 'Under 0.5', value: 'UNDER_0_5' },

      { label: 'Over 1.5', value: 'OVER_1_5' },
      { label: 'Under 1.5', value: 'UNDER_1_5' },

      { label: 'Over 2.5', value: 'OVER_2_5' },
      { label: 'Under 2.5', value: 'UNDER_2_5' },

      { label: 'Over 3.5', value: 'OVER_3_5' },
      { label: 'Under 3.5', value: 'UNDER_3_5' },

      { label: 'Over 4.5', value: 'OVER_4_5' },
      { label: 'Under 4.5', value: 'UNDER_4_5' },

      { label: 'Over 5.5', value: 'OVER_5_5' },
      { label: 'Under 5.5', value: 'UNDER_5_5' },

      { label: 'Over 6.5', value: 'OVER_6_5' },
      { label: 'Under 6.5', value: 'UNDER_6_5' },

      { label: 'Over 7.5', value: 'OVER_7_5' },
      { label: 'Under 7.5', value: 'UNDER_7_5' },
    ],
  },

  // ==========================================================
  // BOTH TEAMS TO SCORE
  // ==========================================================

  {
    label: 'BTTS',
    value: PredictionMarkets.BOTH_TEAMS_TO_SCORE,
    selections: [
      { label: 'Yes', value: 'BTTS_YES' },
      { label: 'No', value: 'BTTS_NO' },
    ],
  },

  // ==========================================================
  // DOUBLE CHANCE
  // ==========================================================

  {
    label: 'Double Chance',
    value: PredictionMarkets.DOUBLE_CHANCE,
    selections: [
      { label: '1X — Home or Draw', value: 'HOME_DRAW' },
      { label: 'X2 — Draw or Away', value: 'DRAW_AWAY' },
      { label: '12 — Home or Away', value: 'HOME_AWAY' },
    ],
  },

  // ==========================================================
  // DRAW NO BET
  // ==========================================================

  {
    label: 'Draw No Bet',
    value: PredictionMarkets.DRAW_NO_BET,
    selections: [
      { label: 'Home', value: 'HOME' },
      { label: 'Away', value: 'AWAY' },
    ],
  },

  // ==========================================================
  // GOAL RANGE
  // ==========================================================

  {
    label: 'Goal Range',
    value: PredictionMarkets.GOAL_RANGE,
    selections: [
      { label: '0–1 Goals', value: 'GOALS_0_1' },
      { label: '2–3 Goals', value: 'GOALS_2_3' },
      { label: '4–5 Goals', value: 'GOALS_4_5' },
      { label: '6–7 Goals', value: 'GOALS_6_7' },
      { label: '8+ Goals', value: 'GOALS_8_PLUS' },
    ],
  },

  // ==========================================================
  // TEAM TOTAL GOALS
  // ==========================================================

  {
    label: 'Team Goals',
    value: PredictionMarkets.TEAM_TOTAL_GOALS,
    selections: [
      // HOME
      { label: 'Home Over 0.5', value: 'HOME_OVER_0_5' },
      { label: 'Home Under 0.5', value: 'HOME_UNDER_0_5' },

      { label: 'Home Over 1.5', value: 'HOME_OVER_1_5' },
      { label: 'Home Under 1.5', value: 'HOME_UNDER_1_5' },

      { label: 'Home Over 2.5', value: 'HOME_OVER_2_5' },
      { label: 'Home Under 2.5', value: 'HOME_UNDER_2_5' },

      { label: 'Home Over 3.5', value: 'HOME_OVER_3_5' },
      { label: 'Home Under 3.5', value: 'HOME_UNDER_3_5' },

      { label: 'Home Over 4.5', value: 'HOME_OVER_4_5' },
      { label: 'Home Under 4.5', value: 'HOME_UNDER_4_5' },

      // AWAY
      { label: 'Away Over 0.5', value: 'AWAY_OVER_0_5' },
      { label: 'Away Under 0.5', value: 'AWAY_UNDER_0_5' },

      { label: 'Away Over 1.5', value: 'AWAY_OVER_1_5' },
      { label: 'Away Under 1.5', value: 'AWAY_UNDER_1_5' },

      { label: 'Away Over 2.5', value: 'AWAY_OVER_2_5' },
      { label: 'Away Under 2.5', value: 'AWAY_UNDER_2_5' },

      { label: 'Away Over 3.5', value: 'AWAY_OVER_3_5' },
      { label: 'Away Under 3.5', value: 'AWAY_UNDER_3_5' },

      { label: 'Away Over 4.5', value: 'AWAY_OVER_4_5' },
      { label: 'Away Under 4.5', value: 'AWAY_UNDER_4_5' },
    ],
  },

  // ==========================================================
  // ASIAN HANDICAP
  // ==========================================================

  {
    label: 'Asian Handicap',
    value: PredictionMarkets.ASIAN_HANDICAP,
    selections: [
      // HOME
      { label: 'Home -3.5', value: 'HOME_MINUS_3_5' },
      { label: 'Home -3', value: 'HOME_MINUS_3' },
      { label: 'Home -2.5', value: 'HOME_MINUS_2_5' },
      { label: 'Home -2', value: 'HOME_MINUS_2' },
      { label: 'Home -1.5', value: 'HOME_MINUS_1_5' },
      { label: 'Home -1', value: 'HOME_MINUS_1' },
      { label: 'Home -0.5', value: 'HOME_MINUS_0_5' },
      { label: 'Home +0.5', value: 'HOME_PLUS_0_5' },
      { label: 'Home +1', value: 'HOME_PLUS_1' },
      { label: 'Home +1.5', value: 'HOME_PLUS_1_5' },
      { label: 'Home +2', value: 'HOME_PLUS_2' },
      { label: 'Home +2.5', value: 'HOME_PLUS_2_5' },
      { label: 'Home +3', value: 'HOME_PLUS_3' },
      { label: 'Home +3.5', value: 'HOME_PLUS_3_5' },

      // AWAY
      { label: 'Away -3.5', value: 'AWAY_MINUS_3_5' },
      { label: 'Away -3', value: 'AWAY_MINUS_3' },
      { label: 'Away -2.5', value: 'AWAY_MINUS_2_5' },
      { label: 'Away -2', value: 'AWAY_MINUS_2' },
      { label: 'Away -1.5', value: 'AWAY_MINUS_1_5' },
      { label: 'Away -1', value: 'AWAY_MINUS_1' },
      { label: 'Away -0.5', value: 'AWAY_MINUS_0_5' },
      { label: 'Away +0.5', value: 'AWAY_PLUS_0_5' },
      { label: 'Away +1', value: 'AWAY_PLUS_1' },
      { label: 'Away +1.5', value: 'AWAY_PLUS_1_5' },
      { label: 'Away +2', value: 'AWAY_PLUS_2' },
      { label: 'Away +2.5', value: 'AWAY_PLUS_2_5' },
      { label: 'Away +3', value: 'AWAY_PLUS_3' },
      { label: 'Away +3.5', value: 'AWAY_PLUS_3_5' },
    ],
  },

  // ==========================================================
  // EUROPEAN HANDICAP
  // ==========================================================

  {
    label: 'European Handicap',
    value: PredictionMarkets.EUROPEAN_HANDICAP,
    selections: [
      // HOME
      { label: 'Home -3', value: 'HOME_MINUS_3' },
      { label: 'Home -2', value: 'HOME_MINUS_2' },
      { label: 'Home -1', value: 'HOME_MINUS_1' },
      { label: 'Home 0', value: 'HOME_0' },
      { label: 'Home +1', value: 'HOME_PLUS_1' },
      { label: 'Home +2', value: 'HOME_PLUS_2' },
      { label: 'Home +3', value: 'HOME_PLUS_3' },

      // AWAY
      { label: 'Away -3', value: 'AWAY_MINUS_3' },
      { label: 'Away -2', value: 'AWAY_MINUS_2' },
      { label: 'Away -1', value: 'AWAY_MINUS_1' },
      { label: 'Away 0', value: 'AWAY_0' },
      { label: 'Away +1', value: 'AWAY_PLUS_1' },
      { label: 'Away +2', value: 'AWAY_PLUS_2' },
      { label: 'Away +3', value: 'AWAY_PLUS_3' },
    ],
  },

  // ==========================================================
  // CLEAN SHEET
  // ==========================================================

  {
    label: 'Clean Sheet',
    value: PredictionMarkets.CLEAN_SHEET,
    selections: [
      { label: 'Home Clean Sheet', value: 'HOME_CLEAN_SHEET' },
      { label: 'Away Clean Sheet', value: 'AWAY_CLEAN_SHEET' },
      { label: 'Both Clean Sheets', value: 'BOTH_CLEAN_SHEET' },
      { label: 'Neither Clean Sheet', value: 'NO_CLEAN_SHEET' },
    ],
  },

  // ==========================================================
  // FIRST HALF GOALS
  // ==========================================================

  {
    label: '1H Goals',
    value: PredictionMarkets.FIRST_HALF_GOALS,
    selections: [
      { label: 'Over 0.5', value: 'OVER_0_5' },
      { label: 'Under 0.5', value: 'UNDER_0_5' },

      { label: 'Over 1.5', value: 'OVER_1_5' },
      { label: 'Under 1.5', value: 'UNDER_1_5' },

      { label: 'Over 2.5', value: 'OVER_2_5' },
      { label: 'Under 2.5', value: 'UNDER_2_5' },

      { label: 'Over 3.5', value: 'OVER_3_5' },
      { label: 'Under 3.5', value: 'UNDER_3_5' },

      { label: 'Over 4.5', value: 'OVER_4_5' },
      { label: 'Under 4.5', value: 'UNDER_4_5' },
    ],
  },

  // ==========================================================
  // SECOND HALF GOALS
  // ==========================================================

  {
    label: '2H Goals',
    value: PredictionMarkets.SECOND_HALF_GOALS,
    selections: [
      { label: 'Over 0.5', value: 'OVER_0_5' },
      { label: 'Under 0.5', value: 'UNDER_0_5' },

      { label: 'Over 1.5', value: 'OVER_1_5' },
      { label: 'Under 1.5', value: 'UNDER_1_5' },

      { label: 'Over 2.5', value: 'OVER_2_5' },
      { label: 'Under 2.5', value: 'UNDER_2_5' },

      { label: 'Over 3.5', value: 'OVER_3_5' },
      { label: 'Under 3.5', value: 'UNDER_3_5' },

      { label: 'Over 4.5', value: 'OVER_4_5' },
      { label: 'Under 4.5', value: 'UNDER_4_5' },
    ],
  },

  // ==========================================================
  // BTTS + GOALS / RESULTS
  // ==========================================================

  {
    label: 'BTTS + Goals',
    value: PredictionMarkets.BTTS_GOALS,
    selections: [
      { label: 'BTTS + Over 1.5', value: 'BTTS_OVER_1_5' },
      { label: 'BTTS + Under 1.5', value: 'BTTS_UNDER_1_5' },

      { label: 'BTTS + Over 2.5', value: 'BTTS_OVER_2_5' },
      { label: 'BTTS + Under 2.5', value: 'BTTS_UNDER_2_5' },

      { label: 'BTTS + Over 3.5', value: 'BTTS_OVER_3_5' },
      { label: 'BTTS + Under 3.5', value: 'BTTS_UNDER_3_5' },

      { label: 'BTTS + Over 4.5', value: 'BTTS_OVER_4_5' },
      { label: 'BTTS + Under 4.5', value: 'BTTS_UNDER_4_5' },

      { label: 'BTTS + Home Win', value: 'BTTS_HOME_WIN' },
      { label: 'BTTS + Draw', value: 'BTTS_DRAW' },
      { label: 'BTTS + Away Win', value: 'BTTS_AWAY_WIN' },

      { label: 'BTTS No + Home Win', value: 'NO_BTTS_HOME_WIN' },
      { label: 'BTTS No + Draw', value: 'NO_BTTS_DRAW' },
      { label: 'BTTS No + Away Win', value: 'NO_BTTS_AWAY_WIN' },
    ],
  },
];

// ============================================================
// HELPERS
// ============================================================

export function findPredictionMarket(
  market: string,
): PredictionMarketOption | undefined {
  return PredictionMarketOptions.find((item) => item.value === market);
}

export function isValidPredictionSelection(
  market: string,
  selection: string,
): boolean {
  const option = findPredictionMarket(market);

  if (!option) {
    return false;
  }

  return option.selections.some((item) => item.value === selection);
}
