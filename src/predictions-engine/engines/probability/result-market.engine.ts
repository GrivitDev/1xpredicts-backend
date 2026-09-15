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

    const dataQuality = Math.min(
      Math.max(input.features.overallDataQuality ?? 0, 0),
      100,
    );

    const modelReliability = this.calculateReliability(sampleSize, dataQuality);

    return {
      market: PredictionMarket.MATCH_RESULT,

      selection: input.selection,

      probability,

      supportingProbability: probability,

      sampleSize,

      dataQuality,

      modelReliability,

      modelName: 'raw-result-model',

      modelVersion: 'raw-result-v3',

      modelOutputs: {
        homeWin: probabilities.home,
        draw: probabilities.draw,
        awayWin: probabilities.away,
      },

      modelSignals: {
        homeWin: probabilities.home,
        draw: probabilities.draw,
        awayWin: probabilities.away,
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

    if (total <= 0) {
      return {
        home: 1 / 3,
        draw: 1 / 3,
        away: 1 / 3,
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
