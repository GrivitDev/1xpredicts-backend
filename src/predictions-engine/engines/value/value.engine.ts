import { Injectable } from '@nestjs/common';

import { PredictionMarket } from '../../enums/prediction-market.enum';
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
     * MarketModelInput currently does not expose bookmaker implied
     * probabilities, so bookmaker value cannot be established here.
     * Do not infer or fabricate bookmaker odds.
     */
    const bookmakerProbability: number | null = null;

    if (bookmakerProbability === null) {
      return {
        market: input.market,
        selection: input.selection,
        modelProbability: normalizedProbability,
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
      modelProbability: normalizedProbability,
      probabilityEdge: edge,
      expectedValue,
      valueScore,
      hasValue: edge > 0,
    };
  }

  private findBookmakerProbability(
    market: PredictionMarket,
    selection: string,
    probabilities: Record<string, number>,
  ): number | null {
    const keys = this.getProbabilityKeys(market, selection);

    for (const key of keys) {
      const value = probabilities[key];

      if (
        typeof value === 'number' &&
        Number.isFinite(value) &&
        value > 0 &&
        value <= 1
      ) {
        return value;
      }
    }

    return null;
  }

  private getProbabilityKeys(
    market: PredictionMarket,
    selection: string,
  ): string[] {
    switch (market) {
      case PredictionMarket.DOUBLE_CHANCE:
        return [
          `DOUBLE_CHANCE_${selection}`,
          `DOUBLE_CHANCE_${selection.replaceAll('OR_', '_OR_')}`,
        ];

      case PredictionMarket.DRAW_NO_BET:
        return [`DNB_${selection}`, `DRAW_NO_BET_${selection}`];

      case PredictionMarket.BOTH_TEAMS_TO_SCORE:
        return [`BTTS_${selection}`, `BOTH_TEAMS_TO_SCORE_${selection}`];

      case PredictionMarket.BTTS_GOALS:
        return [`BTTS_GOALS_${selection}`];

      case PredictionMarket.OVER_UNDER:
        return [`TOTALS_${selection}`];

      default:
        return [`${market}_${selection}`, selection];
    }
  }
}
