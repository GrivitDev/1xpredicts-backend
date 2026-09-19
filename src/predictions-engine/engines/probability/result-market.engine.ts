// src/predictions-engine/engines/probability/markets/result.market-engine.ts

import { Injectable } from '@nestjs/common';

import { PredictionMarket } from '../../enums/prediction-market.enum';

import { MarketModel } from '../../interfaces/market-model.interface';

import { MarketModelInput } from '../../interfaces/market-model-input.interface';

import { ProbabilityModelResult } from '../../interfaces/probability-result.interface';

import { RawGoalModelUtil } from './raw-goal-model.util';

@Injectable()
export class ResultMarketEngine implements MarketModel {
  supports(market: PredictionMarket): boolean {
    return market === PredictionMarket.MATCH_RESULT;
  }

  calculate(input: MarketModelInput): ProbabilityModelResult {
    const goalModel = RawGoalModelUtil.calculate(input.features);

    /*
     * Match-result probability comes directly from the joint score
     * distribution.
     *
     * HOME:
     *   P(home goals > away goals)
     *
     * DRAW:
     *   P(home goals = away goals)
     *
     * AWAY:
     *   P(away goals > home goals)
     *
     * These probabilities are already derived from the underlying
     * goal-generation model. We do not re-blend comparison evidence
     * here because the comparison signals substantially reuse the
     * same historical/team evidence that produced the lambdas.
     */
    const probabilities = this.normalizeResultProbabilities({
      home: goalModel.homeWin,

      draw: goalModel.draw,

      away: goalModel.awayWin,
    });

    const probability = this.getResultProbability(
      input.selection,
      probabilities,
    );

    const sampleSize = Math.max(input.features.overallSampleSize ?? 0, 0);

    const dataQuality = this.clamp(
      input.features.overallDataQuality ?? 0,
      0,
      100,
    );

    const comparisonConfidence = this.clamp(
      input.features.comparison?.confidence ?? 0,
      0,
      1,
    );

    const directionalDifference = this.clamp(
      input.features.comparison?.directionalDifference ?? 0,
      -1,
      1,
    );

    const goalProductionDifference = this.clamp(
      input.features.comparison?.goalProduction?.difference ?? 0,
      -1,
      1,
    );

    const goalPreventionDifference = this.clamp(
      input.features.comparison?.goalPrevention?.difference ?? 0,
      -1,
      1,
    );

    const modelReliability = this.calculateReliability(sampleSize, dataQuality);

    return {
      market: PredictionMarket.MATCH_RESULT,

      selection: input.selection,

      probability,

      /*
       * Supporting probability remains the probability produced by
       * the result model. It must not become a second probability
       * generated from overlapping comparison evidence.
       */
      supportingProbability: probability,

      sampleSize,

      dataQuality,

      modelReliability,

      modelName: 'raw-result-model',

      /*
       * New version because the result probability architecture has
       * changed. Historical calibration for the old blended model
       * must not be mixed with this model.
       */
      modelVersion: 'raw-result-v6',

      modelOutputs: {
        homeWin: probabilities.home,

        draw: probabilities.draw,

        awayWin: probabilities.away,
      },

      modelSignals: {
        /*
         * Final result distribution.
         */
        homeWin: probabilities.home,

        draw: probabilities.draw,

        awayWin: probabilities.away,

        /*
         * Direct goal-model outputs.
         */
        goalModelHomeWin: goalModel.homeWin,

        goalModelDraw: goalModel.draw,

        goalModelAwayWin: goalModel.awayWin,

        /*
         * Comparison evidence is retained for diagnostics and for
         * downstream confidence/safety analysis.
         *
         * It does NOT alter the probability above.
         */
        comparisonHomeWin: this.clamp(goalModel.homeWin, 0, 1),

        comparisonDraw: this.clamp(goalModel.draw, 0, 1),

        comparisonAwayWin: this.clamp(goalModel.awayWin, 0, 1),

        directionalDifference,

        comparisonConfidence,

        goalProductionDifference,

        goalPreventionDifference,
      },
    };
  }

  private getResultProbability(
    selection: string,
    probabilities: {
      home: number;

      draw: number;

      away: number;
    },
  ): number {
    switch (selection.trim().toUpperCase()) {
      case 'HOME':
      case '1':
      case 'HOME_WIN':
        return probabilities.home;

      case 'DRAW':
      case 'X':
        return probabilities.draw;

      case 'AWAY':
      case '2':
      case 'AWAY_WIN':
        return probabilities.away;

      default:
        return 0;
    }
  }

  private normalizeResultProbabilities(input: {
    home: number;

    draw: number;

    away: number;
  }): {
    home: number;

    draw: number;

    away: number;
  } {
    const home = this.clamp(input.home, 0, 1);

    const draw = this.clamp(input.draw, 0, 1);

    const away = this.clamp(input.away, 0, 1);

    const total = home + draw + away;

    if (total <= 0 || !Number.isFinite(total)) {
      return {
        home: 0,

        draw: 0,

        away: 0,
      };
    }

    return {
      home: home / total,

      draw: draw / total,

      away: away / total,
    };
  }

  private calculateReliability(
    sampleSize: number,
    dataQuality: number,
  ): number {
    const safeSampleSize = Math.max(
      Number.isFinite(sampleSize) ? sampleSize : 0,
      0,
    );

    const safeDataQuality = this.clamp(dataQuality, 0, 100);

    const sampleReliability = 1 - Math.exp(-safeSampleSize / 20);

    return this.clamp(
      sampleReliability * 0.45 + (safeDataQuality / 100) * 0.55,
      0,
      1,
    );
  }

  private clamp(value: number, minimum = 0, maximum = 1): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
