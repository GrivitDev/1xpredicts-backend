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
     * Asian handicap can contain a push/refund outcome.
     *
     * The ProbabilityModelResult from HandicapMarketEngine
     * exposes:
     *
     *   winProbability
     *   pushProbability
     *   lossProbability
     *
     * Fair decimal odds satisfy:
     *
     *   win * (odds - 1) - loss = 0
     *
     * Therefore:
     *
     *   odds = 1 + loss / win
     */
    if (result.market === PredictionMarket.ASIAN_HANDICAP) {
      const winProbability = this.getModelOutput(result, 'winProbability');

      const pushProbability = this.getModelOutput(result, 'pushProbability');

      const lossProbability = this.getModelOutput(result, 'lossProbability');

      if (
        winProbability !== null &&
        lossProbability !== null &&
        winProbability > 0
      ) {
        const fairOdds = 1 + lossProbability / winProbability;

        return {
          market: result.market,
          selection: result.selection,
          modelProbability: this.round(probability, 6),
          fairOdds: this.round(this.clamp(fairOdds, 1, 1000), 4),
          winProbability: this.round(winProbability, 6),
          pushProbability:
            pushProbability !== null
              ? this.round(pushProbability, 6)
              : undefined,
          lossProbability: this.round(lossProbability, 6),
          pricingMethod: 'ASIAN_HANDICAP',
        };
      }
    }

    /*
     * ----------------------------------------------------------
     * STANDARD FAIR ODDS
     * ----------------------------------------------------------
     *
     * For every ordinary market outcome:
     *
     *   fair odds = 1 / probability
     *
     * No bookmaker margin is added.
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
