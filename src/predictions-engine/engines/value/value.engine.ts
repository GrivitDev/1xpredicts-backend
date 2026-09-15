import { Injectable } from '@nestjs/common';

import { MarketModelInput } from '../../interfaces/market-model-input.interface';
import { ValueResult } from '../../interfaces/value-result.interface';

import { MarketProbabilityUtil } from '../../utils/probability.util';
import { PredictionMathUtil } from '../../utils/prediction-math.util';

@Injectable()
export class ValueEngine {
  calculate(
    input: MarketModelInput,
    modelProbability: number,
    fairOdds?: number | null,
    bookmakerOdds?: number | null,
  ): ValueResult {
    const normalizedProbability = MarketProbabilityUtil.clamp(
      modelProbability,
      0,
      1,
    );

    const normalizedFairOdds =
      typeof fairOdds === 'number' && Number.isFinite(fairOdds) && fairOdds >= 1
        ? fairOdds
        : normalizedProbability > 0
          ? 1 / normalizedProbability
          : undefined;

    /*
     * ----------------------------------------------------------
     * NO BOOKMAKER ODDS
     * ----------------------------------------------------------
     *
     * We can price our own model, but we cannot claim positive
     * betting value without an external market price.
     */
    if (
      typeof bookmakerOdds !== 'number' ||
      !Number.isFinite(bookmakerOdds) ||
      bookmakerOdds <= 1
    ) {
      return {
        market: input.market,
        selection: input.selection,

        fairOdds: normalizedFairOdds,

        modelProbability: PredictionMathUtil.round(normalizedProbability, 6),

        probabilityEdge: 0,

        valueScore: 0,

        hasValue: false,
      };
    }

    const impliedProbability = 1 / bookmakerOdds;

    const edge = normalizedProbability - impliedProbability;

    const expectedValue = normalizedProbability * bookmakerOdds - 1;

    const valueScore = PredictionMathUtil.round(
      PredictionMathUtil.clamp(edge * 100, -100, 100),
      2,
    );

    return {
      market: input.market,
      selection: input.selection,

      availableOdds: bookmakerOdds,

      impliedProbability,

      fairOdds: normalizedFairOdds,

      modelProbability: PredictionMathUtil.round(normalizedProbability, 6),

      probabilityEdge: edge,

      expectedValue,

      valueScore,

      hasValue: Number.isFinite(edge) && edge > 0,
    };
  }
}
