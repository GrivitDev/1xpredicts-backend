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
      PredictionMarket.HALF_TIME_FULL_TIME,
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

      case PredictionMarket.HALF_TIME_FULL_TIME:
        return this.resolveHalfFullTime(selection, model);

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

  private resolveHalfFullTime(
    selection: string,
    model: ReturnType<typeof RawGoalModelUtil.calculate>,
  ): number {
    const normalized = selection.trim().toUpperCase().replace(/\s+/g, '');

    /*
     * Configured selections:
     *
     * HOME_HOME
     * HOME_DRAW
     * HOME_AWAY
     * DRAW_HOME
     * DRAW_DRAW
     * DRAW_AWAY
     * AWAY_HOME
     * AWAY_DRAW
     * AWAY_AWAY
     */
    const match = normalized.match(/^(HOME|DRAW|AWAY)[_-](HOME|DRAW|AWAY)$/);

    if (!match) {
      return 0;
    }

    const firstHalf = match[1];
    const fullTime = match[2];

    const firstProbability = this.resolveResult(firstHalf, model.halfTime);

    if (firstProbability <= 0) {
      return 0;
    }

    const conditional = this.calculateFullTimeGivenHalf(
      firstHalf,
      fullTime,
      model,
    );

    return this.clamp(firstProbability * conditional);
  }

  private calculateFullTimeGivenHalf(
    halfResult: string,
    fullResult: string,
    model: ReturnType<typeof RawGoalModelUtil.calculate>,
  ): number {
    const halfSign = this.resultSign(halfResult);

    const fullSign = this.resultSign(fullResult);

    if (halfSign === 99 || fullSign === 99) {
      return 0;
    }

    let probability = 0;
    let denominator = 0;

    for (let homeGoals = 0; homeGoals < model.matrix.length; homeGoals++) {
      for (
        let awayGoals = 0;
        awayGoals < model.matrix[homeGoals].length;
        awayGoals++
      ) {
        const p = model.matrix[homeGoals][awayGoals] ?? 0;

        if (p <= 0) {
          continue;
        }

        const halfGoalsHome = this.halfTimeGoalsApproximation(
          homeGoals,
          model,
          true,
        );

        const halfGoalsAway = this.halfTimeGoalsApproximation(
          awayGoals,
          model,
          false,
        );

        const firstHalfSign = Math.sign(halfGoalsHome - halfGoalsAway);

        if (firstHalfSign !== halfSign) {
          continue;
        }

        denominator += p;

        const fullTimeSign = Math.sign(homeGoals - awayGoals);

        if (fullTimeSign === fullSign) {
          probability += p;
        }
      }
    }

    if (denominator <= 0) {
      return 0;
    }

    return this.clamp(probability / denominator);
  }

  private halfTimeGoalsApproximation(
    fullGoals: number,
    model: ReturnType<typeof RawGoalModelUtil.calculate>,
    home: boolean,
  ): number {
    const probabilities = home
      ? model.halfTime.homeGoals
      : model.halfTime.awayGoals;

    let expected = 0;

    for (let goals = 0; goals < probabilities.length; goals++) {
      expected += goals * (probabilities[goals] ?? 0);
    }

    if (expected <= 0 && fullGoals > 0) {
      return 1;
    }

    return Math.min(fullGoals, Math.max(0, Math.round(expected)));
  }

  private resultSign(value: string): number {
    switch (value.trim().toUpperCase()) {
      case 'HOME':
      case '1':
        return 1;

      case 'DRAW':
      case 'X':
        return 0;

      case 'AWAY':
      case '2':
        return -1;

      default:
        return 99;
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
