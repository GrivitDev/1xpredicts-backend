import { Injectable } from '@nestjs/common';

import { PredictionMarket } from '../../enums/prediction-market.enum';
import { MarketModel } from '../../interfaces/market-model.interface';
import { MarketModelInput } from '../../interfaces/market-model-input.interface';
import { ProbabilityModelResult } from '../../interfaces/probability-result.interface';

import { RawGoalModelUtil } from './raw-goal-model.util';

@Injectable()
export class CleanSheetMarketEngine implements MarketModel {
  supports(market: PredictionMarket): boolean {
    return market === PredictionMarket.CLEAN_SHEET;
  }

  calculate(input: MarketModelInput): ProbabilityModelResult {
    const model = RawGoalModelUtil.calculate(input.features);

    const probability = this.resolveProbability(input.selection, model);

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
      modelReliability: this.clamp(
        (1 - Math.exp(-sampleSize / 20)) * 0.45 + (dataQuality / 100) * 0.55,
      ),
      modelName: 'raw-clean-sheet-model',
      modelVersion: 'raw-clean-sheet-v2',
      modelSignals: {
        cleanSheetProbability: probability,
      },
    };
  }

  private resolveProbability(
    selection: string,
    model: ReturnType<typeof RawGoalModelUtil.calculate>,
  ): number {
    switch (selection.trim().toUpperCase()) {
      case 'HOME':
      case 'HOME_YES':
      case 'HOME_CLEAN_SHEET':
        return this.getHomeCleanSheet(model);

      case 'AWAY':
      case 'AWAY_YES':
      case 'AWAY_CLEAN_SHEET':
        return this.getAwayCleanSheet(model);

      case 'HOME_NO':
      case 'AWAY_SCORE':
        return this.clamp(1 - this.getHomeCleanSheet(model));

      case 'AWAY_NO':
      case 'HOME_SCORE':
        return this.clamp(1 - this.getAwayCleanSheet(model));

      default:
        return 0;
    }
  }

  private getHomeCleanSheet(
    model: ReturnType<typeof RawGoalModelUtil.calculate>,
  ): number {
    return this.clamp(model.awayGoalProbabilities[0] ?? 0);
  }

  private getAwayCleanSheet(
    model: ReturnType<typeof RawGoalModelUtil.calculate>,
  ): number {
    return this.clamp(model.homeGoalProbabilities[0] ?? 0);
  }

  private clamp(value: number, minimum = 0, maximum = 1): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
