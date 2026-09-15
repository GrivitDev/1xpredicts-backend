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
  // PART 1 — CORE MARKETS
  // ==========================================================

  // ==========================================================
  // DOUBLE CHANCE
  // ==========================================================

  {
    label: 'Double Chance',
    value: PredictionMarkets.DOUBLE_CHANCE,
    selections: [
      {
        label: '1X — Home or Draw',
        value: 'HOME_DRAW',
      },
      {
        label: 'X2 — Draw or Away',
        value: 'DRAW_AWAY',
      },
      {
        label: '12 — Home or Away',
        value: 'HOME_AWAY',
      },
    ],
  },

  // ==========================================================
  // DRAW NO BET
  // ==========================================================

  {
    label: 'Draw No Bet',
    value: PredictionMarkets.DRAW_NO_BET,
    selections: [
      {
        label: 'Home',
        value: 'HOME',
      },
      {
        label: 'Away',
        value: 'AWAY',
      },
    ],
  },

  // ==========================================================
  // GOALS O/U
  // ==========================================================

  {
    label: 'Goals O/U',
    value: PredictionMarkets.OVER_UNDER,
    selections: [
      {
        label: 'Over 0.5',
        value: 'OVER_0_5',
      },
      {
        label: 'Under 0.5',
        value: 'UNDER_0_5',
      },

      {
        label: 'Over 1.5',
        value: 'OVER_1_5',
      },
      {
        label: 'Under 1.5',
        value: 'UNDER_1_5',
      },

      {
        label: 'Over 2.5',
        value: 'OVER_2_5',
      },
      {
        label: 'Under 2.5',
        value: 'UNDER_2_5',
      },

      {
        label: 'Over 3.5',
        value: 'OVER_3_5',
      },
      {
        label: 'Under 3.5',
        value: 'UNDER_3_5',
      },

      {
        label: 'Over 4.5',
        value: 'OVER_4_5',
      },
      {
        label: 'Under 4.5',
        value: 'UNDER_4_5',
      },

      {
        label: 'Over 5.5',
        value: 'OVER_5_5',
      },
      {
        label: 'Under 5.5',
        value: 'UNDER_5_5',
      },

      {
        label: 'Over 6.5',
        value: 'OVER_6_5',
      },
      {
        label: 'Under 6.5',
        value: 'UNDER_6_5',
      },

      {
        label: 'Over 7.5',
        value: 'OVER_7_5',
      },
      {
        label: 'Under 7.5',
        value: 'UNDER_7_5',
      },
    ],
  },

  // ==========================================================
  // BOTH TEAMS TO SCORE
  // ==========================================================

  {
    label: 'BTTS',
    value: PredictionMarkets.BOTH_TEAMS_TO_SCORE,
    selections: [
      {
        label: 'Yes',
        value: 'BTTS_YES',
      },
      {
        label: 'No',
        value: 'BTTS_NO',
      },
    ],
  },

  // ==========================================================
  // GOAL RANGE
  // ==========================================================

  {
    label: 'Goal Range',
    value: PredictionMarkets.GOAL_RANGE,
    selections: [
      {
        label: '0–1 Goals',
        value: 'GOALS_0_1',
      },
      {
        label: '2–3 Goals',
        value: 'GOALS_2_3',
      },
      {
        label: '4–5 Goals',
        value: 'GOALS_4_5',
      },
      {
        label: '6–7 Goals',
        value: 'GOALS_6_7',
      },
      {
        label: '8+ Goals',
        value: 'GOALS_8_PLUS',
      },
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
      {
        label: 'Home Over 0.5',
        value: 'HOME_OVER_0_5',
      },
      {
        label: 'Home Under 0.5',
        value: 'HOME_UNDER_0_5',
      },

      {
        label: 'Home Over 1.5',
        value: 'HOME_OVER_1_5',
      },
      {
        label: 'Home Under 1.5',
        value: 'HOME_UNDER_1_5',
      },

      {
        label: 'Home Over 2.5',
        value: 'HOME_OVER_2_5',
      },
      {
        label: 'Home Under 2.5',
        value: 'HOME_UNDER_2_5',
      },

      {
        label: 'Home Over 3.5',
        value: 'HOME_OVER_3_5',
      },
      {
        label: 'Home Under 3.5',
        value: 'HOME_UNDER_3_5',
      },

      {
        label: 'Home Over 4.5',
        value: 'HOME_OVER_4_5',
      },
      {
        label: 'Home Under 4.5',
        value: 'HOME_UNDER_4_5',
      },

      // AWAY
      {
        label: 'Away Over 0.5',
        value: 'AWAY_OVER_0_5',
      },
      {
        label: 'Away Under 0.5',
        value: 'AWAY_UNDER_0_5',
      },

      {
        label: 'Away Over 1.5',
        value: 'AWAY_OVER_1_5',
      },
      {
        label: 'Away Under 1.5',
        value: 'AWAY_UNDER_1_5',
      },

      {
        label: 'Away Over 2.5',
        value: 'AWAY_OVER_2_5',
      },
      {
        label: 'Away Under 2.5',
        value: 'AWAY_UNDER_2_5',
      },

      {
        label: 'Away Over 3.5',
        value: 'AWAY_OVER_3_5',
      },
      {
        label: 'Away Under 3.5',
        value: 'AWAY_UNDER_3_5',
      },

      {
        label: 'Away Over 4.5',
        value: 'AWAY_OVER_4_5',
      },
      {
        label: 'Away Under 4.5',
        value: 'AWAY_UNDER_4_5',
      },
    ],
  },

  // ==========================================================
  // EXACT GOALS
  // ==========================================================

  {
    label: 'Exact Goals',
    value: PredictionMarkets.EXACT_GOALS,
    selections: [
      {
        label: '0 Goals',
        value: 'GOALS_0',
      },
      {
        label: '1 Goal',
        value: 'GOALS_1',
      },
      {
        label: '2 Goals',
        value: 'GOALS_2',
      },
      {
        label: '3 Goals',
        value: 'GOALS_3',
      },
      {
        label: '4 Goals',
        value: 'GOALS_4',
      },
      {
        label: '5 Goals',
        value: 'GOALS_5',
      },
      {
        label: '6 Goals',
        value: 'GOALS_6',
      },
      {
        label: '7 Goals',
        value: 'GOALS_7',
      },
      {
        label: '8+ Goals',
        value: 'GOALS_8_PLUS',
      },
    ],
  },

  // ==========================================================
  // CLEAN SHEET
  // ==========================================================

  {
    label: 'Clean Sheet',
    value: PredictionMarkets.CLEAN_SHEET,
    selections: [
      {
        label: 'Home Clean Sheet',
        value: 'HOME_CLEAN_SHEET',
      },
      {
        label: 'Away Clean Sheet',
        value: 'AWAY_CLEAN_SHEET',
      },
      {
        label: 'Both Clean Sheets',
        value: 'BOTH_CLEAN_SHEETS',
      },
      {
        label: 'Neither Clean Sheet',
        value: 'NEITHER_CLEAN_SHEET',
      },
    ],
  },

  // ==========================================================
  // HALF-TIME RESULT
  // ==========================================================

  {
    label: 'Half-Time Result',
    value: PredictionMarkets.HALF_TIME_RESULT,
    selections: [
      {
        label: 'Home',
        value: 'HOME',
      },
      {
        label: 'Draw',
        value: 'DRAW',
      },
      {
        label: 'Away',
        value: 'AWAY',
      },
    ],
  },

  // ==========================================================
  // SECOND HALF RESULT
  // ==========================================================

  {
    label: 'Second-Half Result',
    value: PredictionMarkets.SECOND_HALF_RESULT,
    selections: [
      {
        label: 'Home',
        value: 'HOME',
      },
      {
        label: 'Draw',
        value: 'DRAW',
      },
      {
        label: 'Away',
        value: 'AWAY',
      },
    ],
  },

  // ==========================================================
  // HALF-TIME / FULL-TIME
  // ==========================================================

  {
    label: 'Half-Time / Full-Time',
    value: PredictionMarkets.HALF_TIME_FULL_TIME,
    selections: [
      {
        label: 'Home / Home',
        value: 'HOME_HOME',
      },
      {
        label: 'Home / Draw',
        value: 'HOME_DRAW',
      },
      {
        label: 'Home / Away',
        value: 'HOME_AWAY',
      },

      {
        label: 'Draw / Home',
        value: 'DRAW_HOME',
      },
      {
        label: 'Draw / Draw',
        value: 'DRAW_DRAW',
      },
      {
        label: 'Draw / Away',
        value: 'DRAW_AWAY',
      },

      {
        label: 'Away / Home',
        value: 'AWAY_HOME',
      },
      {
        label: 'Away / Draw',
        value: 'AWAY_DRAW',
      },
      {
        label: 'Away / Away',
        value: 'AWAY_AWAY',
      },
    ],
  },

  // ==========================================================
  // FIRST HALF GOALS
  // ==========================================================

  {
    label: '1H Goals',
    value: PredictionMarkets.FIRST_HALF_GOALS,
    selections: [
      {
        label: 'Over 0.5',
        value: 'OVER_0_5',
      },
      {
        label: 'Under 0.5',
        value: 'UNDER_0_5',
      },

      {
        label: 'Over 1.5',
        value: 'OVER_1_5',
      },
      {
        label: 'Under 1.5',
        value: 'UNDER_1_5',
      },

      {
        label: 'Over 2.5',
        value: 'OVER_2_5',
      },
      {
        label: 'Under 2.5',
        value: 'UNDER_2_5',
      },

      {
        label: 'Over 3.5',
        value: 'OVER_3_5',
      },
      {
        label: 'Under 3.5',
        value: 'UNDER_3_5',
      },

      {
        label: 'Over 4.5',
        value: 'OVER_4_5',
      },
      {
        label: 'Under 4.5',
        value: 'UNDER_4_5',
      },
    ],
  },

  // ==========================================================
  // SECOND HALF GOALS
  // ==========================================================

  {
    label: '2H Goals',
    value: PredictionMarkets.SECOND_HALF_GOALS,
    selections: [
      {
        label: 'Over 0.5',
        value: 'OVER_0_5',
      },
      {
        label: 'Under 0.5',
        value: 'UNDER_0_5',
      },

      {
        label: 'Over 1.5',
        value: 'OVER_1_5',
      },
      {
        label: 'Under 1.5',
        value: 'UNDER_1_5',
      },

      {
        label: 'Over 2.5',
        value: 'OVER_2_5',
      },
      {
        label: 'Under 2.5',
        value: 'UNDER_2_5',
      },

      {
        label: 'Over 3.5',
        value: 'OVER_3_5',
      },
      {
        label: 'Under 3.5',
        value: 'UNDER_3_5',
      },

      {
        label: 'Over 4.5',
        value: 'OVER_4_5',
      },
      {
        label: 'Under 4.5',
        value: 'UNDER_4_5',
      },
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
      {
        label: 'Home -3.5',
        value: 'HOME_MINUS_3_5',
      },
      {
        label: 'Home -3',
        value: 'HOME_MINUS_3',
      },
      {
        label: 'Home -2.5',
        value: 'HOME_MINUS_2_5',
      },
      {
        label: 'Home -2',
        value: 'HOME_MINUS_2',
      },
      {
        label: 'Home -1.5',
        value: 'HOME_MINUS_1_5',
      },
      {
        label: 'Home -1',
        value: 'HOME_MINUS_1',
      },
      {
        label: 'Home -0.5',
        value: 'HOME_MINUS_0_5',
      },
      {
        label: 'Home +0.5',
        value: 'HOME_PLUS_0_5',
      },
      {
        label: 'Home +1',
        value: 'HOME_PLUS_1',
      },
      {
        label: 'Home +1.5',
        value: 'HOME_PLUS_1_5',
      },
      {
        label: 'Home +2',
        value: 'HOME_PLUS_2',
      },
      {
        label: 'Home +2.5',
        value: 'HOME_PLUS_2_5',
      },
      {
        label: 'Home +3',
        value: 'HOME_PLUS_3',
      },
      {
        label: 'Home +3.5',
        value: 'HOME_PLUS_3_5',
      },

      // AWAY
      {
        label: 'Away -3.5',
        value: 'AWAY_MINUS_3_5',
      },
      {
        label: 'Away -3',
        value: 'AWAY_MINUS_3',
      },
      {
        label: 'Away -2.5',
        value: 'AWAY_MINUS_2_5',
      },
      {
        label: 'Away -2',
        value: 'AWAY_MINUS_2',
      },
      {
        label: 'Away -1.5',
        value: 'AWAY_MINUS_1_5',
      },
      {
        label: 'Away -1',
        value: 'AWAY_MINUS_1',
      },
      {
        label: 'Away -0.5',
        value: 'AWAY_MINUS_0_5',
      },
      {
        label: 'Away +0.5',
        value: 'AWAY_PLUS_0_5',
      },
      {
        label: 'Away +1',
        value: 'AWAY_PLUS_1',
      },
      {
        label: 'Away +1.5',
        value: 'AWAY_PLUS_1_5',
      },
      {
        label: 'Away +2',
        value: 'AWAY_PLUS_2',
      },
      {
        label: 'Away +2.5',
        value: 'AWAY_PLUS_2_5',
      },
      {
        label: 'Away +3',
        value: 'AWAY_PLUS_3',
      },
      {
        label: 'Away +3.5',
        value: 'AWAY_PLUS_3_5',
      },
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
      {
        label: 'Home -3',
        value: 'HOME_MINUS_3',
      },
      {
        label: 'Home -2',
        value: 'HOME_MINUS_2',
      },
      {
        label: 'Home -1',
        value: 'HOME_MINUS_1',
      },
      {
        label: 'Home 0',
        value: 'HOME_0',
      },
      {
        label: 'Home +1',
        value: 'HOME_PLUS_1',
      },
      {
        label: 'Home +2',
        value: 'HOME_PLUS_2',
      },
      {
        label: 'Home +3',
        value: 'HOME_PLUS_3',
      },

      // AWAY
      {
        label: 'Away -3',
        value: 'AWAY_MINUS_3',
      },
      {
        label: 'Away -2',
        value: 'AWAY_MINUS_2',
      },
      {
        label: 'Away -1',
        value: 'AWAY_MINUS_1',
      },
      {
        label: 'Away 0',
        value: 'AWAY_0',
      },
      {
        label: 'Away +1',
        value: 'AWAY_PLUS_1',
      },
      {
        label: 'Away +2',
        value: 'AWAY_PLUS_2',
      },
      {
        label: 'Away +3',
        value: 'AWAY_PLUS_3',
      },
    ],
  },

  // ==========================================================
  // PART 2 — SECONDARY MARKETS
  // ==========================================================

  // ==========================================================
  // BTTS + GOALS
  // ==========================================================

  {
    label: 'BTTS + Goals',
    value: PredictionMarkets.BTTS_GOALS,
    selections: [
      {
        label: 'BTTS + Over 1.5',
        value: 'BTTS_OVER_1_5',
      },
      {
        label: 'BTTS + Under 1.5',
        value: 'BTTS_UNDER_1_5',
      },

      {
        label: 'BTTS + Over 2.5',
        value: 'BTTS_OVER_2_5',
      },
      {
        label: 'BTTS + Under 2.5',
        value: 'BTTS_UNDER_2_5',
      },

      {
        label: 'BTTS + Over 3.5',
        value: 'BTTS_OVER_3_5',
      },
      {
        label: 'BTTS + Under 3.5',
        value: 'BTTS_UNDER_3_5',
      },

      {
        label: 'BTTS + Over 4.5',
        value: 'BTTS_OVER_4_5',
      },
      {
        label: 'BTTS + Under 4.5',
        value: 'BTTS_UNDER_4_5',
      },

      {
        label: 'BTTS + Home Win',
        value: 'BTTS_HOME_WIN',
      },
      {
        label: 'BTTS + Draw',
        value: 'BTTS_DRAW',
      },
      {
        label: 'BTTS + Away Win',
        value: 'BTTS_AWAY_WIN',
      },

      {
        label: 'No BTTS + Home Win',
        value: 'NO_BTTS_HOME_WIN',
      },
      {
        label: 'No BTTS + Draw',
        value: 'NO_BTTS_DRAW',
      },
      {
        label: 'No BTTS + Away Win',
        value: 'NO_BTTS_AWAY_WIN',
      },
    ],
  },

  // ==========================================================
  // CORNERS TOTAL
  // ==========================================================

  {
    label: 'Corners Total',
    value: PredictionMarkets.CORNERS_TOTAL,
    selections: [
      {
        label: 'Over 5.5',
        value: 'OVER_5_5',
      },
      {
        label: 'Under 5.5',
        value: 'UNDER_5_5',
      },

      {
        label: 'Over 6.5',
        value: 'OVER_6_5',
      },
      {
        label: 'Under 6.5',
        value: 'UNDER_6_5',
      },

      {
        label: 'Over 7.5',
        value: 'OVER_7_5',
      },
      {
        label: 'Under 7.5',
        value: 'UNDER_7_5',
      },

      {
        label: 'Over 8.5',
        value: 'OVER_8_5',
      },
      {
        label: 'Under 8.5',
        value: 'UNDER_8_5',
      },

      {
        label: 'Over 9.5',
        value: 'OVER_9_5',
      },
      {
        label: 'Under 9.5',
        value: 'UNDER_9_5',
      },

      {
        label: 'Over 10.5',
        value: 'OVER_10_5',
      },
      {
        label: 'Under 10.5',
        value: 'UNDER_10_5',
      },

      {
        label: 'Over 11.5',
        value: 'OVER_11_5',
      },
      {
        label: 'Under 11.5',
        value: 'UNDER_11_5',
      },

      {
        label: 'Over 12.5',
        value: 'OVER_12_5',
      },
      {
        label: 'Under 12.5',
        value: 'UNDER_12_5',
      },

      {
        label: 'Over 13.5',
        value: 'OVER_13_5',
      },
      {
        label: 'Under 13.5',
        value: 'UNDER_13_5',
      },
    ],
  },

  // ==========================================================
  // TEAM CORNERS
  // ==========================================================

  {
    label: 'Team Corners',
    value: PredictionMarkets.TEAM_CORNERS,
    selections: [
      {
        label: 'Home Over 2.5',
        value: 'HOME_OVER_2_5',
      },
      {
        label: 'Home Under 2.5',
        value: 'HOME_UNDER_2_5',
      },

      {
        label: 'Home Over 3.5',
        value: 'HOME_OVER_3_5',
      },
      {
        label: 'Home Under 3.5',
        value: 'HOME_UNDER_3_5',
      },

      {
        label: 'Home Over 4.5',
        value: 'HOME_OVER_4_5',
      },
      {
        label: 'Home Under 4.5',
        value: 'HOME_UNDER_4_5',
      },

      {
        label: 'Home Over 5.5',
        value: 'HOME_OVER_5_5',
      },
      {
        label: 'Home Under 5.5',
        value: 'HOME_UNDER_5_5',
      },

      {
        label: 'Home Over 6.5',
        value: 'HOME_OVER_6_5',
      },
      {
        label: 'Home Under 6.5',
        value: 'HOME_UNDER_6_5',
      },

      {
        label: 'Away Over 2.5',
        value: 'AWAY_OVER_2_5',
      },
      {
        label: 'Away Under 2.5',
        value: 'AWAY_UNDER_2_5',
      },

      {
        label: 'Away Over 3.5',
        value: 'AWAY_OVER_3_5',
      },
      {
        label: 'Away Under 3.5',
        value: 'AWAY_UNDER_3_5',
      },

      {
        label: 'Away Over 4.5',
        value: 'AWAY_OVER_4_5',
      },
      {
        label: 'Away Under 4.5',
        value: 'AWAY_UNDER_4_5',
      },

      {
        label: 'Away Over 5.5',
        value: 'AWAY_OVER_5_5',
      },
      {
        label: 'Away Under 5.5',
        value: 'AWAY_UNDER_5_5',
      },

      {
        label: 'Away Over 6.5',
        value: 'AWAY_OVER_6_5',
      },
      {
        label: 'Away Under 6.5',
        value: 'AWAY_UNDER_6_5',
      },
    ],
  },

  // ==========================================================
  // CORNER HANDICAP
  // ==========================================================

  {
    label: 'Corner Handicap',
    value: PredictionMarkets.CORNER_HANDICAP,
    selections: [
      {
        label: 'Home -3.5',
        value: 'HOME_MINUS_3_5',
      },
      {
        label: 'Home -2.5',
        value: 'HOME_MINUS_2_5',
      },
      {
        label: 'Home -1.5',
        value: 'HOME_MINUS_1_5',
      },
      {
        label: 'Home -0.5',
        value: 'HOME_MINUS_0_5',
      },

      {
        label: 'Home +0.5',
        value: 'HOME_PLUS_0_5',
      },
      {
        label: 'Home +1.5',
        value: 'HOME_PLUS_1_5',
      },
      {
        label: 'Home +2.5',
        value: 'HOME_PLUS_2_5',
      },
      {
        label: 'Home +3.5',
        value: 'HOME_PLUS_3_5',
      },

      {
        label: 'Away -3.5',
        value: 'AWAY_MINUS_3_5',
      },
      {
        label: 'Away -2.5',
        value: 'AWAY_MINUS_2_5',
      },
      {
        label: 'Away -1.5',
        value: 'AWAY_MINUS_1_5',
      },
      {
        label: 'Away -0.5',
        value: 'AWAY_MINUS_0_5',
      },

      {
        label: 'Away +0.5',
        value: 'AWAY_PLUS_0_5',
      },
      {
        label: 'Away +1.5',
        value: 'AWAY_PLUS_1_5',
      },
      {
        label: 'Away +2.5',
        value: 'AWAY_PLUS_2_5',
      },
      {
        label: 'Away +3.5',
        value: 'AWAY_PLUS_3_5',
      },
    ],
  },

  // ==========================================================
  // FIRST HALF CORNERS
  // ==========================================================

  {
    label: '1H Corners',
    value: PredictionMarkets.FIRST_HALF_CORNERS,
    selections: [
      {
        label: 'Over 2.5',
        value: 'OVER_2_5',
      },
      {
        label: 'Under 2.5',
        value: 'UNDER_2_5',
      },

      {
        label: 'Over 3.5',
        value: 'OVER_3_5',
      },
      {
        label: 'Under 3.5',
        value: 'UNDER_3_5',
      },

      {
        label: 'Over 4.5',
        value: 'OVER_4_5',
      },
      {
        label: 'Under 4.5',
        value: 'UNDER_4_5',
      },

      {
        label: 'Over 5.5',
        value: 'OVER_5_5',
      },
      {
        label: 'Under 5.5',
        value: 'UNDER_5_5',
      },

      {
        label: 'Over 6.5',
        value: 'OVER_6_5',
      },
      {
        label: 'Under 6.5',
        value: 'UNDER_6_5',
      },
    ],
  },

  // ==========================================================
  // CARDS TOTAL
  // ==========================================================

  {
    label: 'Cards Total',
    value: PredictionMarkets.CARDS_TOTAL,
    selections: [
      {
        label: 'Over 1.5',
        value: 'OVER_1_5',
      },
      {
        label: 'Under 1.5',
        value: 'UNDER_1_5',
      },

      {
        label: 'Over 2.5',
        value: 'OVER_2_5',
      },
      {
        label: 'Under 2.5',
        value: 'UNDER_2_5',
      },

      {
        label: 'Over 3.5',
        value: 'OVER_3_5',
      },
      {
        label: 'Under 3.5',
        value: 'UNDER_3_5',
      },

      {
        label: 'Over 4.5',
        value: 'OVER_4_5',
      },
      {
        label: 'Under 4.5',
        value: 'UNDER_4_5',
      },

      {
        label: 'Over 5.5',
        value: 'OVER_5_5',
      },
      {
        label: 'Under 5.5',
        value: 'UNDER_5_5',
      },

      {
        label: 'Over 6.5',
        value: 'OVER_6_5',
      },
      {
        label: 'Under 6.5',
        value: 'UNDER_6_5',
      },
    ],
  },

  // ==========================================================
  // TEAM CARDS
  // ==========================================================

  {
    label: 'Team Cards',
    value: PredictionMarkets.TEAM_CARDS,
    selections: [
      {
        label: 'Home Over 0.5',
        value: 'HOME_OVER_0_5',
      },
      {
        label: 'Home Under 0.5',
        value: 'HOME_UNDER_0_5',
      },

      {
        label: 'Home Over 1.5',
        value: 'HOME_OVER_1_5',
      },
      {
        label: 'Home Under 1.5',
        value: 'HOME_UNDER_1_5',
      },

      {
        label: 'Home Over 2.5',
        value: 'HOME_OVER_2_5',
      },
      {
        label: 'Home Under 2.5',
        value: 'HOME_UNDER_2_5',
      },

      {
        label: 'Home Over 3.5',
        value: 'HOME_OVER_3_5',
      },
      {
        label: 'Home Under 3.5',
        value: 'HOME_UNDER_3_5',
      },

      {
        label: 'Home Over 4.5',
        value: 'HOME_OVER_4_5',
      },
      {
        label: 'Home Under 4.5',
        value: 'HOME_UNDER_4_5',
      },

      {
        label: 'Away Over 0.5',
        value: 'AWAY_OVER_0_5',
      },
      {
        label: 'Away Under 0.5',
        value: 'AWAY_UNDER_0_5',
      },

      {
        label: 'Away Over 1.5',
        value: 'AWAY_OVER_1_5',
      },
      {
        label: 'Away Under 1.5',
        value: 'AWAY_UNDER_1_5',
      },

      {
        label: 'Away Over 2.5',
        value: 'AWAY_OVER_2_5',
      },
      {
        label: 'Away Under 2.5',
        value: 'AWAY_UNDER_2_5',
      },

      {
        label: 'Away Over 3.5',
        value: 'AWAY_OVER_3_5',
      },
      {
        label: 'Away Under 3.5',
        value: 'AWAY_UNDER_3_5',
      },

      {
        label: 'Away Over 4.5',
        value: 'AWAY_OVER_4_5',
      },
      {
        label: 'Away Under 4.5',
        value: 'AWAY_UNDER_4_5',
      },
    ],
  },

  // ==========================================================
  // CARD HANDICAP
  // ==========================================================

  {
    label: 'Card Handicap',
    value: PredictionMarkets.CARD_HANDICAP,
    selections: [
      {
        label: 'Home -2.5',
        value: 'HOME_MINUS_2_5',
      },
      {
        label: 'Home -1.5',
        value: 'HOME_MINUS_1_5',
      },
      {
        label: 'Home -0.5',
        value: 'HOME_MINUS_0_5',
      },

      {
        label: 'Home +0.5',
        value: 'HOME_PLUS_0_5',
      },
      {
        label: 'Home +1.5',
        value: 'HOME_PLUS_1_5',
      },
      {
        label: 'Home +2.5',
        value: 'HOME_PLUS_2_5',
      },

      {
        label: 'Away -2.5',
        value: 'AWAY_MINUS_2_5',
      },
      {
        label: 'Away -1.5',
        value: 'AWAY_MINUS_1_5',
      },
      {
        label: 'Away -0.5',
        value: 'AWAY_MINUS_0_5',
      },

      {
        label: 'Away +0.5',
        value: 'AWAY_PLUS_0_5',
      },
      {
        label: 'Away +1.5',
        value: 'AWAY_PLUS_1_5',
      },
      {
        label: 'Away +2.5',
        value: 'AWAY_PLUS_2_5',
      },
    ],
  },

  // ==========================================================
  // FIRST HALF CARDS
  // ==========================================================

  {
    label: '1H Cards',
    value: PredictionMarkets.FIRST_HALF_CARDS,
    selections: [
      {
        label: 'Over 0.5',
        value: 'OVER_0_5',
      },
      {
        label: 'Under 0.5',
        value: 'UNDER_0_5',
      },

      {
        label: 'Over 1.5',
        value: 'OVER_1_5',
      },
      {
        label: 'Under 1.5',
        value: 'UNDER_1_5',
      },

      {
        label: 'Over 2.5',
        value: 'OVER_2_5',
      },
      {
        label: 'Under 2.5',
        value: 'UNDER_2_5',
      },

      {
        label: 'Over 3.5',
        value: 'OVER_3_5',
      },
      {
        label: 'Under 3.5',
        value: 'UNDER_3_5',
      },
    ],
  },

  // ==========================================================
  // FIRST GOAL
  // ==========================================================

  {
    label: 'First Goal',
    value: PredictionMarkets.FIRST_GOAL,
    selections: [
      {
        label: 'Home',
        value: 'HOME',
      },
      {
        label: 'Away',
        value: 'AWAY',
      },
      {
        label: 'No Goal',
        value: 'NO_GOAL',
      },
    ],
  },

  // ==========================================================
  // LAST GOAL
  // ==========================================================

  {
    label: 'Last Goal',
    value: PredictionMarkets.LAST_GOAL,
    selections: [
      {
        label: 'Home',
        value: 'HOME',
      },
      {
        label: 'Away',
        value: 'AWAY',
      },
      {
        label: 'No Goal',
        value: 'NO_GOAL',
      },
    ],
  },

  // ==========================================================
  // WIN TO NIL
  // ==========================================================

  {
    label: 'Win To Nil',
    value: PredictionMarkets.WIN_TO_NIL,
    selections: [
      {
        label: 'Home Win To Nil',
        value: 'HOME_WIN_TO_NIL',
      },
      {
        label: 'Away Win To Nil',
        value: 'AWAY_WIN_TO_NIL',
      },
      {
        label: 'Neither',
        value: 'NEITHER_WIN_TO_NIL',
      },
    ],
  },

  // ==========================================================
  // POSSESSION WINNER
  // ==========================================================

  {
    label: 'Possession Winner',
    value: PredictionMarkets.POSSESSION_WINNER,
    selections: [
      {
        label: 'Home',
        value: 'HOME',
      },
      {
        label: 'Away',
        value: 'AWAY',
      },
    ],
  },

  // ==========================================================
  // MOST SHOTS
  // ==========================================================

  {
    label: 'Most Shots',
    value: PredictionMarkets.MOST_SHOTS,
    selections: [
      {
        label: 'Home',
        value: 'HOME',
      },
      {
        label: 'Away',
        value: 'AWAY',
      },
    ],
  },

  // ==========================================================
  // MOST SHOTS ON TARGET
  // ==========================================================

  {
    label: 'Most Shots On Target',
    value: PredictionMarkets.MOST_SHOTS_ON_TARGET,
    selections: [
      {
        label: 'Home',
        value: 'HOME',
      },
      {
        label: 'Away',
        value: 'AWAY',
      },
    ],
  },

  // ==========================================================
  // GOAL TIMING
  // ==========================================================

  {
    label: 'Goal Timing',
    value: PredictionMarkets.GOAL_TIMING,
    selections: [
      {
        label: 'Goal 0–15',
        value: 'GOAL_0_15',
      },
      {
        label: 'Goal 16–30',
        value: 'GOAL_16_30',
      },
      {
        label: 'Goal 31–45',
        value: 'GOAL_31_45',
      },
      {
        label: 'Goal 46–60',
        value: 'GOAL_46_60',
      },
      {
        label: 'Goal 61–75',
        value: 'GOAL_61_75',
      },
      {
        label: 'Goal 76–90+',
        value: 'GOAL_76_90_PLUS',
      },
    ],
  },

  // ==========================================================
  // OFFSIDES TOTAL
  // ==========================================================

  {
    label: 'Offsides Total',
    value: PredictionMarkets.OFFSIDES_TOTAL,
    selections: [
      {
        label: 'Over 1.5',
        value: 'OVER_1_5',
      },
      {
        label: 'Under 1.5',
        value: 'UNDER_1_5',
      },

      {
        label: 'Over 2.5',
        value: 'OVER_2_5',
      },
      {
        label: 'Under 2.5',
        value: 'UNDER_2_5',
      },

      {
        label: 'Over 3.5',
        value: 'OVER_3_5',
      },
      {
        label: 'Under 3.5',
        value: 'UNDER_3_5',
      },

      {
        label: 'Over 4.5',
        value: 'OVER_4_5',
      },
      {
        label: 'Under 4.5',
        value: 'UNDER_4_5',
      },

      {
        label: 'Over 5.5',
        value: 'OVER_5_5',
      },
      {
        label: 'Under 5.5',
        value: 'UNDER_5_5',
      },
    ],
  },

  // ==========================================================
  // TEAM OFFSIDES
  // ==========================================================

  {
    label: 'Team Offsides',
    value: PredictionMarkets.TEAM_OFFSIDES,
    selections: [
      {
        label: 'Home Over 0.5',
        value: 'HOME_OVER_0_5',
      },
      {
        label: 'Home Under 0.5',
        value: 'HOME_UNDER_0_5',
      },

      {
        label: 'Home Over 1.5',
        value: 'HOME_OVER_1_5',
      },
      {
        label: 'Home Under 1.5',
        value: 'HOME_UNDER_1_5',
      },

      {
        label: 'Home Over 2.5',
        value: 'HOME_OVER_2_5',
      },
      {
        label: 'Home Under 2.5',
        value: 'HOME_UNDER_2_5',
      },

      {
        label: 'Home Over 3.5',
        value: 'HOME_OVER_3_5',
      },
      {
        label: 'Home Under 3.5',
        value: 'HOME_UNDER_3_5',
      },

      {
        label: 'Away Over 0.5',
        value: 'AWAY_OVER_0_5',
      },
      {
        label: 'Away Under 0.5',
        value: 'AWAY_UNDER_0_5',
      },

      {
        label: 'Away Over 1.5',
        value: 'AWAY_OVER_1_5',
      },
      {
        label: 'Away Under 1.5',
        value: 'AWAY_UNDER_1_5',
      },

      {
        label: 'Away Over 2.5',
        value: 'AWAY_OVER_2_5',
      },
      {
        label: 'Away Under 2.5',
        value: 'AWAY_UNDER_2_5',
      },

      {
        label: 'Away Over 3.5',
        value: 'AWAY_OVER_3_5',
      },
      {
        label: 'Away Under 3.5',
        value: 'AWAY_UNDER_3_5',
      },
    ],
  },

  // ==========================================================
  // FOULS TOTAL
  // ==========================================================

  {
    label: 'Fouls Total',
    value: PredictionMarkets.FOULS_TOTAL,
    selections: [
      {
        label: 'Over 15.5',
        value: 'OVER_15_5',
      },
      {
        label: 'Under 15.5',
        value: 'UNDER_15_5',
      },

      {
        label: 'Over 19.5',
        value: 'OVER_19_5',
      },
      {
        label: 'Under 19.5',
        value: 'UNDER_19_5',
      },

      {
        label: 'Over 23.5',
        value: 'OVER_23_5',
      },
      {
        label: 'Under 23.5',
        value: 'UNDER_23_5',
      },

      {
        label: 'Over 27.5',
        value: 'OVER_27_5',
      },
      {
        label: 'Under 27.5',
        value: 'UNDER_27_5',
      },

      {
        label: 'Over 31.5',
        value: 'OVER_31_5',
      },
      {
        label: 'Under 31.5',
        value: 'UNDER_31_5',
      },
    ],
  },

  // ==========================================================
  // TEAM FOULS
  // ==========================================================

  {
    label: 'Team Fouls',
    value: PredictionMarkets.TEAM_FOULS,
    selections: [
      {
        label: 'Home Over 5.5',
        value: 'HOME_OVER_5_5',
      },
      {
        label: 'Home Under 5.5',
        value: 'HOME_UNDER_5_5',
      },

      {
        label: 'Home Over 7.5',
        value: 'HOME_OVER_7_5',
      },
      {
        label: 'Home Under 7.5',
        value: 'HOME_UNDER_7_5',
      },

      {
        label: 'Home Over 9.5',
        value: 'HOME_OVER_9_5',
      },
      {
        label: 'Home Under 9.5',
        value: 'HOME_UNDER_9_5',
      },

      {
        label: 'Home Over 11.5',
        value: 'HOME_OVER_11_5',
      },
      {
        label: 'Home Under 11.5',
        value: 'HOME_UNDER_11_5',
      },

      {
        label: 'Away Over 5.5',
        value: 'AWAY_OVER_5_5',
      },
      {
        label: 'Away Under 5.5',
        value: 'AWAY_UNDER_5_5',
      },

      {
        label: 'Away Over 7.5',
        value: 'AWAY_OVER_7_5',
      },
      {
        label: 'Away Under 7.5',
        value: 'AWAY_UNDER_7_5',
      },

      {
        label: 'Away Over 9.5',
        value: 'AWAY_OVER_9_5',
      },
      {
        label: 'Away Under 9.5',
        value: 'AWAY_UNDER_9_5',
      },

      {
        label: 'Away Over 11.5',
        value: 'AWAY_OVER_11_5',
      },
      {
        label: 'Away Under 11.5',
        value: 'AWAY_UNDER_11_5',
      },
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
