import { Injectable } from '@nestjs/common';

import { PredictionMarket } from '../../enums/prediction-market.enum';
import { MarketModel } from '../../interfaces/market-model.interface';
import { MarketModelInput } from '../../interfaces/market-model-input.interface';
import { ProbabilityModelResult } from '../../interfaces/probability-result.interface';

import { RawGoalModelUtil } from './raw-goal-model.util';

@Injectable()
export class ResultMarketEngine implements MarketModel {
  supports(market: PredictionMarket): boolean {
    return [
      PredictionMarket.MATCH_RESULT,
      PredictionMarket.DOUBLE_CHANCE,
      PredictionMarket.DRAW_NO_BET,
    ].includes(market);
  }

  calculate(input: MarketModelInput): ProbabilityModelResult {
    const goalModel = RawGoalModelUtil.calculate(input.features);

    const probability = this.calculateProbability(
      input.market,
      input.selection,
      goalModel,
    );

    const sampleSize = Math.max(input.features.overallSampleSize ?? 0, 0);

    const dataQuality = Math.min(
      Math.max(input.features.overallDataQuality ?? 0, 0),
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
      modelName: 'raw-result-model',
      modelVersion: 'raw-result-v2',
      modelOutputs: {
        homeWin: goalModel.homeWin,
        draw: goalModel.draw,
        awayWin: goalModel.awayWin,
      },
      modelSignals: {
        homeWin: goalModel.homeWin,
        draw: goalModel.draw,
        awayWin: goalModel.awayWin,
      },
    };
  }

  private calculateProbability(
    market: PredictionMarket,
    selection: string,
    model: ReturnType<typeof RawGoalModelUtil.calculate>,
  ): number {
    switch (market) {
      case PredictionMarket.MATCH_RESULT:
        return this.getResultProbability(selection, model);

      case PredictionMarket.DOUBLE_CHANCE:
        return this.getDoubleChanceProbability(selection, model);

      case PredictionMarket.DRAW_NO_BET:
        return this.getDrawNoBetProbability(selection, model);

      default:
        return 0;
    }
  }

  private getResultProbability(
    selection: string,
    model: ReturnType<typeof RawGoalModelUtil.calculate>,
  ): number {
    switch (selection.trim().toUpperCase()) {
      case 'HOME':
      case '1':
      case 'HOME_WIN':
        return model.homeWin;

      case 'DRAW':
      case 'X':
        return model.draw;

      case 'AWAY':
      case '2':
      case 'AWAY_WIN':
        return model.awayWin;

      default:
        return 0;
    }
  }

  private getDoubleChanceProbability(
    selection: string,
    model: ReturnType<typeof RawGoalModelUtil.calculate>,
  ): number {
    switch (selection.trim().toUpperCase()) {
      case 'HOME_OR_DRAW':
      case 'HOME_DRAW':
      case '1X':
        return this.clamp(model.homeWin + model.draw);

      case 'HOME_OR_AWAY':
      case 'HOME_AWAY':
      case '12':
        return this.clamp(model.homeWin + model.awayWin);

      case 'AWAY_OR_DRAW':
      case 'DRAW_AWAY':
      case 'X2':
        return this.clamp(model.draw + model.awayWin);

      default:
        return 0;
    }
  }

  private getDrawNoBetProbability(
    selection: string,
    model: ReturnType<typeof RawGoalModelUtil.calculate>,
  ): number {
    const totalDecisive = model.homeWin + model.awayWin;

    if (totalDecisive <= 0) {
      return 0;
    }

    switch (selection.trim().toUpperCase()) {
      case 'HOME':
      case '1':
      case 'HOME_WIN':
        return this.clamp(model.homeWin / totalDecisive);

      case 'AWAY':
      case '2':
      case 'AWAY_WIN':
        return this.clamp(model.awayWin / totalDecisive);

      default:
        return 0;
    }
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
