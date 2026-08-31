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
      { label: 'Over 1.5', value: 'OVER_1_5' },
      { label: 'Over 2.5', value: 'OVER_2_5' },
      { label: 'Over 3.5', value: 'OVER_3_5' },
      { label: 'Over 4.5', value: 'OVER_4_5' },
      { label: 'Over 5.5', value: 'OVER_5_5' },
      { label: 'Under 0.5', value: 'UNDER_0_5' },
      { label: 'Under 1.5', value: 'UNDER_1_5' },
      { label: 'Under 2.5', value: 'UNDER_2_5' },
      { label: 'Under 3.5', value: 'UNDER_3_5' },
      { label: 'Under 4.5', value: 'UNDER_4_5' },
      { label: 'Under 5.5', value: 'UNDER_5_5' },
    ],
  },

  // ==========================================================
  // BTTS
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
      { label: '1X', value: 'HOME_DRAW' },
      { label: 'X2', value: 'DRAW_AWAY' },
      { label: '12', value: 'HOME_AWAY' },
    ],
  },

  // ==========================================================
  // DRAW NO BET
  // ==========================================================

  {
    label: 'DNB',
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
      { label: '0–1', value: 'GOALS_0_1' },
      { label: '2–3', value: 'GOALS_2_3' },
      { label: '4–5', value: 'GOALS_4_5' },
      { label: '6+', value: 'GOALS_6_PLUS' },
    ],
  },

  // ==========================================================
  // TEAM GOALS
  // ==========================================================

  {
    label: 'Team Goals',
    value: PredictionMarkets.TEAM_TOTAL_GOALS,
    selections: [
      { label: 'Home Over 0.5', value: 'HOME_OVER_0_5' },
      { label: 'Home Over 1.5', value: 'HOME_OVER_1_5' },
      { label: 'Home Over 2.5', value: 'HOME_OVER_2_5' },
      { label: 'Home Under 0.5', value: 'HOME_UNDER_0_5' },
      { label: 'Home Under 1.5', value: 'HOME_UNDER_1_5' },
      { label: 'Home Under 2.5', value: 'HOME_UNDER_2_5' },
      { label: 'Away Over 0.5', value: 'AWAY_OVER_0_5' },
      { label: 'Away Over 1.5', value: 'AWAY_OVER_1_5' },
      { label: 'Away Over 2.5', value: 'AWAY_OVER_2_5' },
      { label: 'Away Under 0.5', value: 'AWAY_UNDER_0_5' },
      { label: 'Away Under 1.5', value: 'AWAY_UNDER_1_5' },
      { label: 'Away Under 2.5', value: 'AWAY_UNDER_2_5' },
    ],
  },

  // ==========================================================
  // HALF TIME RESULT
  // ==========================================================

  {
    label: 'HT Result',
    value: PredictionMarkets.HALF_TIME_RESULT,
    selections: [
      { label: '1', value: 'HOME_WIN' },
      { label: 'X', value: 'DRAW' },
      { label: '2', value: 'AWAY_WIN' },
    ],
  },

  // ==========================================================
  // HT / FT
  // ==========================================================

  {
    label: 'HT/FT',
    value: PredictionMarkets.HALF_TIME_FULL_TIME,
    selections: [
      { label: '1/1', value: 'HOME_HOME' },
      { label: '1/X', value: 'HOME_DRAW' },
      { label: '1/2', value: 'HOME_AWAY' },
      { label: 'X/1', value: 'DRAW_HOME' },
      { label: 'X/X', value: 'DRAW_DRAW' },
      { label: 'X/2', value: 'DRAW_AWAY' },
      { label: '2/1', value: 'AWAY_HOME' },
      { label: '2/X', value: 'AWAY_DRAW' },
      { label: '2/2', value: 'AWAY_AWAY' },
    ],
  },

  // ==========================================================
  // SECOND HALF RESULT
  // ==========================================================

  {
    label: '2H Result',
    value: PredictionMarkets.SECOND_HALF_RESULT,
    selections: [
      { label: '1', value: 'HOME_WIN' },
      { label: 'X', value: 'DRAW' },
      { label: '2', value: 'AWAY_WIN' },
    ],
  },

  // ==========================================================
  // ASIAN HANDICAP
  // ==========================================================

  {
    label: 'Asian Handicap',
    value: PredictionMarkets.ASIAN_HANDICAP,
    selections: [
      { label: 'Home -2.5', value: 'HOME_MINUS_2_5' },
      { label: 'Home -1.5', value: 'HOME_MINUS_1_5' },
      { label: 'Home -1', value: 'HOME_MINUS_1' },
      { label: 'Home -0.5', value: 'HOME_MINUS_0_5' },
      { label: 'Away +0.5', value: 'AWAY_PLUS_0_5' },
      { label: 'Away +1', value: 'AWAY_PLUS_1' },
      { label: 'Away +1.5', value: 'AWAY_PLUS_1_5' },
      { label: 'Away +2.5', value: 'AWAY_PLUS_2_5' },
    ],
  },

  // ==========================================================
  // EUROPEAN HANDICAP
  // ==========================================================

  {
    label: 'European Handicap',
    value: PredictionMarkets.EUROPEAN_HANDICAP,
    selections: [
      { label: 'Home -2', value: 'HOME_MINUS_2' },
      { label: 'Home -1', value: 'HOME_MINUS_1' },
      { label: 'Home +1', value: 'HOME_PLUS_1' },
      { label: 'Away -2', value: 'AWAY_MINUS_2' },
      { label: 'Away -1', value: 'AWAY_MINUS_1' },
      { label: 'Away +1', value: 'AWAY_PLUS_1' },
    ],
  },

  // ==========================================================
  // TOTAL CORNERS
  // ==========================================================

  {
    label: 'Total Corners',
    value: PredictionMarkets.CORNERS_TOTAL,
    selections: [
      { label: 'Over 7.5', value: 'OVER_7_5' },
      { label: 'Over 8.5', value: 'OVER_8_5' },
      { label: 'Over 9.5', value: 'OVER_9_5' },
      { label: 'Over 10.5', value: 'OVER_10_5' },
      { label: 'Over 11.5', value: 'OVER_11_5' },
      { label: 'Under 7.5', value: 'UNDER_7_5' },
      { label: 'Under 8.5', value: 'UNDER_8_5' },
      { label: 'Under 9.5', value: 'UNDER_9_5' },
      { label: 'Under 10.5', value: 'UNDER_10_5' },
      { label: 'Under 11.5', value: 'UNDER_11_5' },
    ],
  },

  // ==========================================================
  // TEAM CORNERS
  // ==========================================================

  {
    label: 'Team Corners',
    value: PredictionMarkets.TEAM_CORNERS,
    selections: [
      { label: 'Home Over 3.5', value: 'HOME_OVER_3_5' },
      { label: 'Home Over 4.5', value: 'HOME_OVER_4_5' },
      { label: 'Home Over 5.5', value: 'HOME_OVER_5_5' },
      { label: 'Home Under 3.5', value: 'HOME_UNDER_3_5' },
      { label: 'Home Under 4.5', value: 'HOME_UNDER_4_5' },
      { label: 'Home Under 5.5', value: 'HOME_UNDER_5_5' },
      { label: 'Away Over 3.5', value: 'AWAY_OVER_3_5' },
      { label: 'Away Over 4.5', value: 'AWAY_OVER_4_5' },
      { label: 'Away Over 5.5', value: 'AWAY_OVER_5_5' },
      { label: 'Away Under 3.5', value: 'AWAY_UNDER_3_5' },
      { label: 'Away Under 4.5', value: 'AWAY_UNDER_4_5' },
      { label: 'Away Under 5.5', value: 'AWAY_UNDER_5_5' },
    ],
  },

  // ==========================================================
  // CORNER HANDICAP
  // ==========================================================

  {
    label: 'Corner Handicap',
    value: PredictionMarkets.CORNER_HANDICAP,
    selections: [
      { label: 'Home -2', value: 'HOME_MINUS_2' },
      { label: 'Home -3', value: 'HOME_MINUS_3' },
      { label: 'Home -4', value: 'HOME_MINUS_4' },
      { label: 'Away +2', value: 'AWAY_PLUS_2' },
      { label: 'Away +3', value: 'AWAY_PLUS_3' },
      { label: 'Away +4', value: 'AWAY_PLUS_4' },
    ],
  },

  // ==========================================================
  // TOTAL CARDS
  // ==========================================================

  {
    label: 'Total Cards',
    value: PredictionMarkets.CARDS_TOTAL,
    selections: [
      { label: 'Over 2.5', value: 'OVER_2_5' },
      { label: 'Over 3.5', value: 'OVER_3_5' },
      { label: 'Over 4.5', value: 'OVER_4_5' },
      { label: 'Over 5.5', value: 'OVER_5_5' },
      { label: 'Over 6.5', value: 'OVER_6_5' },
      { label: 'Under 2.5', value: 'UNDER_2_5' },
      { label: 'Under 3.5', value: 'UNDER_3_5' },
      { label: 'Under 4.5', value: 'UNDER_4_5' },
      { label: 'Under 5.5', value: 'UNDER_5_5' },
      { label: 'Under 6.5', value: 'UNDER_6_5' },
    ],
  },

  // ==========================================================
  // TEAM CARDS
  // ==========================================================

  {
    label: 'Team Cards',
    value: PredictionMarkets.TEAM_CARDS,
    selections: [
      { label: 'Home Over 1.5', value: 'HOME_OVER_1_5' },
      { label: 'Home Over 2.5', value: 'HOME_OVER_2_5' },
      { label: 'Home Over 3.5', value: 'HOME_OVER_3_5' },
      { label: 'Home Under 1.5', value: 'HOME_UNDER_1_5' },
      { label: 'Home Under 2.5', value: 'HOME_UNDER_2_5' },
      { label: 'Home Under 3.5', value: 'HOME_UNDER_3_5' },
      { label: 'Away Over 1.5', value: 'AWAY_OVER_1_5' },
      { label: 'Away Over 2.5', value: 'AWAY_OVER_2_5' },
      { label: 'Away Over 3.5', value: 'AWAY_OVER_3_5' },
      { label: 'Away Under 1.5', value: 'AWAY_UNDER_1_5' },
      { label: 'Away Under 2.5', value: 'AWAY_UNDER_2_5' },
      { label: 'Away Under 3.5', value: 'AWAY_UNDER_3_5' },
    ],
  },

  // ==========================================================
  // CARD HANDICAP
  // ==========================================================

  {
    label: 'Card Handicap',
    value: PredictionMarkets.CARD_HANDICAP,
    selections: [
      { label: 'Home -1', value: 'HOME_MINUS_1' },
      { label: 'Home -2', value: 'HOME_MINUS_2' },
      { label: 'Home -3', value: 'HOME_MINUS_3' },
      { label: 'Away +1', value: 'AWAY_PLUS_1' },
      { label: 'Away +2', value: 'AWAY_PLUS_2' },
      { label: 'Away +3', value: 'AWAY_PLUS_3' },
    ],
  },

  // ==========================================================
  // ANYTIME GOALSCORER
  // ==========================================================

  {
    label: 'Anytime Goalscorer',
    value: PredictionMarkets.ANYTIME_GOALSCORER,
    selections: [
      {
        label: 'Player',
        value: 'PLAYER_ID',
      },
    ],
  },

  // ==========================================================
  // FIRST GOALSCORER
  // ==========================================================

  {
    label: 'First Goalscorer',
    value: PredictionMarkets.FIRST_GOALSCORER,
    selections: [
      {
        label: 'Player',
        value: 'PLAYER_ID',
      },
    ],
  },

  // ==========================================================
  // PLAYER SHOTS
  // ==========================================================

  {
    label: 'Player Shots',
    value: PredictionMarkets.PLAYER_SHOTS,
    selections: [
      {
        label: 'Over 1.5',
        value: 'PLAYER_OVER_1_5_SHOTS',
      },
      {
        label: 'Over 2.5',
        value: 'PLAYER_OVER_2_5_SHOTS',
      },
      {
        label: 'Over 3.5',
        value: 'PLAYER_OVER_3_5_SHOTS',
      },
      {
        label: 'Under 1.5',
        value: 'PLAYER_UNDER_1_5_SHOTS',
      },
      {
        label: 'Under 2.5',
        value: 'PLAYER_UNDER_2_5_SHOTS',
      },
      {
        label: 'Under 3.5',
        value: 'PLAYER_UNDER_3_5_SHOTS',
      },
    ],
  },

  // ==========================================================
  // PLAYER SHOTS ON TARGET
  // ==========================================================

  {
    label: 'Player SOT',
    value: PredictionMarkets.PLAYER_SHOTS_ON_TARGET,
    selections: [
      {
        label: 'Over 0.5',
        value: 'PLAYER_OVER_0_5_SOT',
      },
      {
        label: 'Over 1.5',
        value: 'PLAYER_OVER_1_5_SOT',
      },
      {
        label: 'Over 2.5',
        value: 'PLAYER_OVER_2_5_SOT',
      },
      {
        label: 'Under 0.5',
        value: 'PLAYER_UNDER_0_5_SOT',
      },
      {
        label: 'Under 1.5',
        value: 'PLAYER_UNDER_1_5_SOT',
      },
      {
        label: 'Under 2.5',
        value: 'PLAYER_UNDER_2_5_SOT',
      },
    ],
  },

  // ==========================================================
  // PLAYER ASSISTS
  // ==========================================================

  {
    label: 'Player Assists',
    value: PredictionMarkets.PLAYER_ASSISTS,
    selections: [
      {
        label: 'Over 0.5',
        value: 'PLAYER_OVER_0_5_ASSISTS',
      },
      {
        label: 'Over 1.5',
        value: 'PLAYER_OVER_1_5_ASSISTS',
      },
      {
        label: 'Under 0.5',
        value: 'PLAYER_UNDER_0_5_ASSISTS',
      },
      {
        label: 'Under 1.5',
        value: 'PLAYER_UNDER_1_5_ASSISTS',
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
        label: '1st to Score',
        value: 'HOME_SCORES_FIRST',
      },
      {
        label: 'No Goal',
        value: 'NO_GOAL',
      },
      {
        label: '2nd to Score',
        value: 'AWAY_SCORES_FIRST',
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
        label: '1st to Score Last',
        value: 'HOME_SCORES_LAST',
      },
      {
        label: 'No Goal',
        value: 'NO_GOAL',
      },
      {
        label: '2nd to Score Last',
        value: 'AWAY_SCORES_LAST',
      },
    ],
  },

  // ==========================================================
  // WIN TO NIL
  // ==========================================================

  {
    label: 'Win to Nil',
    value: PredictionMarkets.WIN_TO_NIL,
    selections: [
      {
        label: 'Home',
        value: 'HOME_WIN_TO_NIL',
      },
      {
        label: 'Away',
        value: 'AWAY_WIN_TO_NIL',
      },
    ],
  },

  // ==========================================================
  // CORRECT SCORE
  // ==========================================================

  {
    label: 'Correct Score',
    value: PredictionMarkets.CORRECT_SCORE,
    selections: [
      { label: '0-0', value: '0_0' },
      { label: '1-0', value: '1_0' },
      { label: '2-0', value: '2_0' },
      { label: '3-0', value: '3_0' },
      { label: '1-1', value: '1_1' },
      { label: '2-1', value: '2_1' },
      { label: '3-1', value: '3_1' },
      { label: '2-2', value: '2_2' },
      { label: '0-1', value: '0_1' },
      { label: '0-2', value: '0_2' },
      { label: '0-3', value: '0_3' },
      { label: '1-2', value: '1_2' },
      { label: '1-3', value: '1_3' },
      { label: '3-2', value: '3_2' },
      { label: 'Other Score', value: 'OTHER_SCORE' },
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
        label: 'Home',
        value: 'HOME_CLEAN_SHEET',
      },
      {
        label: 'Away',
        value: 'AWAY_CLEAN_SHEET',
      },
      {
        label: 'Both',
        value: 'BOTH_CLEAN_SHEET',
      },
      {
        label: 'Neither',
        value: 'NO_CLEAN_SHEET',
      },
    ],
  },

  // ==========================================================
  // POSSESSION
  // ==========================================================

  {
    label: 'Possession',
    value: PredictionMarkets.POSSESSION_WINNER,
    selections: [
      {
        label: 'Home',
        value: 'HOME_POSSESSION_WINNER',
      },
      {
        label: 'Away',
        value: 'AWAY_POSSESSION_WINNER',
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
        value: 'HOME_MOST_SHOTS',
      },
      {
        label: 'Away',
        value: 'AWAY_MOST_SHOTS',
      },
      {
        label: 'Draw',
        value: 'EQUAL_SHOTS',
      },
    ],
  },

  // ==========================================================
  // MOST SHOTS ON TARGET
  // ==========================================================

  {
    label: 'Most SOT',
    value: PredictionMarkets.MOST_SHOTS_ON_TARGET,
    selections: [
      {
        label: 'Home',
        value: 'HOME_MOST_SHOTS_ON_TARGET',
      },
      {
        label: 'Away',
        value: 'AWAY_MOST_SHOTS_ON_TARGET',
      },
      {
        label: 'Draw',
        value: 'EQUAL_SHOTS_ON_TARGET',
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
      { label: 'Over 0.5', value: 'OVER_0_5' },
      { label: 'Over 1.5', value: 'OVER_1_5' },
      { label: 'Over 2.5', value: 'OVER_2_5' },
      { label: 'Under 0.5', value: 'UNDER_0_5' },
      { label: 'Under 1.5', value: 'UNDER_1_5' },
      { label: 'Under 2.5', value: 'UNDER_2_5' },
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
      { label: 'Over 1.5', value: 'OVER_1_5' },
      { label: 'Over 2.5', value: 'OVER_2_5' },
      { label: 'Under 0.5', value: 'UNDER_0_5' },
      { label: 'Under 1.5', value: 'UNDER_1_5' },
      { label: 'Under 2.5', value: 'UNDER_2_5' },
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
        label: '0–15 Min',
        value: 'GOAL_BEFORE_15',
      },
      {
        label: '16–30 Min',
        value: 'GOAL_16_30',
      },
      {
        label: '31–45 Min',
        value: 'GOAL_31_45',
      },
      {
        label: '46–60 Min',
        value: 'GOAL_46_60',
      },
      {
        label: '61–75 Min',
        value: 'GOAL_61_75',
      },
      {
        label: '76–90 Min',
        value: 'GOAL_76_90',
      },
      {
        label: 'No Goal',
        value: 'NO_GOAL',
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
      { label: 'Over 2.5', value: 'OVER_2_5' },
      { label: 'Over 3.5', value: 'OVER_3_5' },
      { label: 'Over 4.5', value: 'OVER_4_5' },
      { label: 'Under 2.5', value: 'UNDER_2_5' },
      { label: 'Under 3.5', value: 'UNDER_3_5' },
      { label: 'Under 4.5', value: 'UNDER_4_5' },
    ],
  },

  // ==========================================================
  // FIRST HALF CARDS
  // ==========================================================

  {
    label: '1H Cards',
    value: PredictionMarkets.FIRST_HALF_CARDS,
    selections: [
      { label: 'Over 0.5', value: 'OVER_0_5' },
      { label: 'Over 1.5', value: 'OVER_1_5' },
      { label: 'Over 2.5', value: 'OVER_2_5' },
      { label: 'Under 0.5', value: 'UNDER_0_5' },
      { label: 'Under 1.5', value: 'UNDER_1_5' },
      { label: 'Under 2.5', value: 'UNDER_2_5' },
    ],
  },

  // ==========================================================
  // TOTAL OFFSIDES
  // ==========================================================

  {
    label: 'Total Offsides',
    value: PredictionMarkets.OFFSIDES_TOTAL,
    selections: [
      { label: 'Over 1.5', value: 'OVER_1_5' },
      { label: 'Over 2.5', value: 'OVER_2_5' },
      { label: 'Over 3.5', value: 'OVER_3_5' },
      { label: 'Over 4.5', value: 'OVER_4_5' },
      { label: 'Under 1.5', value: 'UNDER_1_5' },
      { label: 'Under 2.5', value: 'UNDER_2_5' },
      { label: 'Under 3.5', value: 'UNDER_3_5' },
      { label: 'Under 4.5', value: 'UNDER_4_5' },
    ],
  },

  // ==========================================================
  // TEAM OFFSIDES
  // ==========================================================

  {
    label: 'Team Offsides',
    value: PredictionMarkets.TEAM_OFFSIDES,
    selections: [
      { label: 'Home Over 0.5', value: 'HOME_OVER_0_5' },
      { label: 'Home Over 1.5', value: 'HOME_OVER_1_5' },
      { label: 'Home Under 0.5', value: 'HOME_UNDER_0_5' },
      { label: 'Home Under 1.5', value: 'HOME_UNDER_1_5' },
      { label: 'Away Over 0.5', value: 'AWAY_OVER_0_5' },
      { label: 'Away Over 1.5', value: 'AWAY_OVER_1_5' },
      { label: 'Away Under 0.5', value: 'AWAY_UNDER_0_5' },
      { label: 'Away Under 1.5', value: 'AWAY_UNDER_1_5' },
    ],
  },

  // ==========================================================
  // TOTAL FOULS
  // ==========================================================

  {
    label: 'Total Fouls',
    value: PredictionMarkets.FOULS_TOTAL,
    selections: [
      { label: 'Over 20.5', value: 'OVER_20_5' },
      { label: 'Over 25.5', value: 'OVER_25_5' },
      { label: 'Over 30.5', value: 'OVER_30_5' },
      { label: 'Over 35.5', value: 'OVER_35_5' },
      { label: 'Under 20.5', value: 'UNDER_20_5' },
      { label: 'Under 25.5', value: 'UNDER_25_5' },
      { label: 'Under 30.5', value: 'UNDER_30_5' },
      { label: 'Under 35.5', value: 'UNDER_35_5' },
    ],
  },

  // ==========================================================
  // TEAM FOULS
  // ==========================================================

  {
    label: 'Team Fouls',
    value: PredictionMarkets.TEAM_FOULS,
    selections: [
      { label: 'Home Over 10.5', value: 'HOME_OVER_10_5' },
      { label: 'Home Over 12.5', value: 'HOME_OVER_12_5' },
      { label: 'Home Over 15.5', value: 'HOME_OVER_15_5' },
      { label: 'Away Over 10.5', value: 'AWAY_OVER_10_5' },
      { label: 'Away Over 12.5', value: 'AWAY_OVER_12_5' },
      { label: 'Away Over 15.5', value: 'AWAY_OVER_15_5' },
    ],
  },

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
        label: 'BTTS + Over 2.5',
        value: 'BTTS_OVER_2_5',
      },
      {
        label: 'BTTS + Over 3.5',
        value: 'BTTS_OVER_3_5',
      },
      {
        label: 'BTTS + Under 2.5',
        value: 'BTTS_UNDER_2_5',
      },
      {
        label: 'BTTS + Under 3.5',
        value: 'BTTS_UNDER_3_5',
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
    ],
  },

  // ==========================================================
  // EXACT GOALS
  // ==========================================================

  {
    label: 'Exact Goals',
    value: PredictionMarkets.EXACT_GOALS,
    selections: [
      { label: '0', value: 'EXACT_0' },
      { label: '1', value: 'EXACT_1' },
      { label: '2', value: 'EXACT_2' },
      { label: '3', value: 'EXACT_3' },
      { label: '4', value: 'EXACT_4' },
      { label: '5', value: 'EXACT_5' },
      { label: '6+', value: 'EXACT_6_PLUS' },
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
