// src/predictions-engine/engines/value/odds-calculation.service.ts

import { Injectable } from '@nestjs/common';

import { PredictionMarket } from '../../enums/prediction-market.enum';

import { ProbabilityModelResult } from '../../interfaces/probability-result.interface';
import { OddsResult } from '../../interfaces/odds-result.interface';

@Injectable()
export class OddsCalculationService {
  calculate(result: ProbabilityModelResult): OddsResult {
    const probability = this.clamp(result.probability, 0, 1);

    if (!Number.isFinite(probability) || probability <= 0) {
      return {
        market: result.market,
        selection: result.selection,
        modelProbability: 0,
        fairOdds: null,
        pricingMethod: 'UNAVAILABLE',
      };
    }

    /*
     * ----------------------------------------------------------
     * ASIAN HANDICAP
     * ----------------------------------------------------------
     *
     * Asian settlement may contain:
     *
     *   - win
     *   - push/refund
     *   - loss
     *
     * Fair decimal odds satisfy:
     *
     *   win * (odds - 1) - loss = 0
     *
     * Therefore:
     *
     *   odds = 1 + loss / win
     *
     * The probability layer must provide the exact settlement
     * probabilities for the requested handicap.
     *
     * We do NOT fall back to 1 / probability here because the
     * ordinary probability is not sufficient to price an Asian
     * handicap correctly when push/refund probability exists.
     */
    if (result.market === PredictionMarket.ASIAN_HANDICAP) {
      const winProbability = this.getModelOutput(result, 'winProbability');

      const pushProbability = this.getModelOutput(result, 'pushProbability');

      const lossProbability = this.getModelOutput(result, 'lossProbability');

      if (winProbability === null || lossProbability === null) {
        return {
          market: result.market,
          selection: result.selection,

          modelProbability: this.round(probability, 6),

          fairOdds: null,

          winProbability:
            winProbability !== null ? this.round(winProbability, 6) : undefined,

          pushProbability:
            pushProbability !== null
              ? this.round(pushProbability, 6)
              : undefined,

          lossProbability:
            lossProbability !== null
              ? this.round(lossProbability, 6)
              : undefined,

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

          pushProbability:
            pushProbability !== null
              ? this.round(pushProbability, 6)
              : undefined,

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

          pushProbability:
            pushProbability !== null
              ? this.round(pushProbability, 6)
              : undefined,

          lossProbability: this.round(lossProbability, 6),

          pricingMethod: 'UNAVAILABLE',
        };
      }

      return {
        market: result.market,
        selection: result.selection,

        modelProbability: this.round(probability, 6),

        fairOdds: this.round(this.clamp(fairOdds, 1, 1000), 4),

        winProbability: this.round(winProbability, 6),

        pushProbability:
          pushProbability !== null ? this.round(pushProbability, 6) : undefined,

        lossProbability: this.round(lossProbability, 6),

        pricingMethod: 'ASIAN_HANDICAP',
      };
    }

    /*
     * ----------------------------------------------------------
     * EUROPEAN HANDICAP / ORDINARY MARKETS
     * ----------------------------------------------------------
     *
     * These markets use the final reconciled probability directly.
     */
    const fairOdds = 1 / probability;

    return {
      market: result.market,
      selection: result.selection,

      modelProbability: this.round(probability, 6),

      fairOdds: this.round(this.clamp(fairOdds, 1, 1000), 4),

      pricingMethod: 'PROBABILITY',
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
