import { PredictionMarket } from '../enums/prediction-market.enum';

export interface ValueResult {
  market: PredictionMarket;

  selection: string;

  /**
   * Final model probability.
   */
  modelProbability: number;

  /**
   * Fair decimal odds calculated from the model probability.
   */
  fairOdds: number | null;

  /**
   * Pricing method used to derive the internally calculated
   * fair odds.
   *
   * No bookmaker or external market price is involved.
   */
  pricingMethod:
    | 'PROBABILITY'
    | 'DRAW_NO_BET'
    | 'ASIAN_HANDICAP'
    | 'UNAVAILABLE';

  /**
   * Settlement probabilities for markets with WIN,
   * PUSH/REFUND, and LOSS outcomes.
   */
  winProbability?: number;

  pushProbability?: number;

  lossProbability?: number;

  /**
   * True when a mathematically valid model-derived fair price
   * was produced.
   *
   * This does not indicate positive betting value.
   */
  hasFairOdds: boolean;
}
