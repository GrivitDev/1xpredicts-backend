import { PredictionMarket } from '../enums/prediction-market.enum';

export interface PredictionMarketSelection {
  value: string;
  label: string;
}

export interface PredictionMarketDefinition {
  market: PredictionMarket;
  label: string;
  selections: PredictionMarketSelection[];
}

export const PREDICTION_MARKET_DEFINITIONS: PredictionMarketDefinition[] = [
  {
    market: PredictionMarket.OVER_UNDER,
    label: 'Goals O/U',
    selections: [
      { value: 'OVER_0_5', label: 'Over 0.5' },
      { value: 'UNDER_0_5', label: 'Under 0.5' },
      { value: 'OVER_1_5', label: 'Over 1.5' },
      { value: 'UNDER_1_5', label: 'Under 1.5' },
      { value: 'OVER_2_5', label: 'Over 2.5' },
      { value: 'UNDER_2_5', label: 'Under 2.5' },
      { value: 'OVER_3_5', label: 'Over 3.5' },
      { value: 'UNDER_3_5', label: 'Under 3.5' },
      { value: 'OVER_4_5', label: 'Over 4.5' },
      { value: 'UNDER_4_5', label: 'Under 4.5' },
      { value: 'OVER_5_5', label: 'Over 5.5' },
      { value: 'UNDER_5_5', label: 'Under 5.5' },
      { value: 'OVER_6_5', label: 'Over 6.5' },
      { value: 'UNDER_6_5', label: 'Under 6.5' },
      { value: 'OVER_7_5', label: 'Over 7.5' },
      { value: 'UNDER_7_5', label: 'Under 7.5' },
    ],
  },

  {
    market: PredictionMarket.BOTH_TEAMS_TO_SCORE,
    label: 'BTTS',
    selections: [
      { value: 'BTTS_YES', label: 'Yes' },
      { value: 'BTTS_NO', label: 'No' },
    ],
  },

  {
    market: PredictionMarket.DOUBLE_CHANCE,
    label: 'Double Chance',
    selections: [
      { value: 'HOME_DRAW', label: '1X — Home or Draw' },
      { value: 'DRAW_AWAY', label: 'X2 — Draw or Away' },
      { value: 'HOME_AWAY', label: '12 — Home or Away' },
    ],
  },

  {
    market: PredictionMarket.DRAW_NO_BET,
    label: 'Draw No Bet',
    selections: [
      { value: 'HOME', label: 'Home' },
      { value: 'AWAY', label: 'Away' },
    ],
  },

  {
    market: PredictionMarket.GOAL_RANGE,
    label: 'Goal Range',
    selections: [
      { value: 'GOALS_0_1', label: '0–1 Goals' },
      { value: 'GOALS_2_3', label: '2–3 Goals' },
      { value: 'GOALS_4_5', label: '4–5 Goals' },
      { value: 'GOALS_6_7', label: '6–7 Goals' },
      { value: 'GOALS_8_PLUS', label: '8+ Goals' },
    ],
  },

  {
    market: PredictionMarket.TEAM_TOTAL_GOALS,
    label: 'Team Goals',
    selections: [
      { value: 'HOME_OVER_0_5', label: 'Home Over 0.5' },
      { value: 'HOME_UNDER_0_5', label: 'Home Under 0.5' },
      { value: 'HOME_OVER_1_5', label: 'Home Over 1.5' },
      { value: 'HOME_UNDER_1_5', label: 'Home Under 1.5' },
      { value: 'HOME_OVER_2_5', label: 'Home Over 2.5' },
      { value: 'HOME_UNDER_2_5', label: 'Home Under 2.5' },
      { value: 'HOME_OVER_3_5', label: 'Home Over 3.5' },
      { value: 'HOME_UNDER_3_5', label: 'Home Under 3.5' },
      { value: 'HOME_OVER_4_5', label: 'Home Over 4.5' },
      { value: 'HOME_UNDER_4_5', label: 'Home Under 4.5' },
      { value: 'AWAY_OVER_0_5', label: 'Away Over 0.5' },
      { value: 'AWAY_UNDER_0_5', label: 'Away Under 0.5' },
      { value: 'AWAY_OVER_1_5', label: 'Away Over 1.5' },
      { value: 'AWAY_UNDER_1_5', label: 'Away Under 1.5' },
      { value: 'AWAY_OVER_2_5', label: 'Away Over 2.5' },
      { value: 'AWAY_UNDER_2_5', label: 'Away Under 2.5' },
      { value: 'HOME_OVER_3_5', label: 'Home Over 3.5' },
      { value: 'HOME_UNDER_3_5', label: 'Home Under 3.5' },
      { value: 'AWAY_OVER_3_5', label: 'Away Over 3.5' },
      { value: 'AWAY_UNDER_3_5', label: 'Away Under 3.5' },
      { value: 'HOME_OVER_4_5', label: 'Home Over 4.5' },
      { value: 'HOME_UNDER_4_5', label: 'Home Under 4.5' },
      { value: 'AWAY_OVER_4_5', label: 'Away Over 4.5' },
      { value: 'AWAY_UNDER_4_5', label: 'Away Under 4.5' },
    ],
  },

  {
    market: PredictionMarket.ASIAN_HANDICAP,
    label: 'Asian Handicap',
    selections: [
      { value: 'HOME_MINUS_3_5', label: 'Home -3.5' },
      { value: 'HOME_MINUS_3', label: 'Home -3' },
      { value: 'HOME_MINUS_2_5', label: 'Home -2.5' },
      { value: 'HOME_MINUS_2', label: 'Home -2' },
      { value: 'HOME_MINUS_1_5', label: 'Home -1.5' },
      { value: 'HOME_MINUS_1', label: 'Home -1' },
      { value: 'HOME_MINUS_0_5', label: 'Home -0.5' },
      { value: 'HOME_PLUS_0_5', label: 'Home +0.5' },
      { value: 'HOME_PLUS_1', label: 'Home +1' },
      { value: 'HOME_PLUS_1_5', label: 'Home +1.5' },
      { value: 'HOME_PLUS_2', label: 'Home +2' },
      { value: 'HOME_PLUS_2_5', label: 'Home +2.5' },
      { value: 'HOME_PLUS_3', label: 'Home +3' },
      { value: 'HOME_PLUS_3_5', label: 'Home +3.5' },

      { value: 'AWAY_MINUS_3_5', label: 'Away -3.5' },
      { value: 'AWAY_MINUS_3', label: 'Away -3' },
      { value: 'AWAY_MINUS_2_5', label: 'Away -2.5' },
      { value: 'AWAY_MINUS_2', label: 'Away -2' },
      { value: 'AWAY_MINUS_1_5', label: 'Away -1.5' },
      { value: 'AWAY_MINUS_1', label: 'Away -1' },
      { value: 'AWAY_MINUS_0_5', label: 'Away -0.5' },
      { value: 'AWAY_PLUS_0_5', label: 'Away +0.5' },
      { value: 'AWAY_PLUS_1', label: 'Away +1' },
      { value: 'AWAY_PLUS_1_5', label: 'Away +1.5' },
      { value: 'AWAY_PLUS_2', label: 'Away +2' },
      { value: 'AWAY_PLUS_2_5', label: 'Away +2.5' },
      { value: 'AWAY_PLUS_3', label: 'Away +3' },
      { value: 'AWAY_PLUS_3_5', label: 'Away +3.5' },
    ],
  },

  {
    market: PredictionMarket.EUROPEAN_HANDICAP,
    label: 'European Handicap',
    selections: [
      { value: 'HOME_MINUS_3', label: 'Home -3' },
      { value: 'HOME_MINUS_2', label: 'Home -2' },
      { value: 'HOME_MINUS_1', label: 'Home -1' },
      { value: 'HOME_0', label: 'Home 0' },
      { value: 'HOME_PLUS_1', label: 'Home +1' },
      { value: 'HOME_PLUS_2', label: 'Home +2' },
      { value: 'HOME_PLUS_3', label: 'Home +3' },

      { value: 'AWAY_MINUS_3', label: 'Away -3' },
      { value: 'AWAY_MINUS_2', label: 'Away -2' },
      { value: 'AWAY_MINUS_1', label: 'Away -1' },
      { value: 'AWAY_0', label: 'Away 0' },
      { value: 'AWAY_PLUS_1', label: 'Away +1' },
      { value: 'AWAY_PLUS_2', label: 'Away +2' },
      { value: 'AWAY_PLUS_3', label: 'Away +3' },
    ],
  },

  {
    market: PredictionMarket.CLEAN_SHEET,
    label: 'Clean Sheet',
    selections: [
      { value: 'HOME_CLEAN_SHEET', label: 'Home Clean Sheet' },
      { value: 'AWAY_CLEAN_SHEET', label: 'Away Clean Sheet' },
      { value: 'BOTH_CLEAN_SHEET', label: 'Both Clean Sheets' },
      { value: 'NO_CLEAN_SHEET', label: 'Neither Clean Sheet' },
    ],
  },

  {
    market: PredictionMarket.FIRST_HALF_GOALS,
    label: '1H Goals',
    selections: [
      { value: 'OVER_0_5', label: 'Over 0.5' },
      { value: 'UNDER_0_5', label: 'Under 0.5' },
      { value: 'OVER_1_5', label: 'Over 1.5' },
      { value: 'UNDER_1_5', label: 'Under 1.5' },
      { value: 'OVER_2_5', label: 'Over 2.5' },
      { value: 'UNDER_2_5', label: 'Under 2.5' },
      { value: 'OVER_3_5', label: 'Over 3.5' },
      { value: 'UNDER_3_5', label: 'Under 3.5' },
      { value: 'OVER_4_5', label: 'Over 4.5' },
      { value: 'UNDER_4_5', label: 'Under 4.5' },
    ],
  },

  {
    market: PredictionMarket.SECOND_HALF_GOALS,
    label: '2H Goals',
    selections: [
      { value: 'OVER_0_5', label: 'Over 0.5' },
      { value: 'UNDER_0_5', label: 'Under 0.5' },
      { value: 'OVER_1_5', label: 'Over 1.5' },
      { value: 'UNDER_1_5', label: 'Under 1.5' },
      { value: 'OVER_2_5', label: 'Over 2.5' },
      { value: 'UNDER_2_5', label: 'Under 2.5' },
      { value: 'OVER_3_5', label: 'Over 3.5' },
      { value: 'UNDER_3_5', label: 'Under 3.5' },
      { value: 'OVER_4_5', label: 'Over 4.5' },
      { value: 'UNDER_4_5', label: 'Under 4.5' },
    ],
  },

  {
    market: PredictionMarket.BTTS_GOALS,
    label: 'BTTS + Goals',
    selections: [
      { value: 'BTTS_OVER_1_5', label: 'BTTS + Over 1.5' },
      { value: 'BTTS_UNDER_1_5', label: 'BTTS + Under 1.5' },
      { value: 'BTTS_OVER_2_5', label: 'BTTS + Over 2.5' },
      { value: 'BTTS_UNDER_2_5', label: 'BTTS + Under 2.5' },
      { value: 'BTTS_OVER_3_5', label: 'BTTS + Over 3.5' },
      { value: 'BTTS_UNDER_3_5', label: 'BTTS + Under 3.5' },
      { value: 'BTTS_OVER_4_5', label: 'BTTS + Over 4.5' },
      { value: 'BTTS_UNDER_4_5', label: 'BTTS + Under 4.5' },
      { value: 'BTTS_HOME_WIN', label: 'BTTS + Home Win' },
      { value: 'BTTS_DRAW', label: 'BTTS + Draw' },
      { value: 'BTTS_AWAY_WIN', label: 'BTTS + Away Win' },
      { value: 'NO_BTTS_HOME_WIN', label: 'BTTS No + Home Win' },
      { value: 'NO_BTTS_DRAW', label: 'BTTS No + Draw' },
      { value: 'NO_BTTS_AWAY_WIN', label: 'BTTS No + Away Win' },
    ],
  },
];

export function getPredictionMarketDefinition(
  market: PredictionMarket,
): PredictionMarketDefinition | undefined {
  return PREDICTION_MARKET_DEFINITIONS.find(
    (definition) => definition.market === market,
  );
}
