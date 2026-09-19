import { PredictionMarket } from '../enums/prediction-market.enum';

export interface OddsResult {
  market: PredictionMarket;

  selection: string;

  /**
   * Final probability produced by the probability layer.
   *
   * Range:
   *
   *   0 <= probability <= 1
   */
  modelProbability: number;

  /**
   * Model-derived fair decimal odds.
   *
   * Ordinary markets:
   *
   *   fairOdds = 1 / modelProbability
   *
   * Settlement-aware markets:
   *
   *   fairOdds = 1 + lossProbability / winProbability
   *
   * Null means the available probability data is insufficient
   * to produce a mathematically valid fair price.
   */
  fairOdds: number | null;

  /**
   * Settlement probabilities used where the market requires
   * settlement-aware pricing.
   */
  winProbability?: number;

  pushProbability?: number;

  lossProbability?: number;

  /**
   * Pricing method used to calculate the internal fair odds.
   *
   * No bookmaker or external market price is involved.
   */
  pricingMethod:
    | 'PROBABILITY'
    | 'DRAW_NO_BET'
    | 'ASIAN_HANDICAP'
    | 'UNAVAILABLE';
}
