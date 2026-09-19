import { Injectable } from '@nestjs/common';

import { MarketModelInput } from '../../interfaces/market-model-input.interface';
import { ProbabilityModelResult } from '../../interfaces/probability-result.interface';
import { ValueResult } from '../../interfaces/value-result.interface';

import { OddsCalculationService } from './odds-calculation.service';

@Injectable()
export class ValueEngine {
  constructor(
    private readonly oddsCalculationService: OddsCalculationService,
  ) {}

  calculate(
    input: MarketModelInput,
    probability: ProbabilityModelResult,
  ): ValueResult {
    /*
     * The value layer does not obtain or compare against any
     * external price.
     *
     * The probability model is the source of the estimated
     * probability, and the odds layer converts that probability
     * into the model's own fair decimal price.
     */
    const odds = this.oddsCalculationService.calculate(probability);

    return {
      market: input.market,
      selection: input.selection,

      modelProbability: odds.modelProbability,

      fairOdds: odds.fairOdds,

      pricingMethod: odds.pricingMethod,

      winProbability: odds.winProbability,

      pushProbability: odds.pushProbability,

      lossProbability: odds.lossProbability,

      hasFairOdds:
        odds.fairOdds !== null &&
        Number.isFinite(odds.fairOdds) &&
        odds.fairOdds >= 1,
    };
  }
}
