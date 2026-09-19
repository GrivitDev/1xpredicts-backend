import { Injectable } from '@nestjs/common';

import { PredictionMarket } from '../../enums/prediction-market.enum';

import { ProbabilityModelResult } from '../../interfaces/probability-result.interface';
import { OddsResult } from '../../interfaces/odds-result.interface';

@Injectable()
export class OddsCalculationService {
  calculate(result: ProbabilityModelResult): OddsResult {
    const probability = this.normalizeProbability(result.probability);

    if (probability === null || probability <= 0) {
      return {
        market: result.market,
        selection: result.selection,
        modelProbability: 0,
        fairOdds: null,
        pricingMethod: 'UNAVAILABLE',
      };
    }

    /*
     * ==========================================================
     * SETTLEMENT-BASED MARKETS
     * ==========================================================
     *
     * DRAW_NO_BET and ASIAN_HANDICAP have three possible
     * settlement states:
     *
     *   WIN
     *   PUSH / REFUND
     *   LOSS
     *
     * Fair decimal odds therefore use:
     *
     *   P(win) * (odds - 1) - P(loss) = 0
     *
     * which gives:
     *
     *   odds = 1 + P(loss) / P(win)
     *
     * Push probability does not create profit or loss, so it does
     * not appear in the final ratio.
     */
    if (
      result.market === PredictionMarket.DRAW_NO_BET ||
      result.market === PredictionMarket.ASIAN_HANDICAP
    ) {
      return this.calculateSettlementOdds(
        result,
        probability,
        result.market === PredictionMarket.ASIAN_HANDICAP
          ? 'ASIAN_HANDICAP'
          : 'DRAW_NO_BET',
      );
    }

    /*
     * ==========================================================
     * ALL ORDINARY MARKETS
     * ==========================================================
     *
     * Fair decimal odds:
     *
     *              1
     *   odds = -----------
     *           probability
     *
     * This is the model's own fair price.
     *
     * No bookmaker price is involved.
     */
    const fairOdds = 1 / probability;

    if (!Number.isFinite(fairOdds) || fairOdds < 1) {
      return {
        market: result.market,
        selection: result.selection,

        modelProbability: this.round(probability, 6),

        fairOdds: null,

        pricingMethod: 'UNAVAILABLE',
      };
    }

    return {
      market: result.market,
      selection: result.selection,

      modelProbability: this.round(probability, 6),

      fairOdds: this.round(fairOdds, 6),

      pricingMethod: 'PROBABILITY',
    };
  }

  private calculateSettlementOdds(
    result: ProbabilityModelResult,
    probability: number,
    pricingMethod: 'DRAW_NO_BET' | 'ASIAN_HANDICAP',
  ): OddsResult {
    const winProbability = this.getModelOutput(result, 'winProbability');

    const pushProbability = this.getModelOutput(result, 'pushProbability');

    const lossProbability = this.getModelOutput(result, 'lossProbability');

    if (
      winProbability === null ||
      pushProbability === null ||
      lossProbability === null
    ) {
      return {
        market: result.market,
        selection: result.selection,

        modelProbability: this.round(probability, 6),

        fairOdds: null,

        winProbability:
          winProbability !== null ? this.round(winProbability, 6) : undefined,

        pushProbability:
          pushProbability !== null ? this.round(pushProbability, 6) : undefined,

        lossProbability:
          lossProbability !== null ? this.round(lossProbability, 6) : undefined,

        pricingMethod: 'UNAVAILABLE',
      };
    }

    if (winProbability <= 0) {
      return {
        market: result.market,
        selection: result.selection,

        modelProbability: this.round(probability, 6),

        fairOdds: null,

        winProbability: 0,

        pushProbability: this.round(pushProbability, 6),

        lossProbability: this.round(lossProbability, 6),

        pricingMethod: 'UNAVAILABLE',
      };
    }

    const settlementTotal = winProbability + pushProbability + lossProbability;

    /*
     * WIN + PUSH + LOSS must represent the complete settlement
     * probability space.
     */
    if (
      !Number.isFinite(settlementTotal) ||
      settlementTotal <= 0 ||
      Math.abs(settlementTotal - 1) > 0.00001
    ) {
      return {
        market: result.market,
        selection: result.selection,

        modelProbability: this.round(probability, 6),

        fairOdds: null,

        winProbability: this.round(winProbability, 6),

        pushProbability: this.round(pushProbability, 6),

        lossProbability: this.round(lossProbability, 6),

        pricingMethod: 'UNAVAILABLE',
      };
    }

    const fairOdds = 1 + lossProbability / winProbability;

    if (!Number.isFinite(fairOdds) || fairOdds < 1) {
      return {
        market: result.market,
        selection: result.selection,

        modelProbability: this.round(probability, 6),

        fairOdds: null,

        winProbability: this.round(winProbability, 6),

        pushProbability: this.round(pushProbability, 6),

        lossProbability: this.round(lossProbability, 6),

        pricingMethod: 'UNAVAILABLE',
      };
    }

    return {
      market: result.market,
      selection: result.selection,

      modelProbability: this.round(probability, 6),

      fairOdds: this.round(fairOdds, 6),

      winProbability: this.round(winProbability, 6),

      pushProbability: this.round(pushProbability, 6),

      lossProbability: this.round(lossProbability, 6),

      pricingMethod,
    };
  }

  private getModelOutput(
    result: ProbabilityModelResult,
    key: string,
  ): number | null {
    const value = result.modelOutputs?.[key];

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return null;
    }

    return this.clamp(value, 0, 1);
  }

  private normalizeProbability(value: number): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return null;
    }

    return this.clamp(value, 0, 1);
  }

  private round(value: number, decimals: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    const factor = Math.pow(10, decimals);

    return Math.round(value * factor) / factor;
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
