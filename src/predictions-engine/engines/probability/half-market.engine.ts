// src/predictions-engine/engines/probability/half-market.engine.ts

import { Injectable } from '@nestjs/common';

import { PredictionMarket } from '../../enums/prediction-market.enum';

import { MarketModel } from '../../interfaces/market-model.interface';
import { MarketModelInput } from '../../interfaces/market-model-input.interface';
import { ProbabilityModelResult } from '../../interfaces/probability-result.interface';

import { RawGoalModelUtil } from './raw-goal-model.util';

@Injectable()
export class HalfMarketEngine implements MarketModel {
  supports(market: PredictionMarket): boolean {
    return [
      PredictionMarket.HALF_TIME_RESULT,
      PredictionMarket.SECOND_HALF_RESULT,
      PredictionMarket.FIRST_HALF_GOALS,
      PredictionMarket.SECOND_HALF_GOALS,
    ].includes(market);
  }

  calculate(input: MarketModelInput): ProbabilityModelResult {
    const model = RawGoalModelUtil.calculate(input.features);

    const probability = this.resolveProbability(
      input.market,
      input.selection,
      model,
    );

    const timingData =
      input.market === PredictionMarket.SECOND_HALF_RESULT ||
      input.market === PredictionMarket.SECOND_HALF_GOALS
        ? model.secondHalf
        : model.halfTime;

    const sampleSize = Math.max(input.features.overallSampleSize ?? 0, 0);

    const dataQuality = this.clamp(
      input.features.overallDataQuality ?? 0,
      0,
      100,
    );

    return {
      market: input.market,
      selection: input.selection,

      probability,

      supportingProbability: probability,

      sampleSize,

      dataQuality,

      modelReliability: this.calculateReliability(sampleSize, dataQuality),

      modelName: 'raw-half-model',

      modelVersion: 'raw-half-v2',

      modelOutputs: {
        homeWin: timingData.homeWin,
        draw: timingData.draw,
        awayWin: timingData.awayWin,
      },

      modelSignals: {
        homeWin: timingData.homeWin,
        draw: timingData.draw,
        awayWin: timingData.awayWin,
      },
    };
  }

  private resolveProbability(
    market: PredictionMarket,
    selection: string,
    model: ReturnType<typeof RawGoalModelUtil.calculate>,
  ): number {
    switch (market) {
      case PredictionMarket.HALF_TIME_RESULT:
        return this.resolveResult(selection, model.halfTime);

      case PredictionMarket.SECOND_HALF_RESULT:
        return this.resolveResult(selection, model.secondHalf);

      case PredictionMarket.FIRST_HALF_GOALS:
        return this.resolveGoals(selection, model.halfTime.totalGoals);

      case PredictionMarket.SECOND_HALF_GOALS:
        return this.resolveGoals(selection, model.secondHalf.totalGoals);

      default:
        return 0;
    }
  }

  private resolveResult(
    selection: string,
    model: {
      homeWin: number;
      draw: number;
      awayWin: number;
    },
  ): number {
    switch (selection.trim().toUpperCase()) {
      case 'HOME':
      case '1':
        return model.homeWin;

      case 'DRAW':
      case 'X':
        return model.draw;

      case 'AWAY':
      case '2':
        return model.awayWin;

      default:
        return 0;
    }
  }

  private resolveGoals(selection: string, probabilities: number[]): number {
    const normalized = selection.trim().toUpperCase();

    const match = normalized.match(/^(OVER|UNDER)[:_ -]?(\d+(?:\.\d+)?)$/);

    if (!match) {
      return 0;
    }

    const side = match[1];

    const line = Number(match[2]);

    if (!Number.isFinite(line) || line < 0) {
      return 0;
    }

    if (side === 'OVER') {
      return this.clamp(
        probabilities.reduce(
          (sum, probability, goals) => (goals > line ? sum + probability : sum),
          0,
        ),
      );
    }

    return this.clamp(
      probabilities.reduce(
        (sum, probability, goals) => (goals < line ? sum + probability : sum),
        0,
      ),
    );
  }

  private calculateReliability(
    sampleSize: number,
    dataQuality: number,
  ): number {
    const sampleReliability = 1 - Math.exp(-sampleSize / 20);

    return this.clamp(sampleReliability * 0.45 + (dataQuality / 100) * 0.55);
  }

  private clamp(value: number, minimum = 0, maximum = 1): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
