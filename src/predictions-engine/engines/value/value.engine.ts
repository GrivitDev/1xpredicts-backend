// src/predictions-engine/engines/value/value.engine.ts

import { Injectable } from '@nestjs/common';

import { MarketModelInput } from '../../interfaces/market-model-input.interface';
import { ValueResult } from '../../interfaces/value-result.interface';

import { PredictionMathUtil } from '../../utils/prediction-math.util';
import { OddsCalculationService } from './odds-calculation.service';

@Injectable()
export class ValueEngine {
  constructor(
    private readonly oddsCalculationService: OddsCalculationService,
  ) {}

  calculate(
    input: MarketModelInput,
    modelProbability: number,
    fairOdds?: number | null,
    bookmakerOdds?: number | null,
  ): ValueResult {
    const normalizedProbability = PredictionMathUtil.clamp(
      modelProbability,
      0,
      1,
    );

    /*
     * ----------------------------------------------------------
     * MODEL-DERIVED FAIR PRICE
     * ----------------------------------------------------------
     *
     * Value uses the final reconciled probability already produced
     * by the probability layer.
     *
     * When the caller supplies fairOdds, that price is preserved.
     * Otherwise the ordinary probability-derived fair price is used.
     *
     * Asian handicap fair odds should normally be supplied by
     * OddsCalculationService because push/refund settlement must
     * be included in its pricing calculation.
     */
    const normalizedFairOdds = this.resolveFairOdds(
      normalizedProbability,
      fairOdds,
    );

    /*
     * ----------------------------------------------------------
     * NO BOOKMAKER ODDS
     * ----------------------------------------------------------
     *
     * Fair price can still be calculated, but market value cannot
     * be established without an external bookmaker price.
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

    const impliedProbability = PredictionMathUtil.clamp(
      1 / bookmakerOdds,
      0,
      1,
    );

    const edge = normalizedProbability - impliedProbability;

    const expectedValue = normalizedProbability * bookmakerOdds - 1;

    const valueScore = PredictionMathUtil.round(
      PredictionMathUtil.clamp(edge * 100, -100, 100),
      2,
    );

    /*
     * Value is descriptive.
     *
     * Low probability does not automatically mean no value.
     * Value exists when the bookmaker price implies a lower
     * probability than the model's final reconciled probability.
     */
    const hasValue = Number.isFinite(edge) && edge > 0;

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

      hasValue,
    };
  }

  private resolveFairOdds(
    probability: number,
    suppliedFairOdds?: number | null,
  ): number | undefined {
    if (
      typeof suppliedFairOdds === 'number' &&
      Number.isFinite(suppliedFairOdds) &&
      suppliedFairOdds >= 1
    ) {
      return PredictionMathUtil.round(
        PredictionMathUtil.clamp(suppliedFairOdds, 1, 1000),
        4,
      );
    }

    if (probability <= 0) {
      return undefined;
    }

    return PredictionMathUtil.round(
      PredictionMathUtil.clamp(1 / probability, 1, 1000),
      4,
    );
  }
}
