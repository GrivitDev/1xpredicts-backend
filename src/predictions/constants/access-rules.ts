import { PredictionMarkets } from './prediction-markets';

export const PredictionAccessRules = {
  free: {
    releaseHoursBeforeKickoff: 72,

    showProbabilities: false,

    allowedMarkets: [
      PredictionMarkets.BOTH_TEAMS_TO_SCORE,
      PredictionMarkets.DOUBLE_CHANCE,
      PredictionMarkets.OVER_UNDER,
    ],
  },

  regular: {
    releaseHoursBeforeKickoff: 168,

    showProbabilities: true,

    allowedMarkets: [
      PredictionMarkets.CLEAN_SHEET,
      PredictionMarkets.DOUBLE_CHANCE,
      PredictionMarkets.OVER_UNDER,
      PredictionMarkets.BOTH_TEAMS_TO_SCORE,
      PredictionMarkets.DRAW_NO_BET,
    ],
  },

  vip: {
    releaseHoursBeforeKickoff: 240,

    showProbabilities: true,

    // null = every market
    allowedMarkets: null,
  },
} as const;
