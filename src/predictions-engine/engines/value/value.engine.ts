// src/prediction/engines/value.engine.ts

import { Injectable } from '@nestjs/common';

import { MarketModelInput } from '../../interfaces/market-model-input.interface';
import { ValueResult } from '../../interfaces/value-result.interface';
import { MarketProbabilityUtil } from '../../utils/probability.util';
import { PredictionMathUtil } from '../../utils/prediction-math.util';

@Injectable()
export class ValueEngine {
  calculate(input: MarketModelInput, modelProbability: number): ValueResult {
    const normalizedProbability = MarketProbabilityUtil.clamp(
      modelProbability,
      0,
      1,
    );

    /*
     * Odds are not yet part of MarketModelInput.
     *
     * Do not fabricate bookmaker odds, implied probability,
     * expected value, or betting edge.
     *
     * The prediction engine should continue producing genuine
     * statistical predictions without pretending that market
     * value has been calculated.
     */
    const bookmakerProbability: number | null = null;

    if (bookmakerProbability === null) {
      return {
        market: input.market,
        selection: input.selection,

        modelProbability: PredictionMathUtil.round(normalizedProbability, 6),

        probabilityEdge: 0,

        valueScore: 0,

        hasValue: false,
      };
    }

    const edge = normalizedProbability - bookmakerProbability;

    const odds =
      bookmakerProbability > 0 ? 1 / bookmakerProbability : undefined;

    const expectedValue =
      odds !== undefined ? normalizedProbability * odds - 1 : undefined;

    const valueScore = PredictionMathUtil.round(
      PredictionMathUtil.clamp(edge * 100, -100, 100),
      2,
    );

    return {
      market: input.market,
      selection: input.selection,

      availableOdds: odds,

      impliedProbability: bookmakerProbability,

      modelProbability: PredictionMathUtil.round(normalizedProbability, 6),

      probabilityEdge: edge,

      expectedValue,

      valueScore,

      hasValue: Number.isFinite(edge) && edge > 0,
    };
  }
}
