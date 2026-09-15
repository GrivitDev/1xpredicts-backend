// src/predictions-engine/engines/probability/btts-market.engine.ts

import { Injectable } from '@nestjs/common';

import { PredictionMarket } from '../../enums/prediction-market.enum';

import { MarketModel } from '../../interfaces/market-model.interface';
import { MarketModelInput } from '../../interfaces/market-model-input.interface';
import { ProbabilityModelResult } from '../../interfaces/probability-result.interface';

import { RawGoalModelUtil } from './raw-goal-model.util';

@Injectable()
export class BttsMarketEngine implements MarketModel {
  supports(market: PredictionMarket): boolean {
    return market === PredictionMarket.BOTH_TEAMS_TO_SCORE;
  }

  calculate(input: MarketModelInput): ProbabilityModelResult {
    const model = RawGoalModelUtil.calculate(input.features);

    const bttsYes = this.calculateBttsYes(model);

    const probability = this.resolveProbability(input.selection, bttsYes);

    const sampleSize = Math.max(input.features.overallSampleSize ?? 0, 0);

    const dataQuality = this.clamp(
      input.features.overallDataQuality ?? 0,
      0,
      100,
    );

    const modelReliability = this.calculateReliability(sampleSize, dataQuality);

    return {
      market: input.market,
      selection: input.selection,

      probability,

      supportingProbability: probability,

      sampleSize,

      dataQuality,

      modelReliability,

      modelName: 'raw-btts-model',

      modelVersion: 'raw-btts-v2',

      modelOutputs: {
        bttsYes,
        bttsNo: 1 - bttsYes,
      },

      modelSignals: {
        bttsYes,
        bttsNo: 1 - bttsYes,
      },
    };
  }

  private calculateBttsYes(
    model: ReturnType<typeof RawGoalModelUtil.calculate>,
  ): number {
    let probability = 0;

    for (let homeGoals = 1; homeGoals < model.matrix.length; homeGoals++) {
      for (
        let awayGoals = 1;
        awayGoals < model.matrix[homeGoals].length;
        awayGoals++
      ) {
        probability += model.matrix[homeGoals][awayGoals] ?? 0;
      }
    }

    return this.clamp(probability);
  }

  private resolveProbability(selection: string, bttsYes: number): number {
    switch (selection.trim().toUpperCase()) {
      case 'YES':
      case 'BTTS_YES':
      case '1':
        return bttsYes;

      case 'NO':
      case 'BTTS_NO':
      case '0':
        return this.clamp(1 - bttsYes);

      default:
        return 0;
    }
  }

  private calculateReliability(
    sampleSize: number,
    dataQuality: number,
  ): number {
    const sampleReliability = 1 - Math.exp(-sampleSize / 20);

    return this.clamp(sampleReliability * 0.4 + (dataQuality / 100) * 0.6);
  }

  private clamp(value: number, minimum = 0, maximum = 1): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
