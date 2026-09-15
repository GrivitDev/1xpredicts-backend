import { Injectable } from '@nestjs/common';

import { PredictionMarket } from '../../enums/prediction-market.enum';
import { MarketModel } from '../../interfaces/market-model.interface';
import { MarketModelInput } from '../../interfaces/market-model-input.interface';
import { ProbabilityModelResult } from '../../interfaces/probability-result.interface';

import { RawGoalModelUtil } from './raw-goal-model.util';

@Injectable()
export class GoalMarketEngine implements MarketModel {
  supports(market: PredictionMarket): boolean {
    return [
      PredictionMarket.OVER_UNDER,
      PredictionMarket.GOAL_RANGE,
      PredictionMarket.TEAM_TOTAL_GOALS,
      PredictionMarket.EXACT_GOALS,
    ].includes(market);
  }

  calculate(input: MarketModelInput): ProbabilityModelResult {
    const model = RawGoalModelUtil.calculate(input.features);

    const probability = this.resolveProbability(
      input.market,
      input.selection,
      model,
    );

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
      modelName: 'raw-goal-model',
      modelVersion: 'raw-goal-v2',
      modelOutputs: {
        expectedHomeGoals: model.expectedHomeGoals,
        expectedAwayGoals: model.expectedAwayGoals,
        expectedTotalGoals: model.expectedTotalGoals,
      },
      modelSignals: {
        expectedHomeGoals: model.expectedHomeGoals,
        expectedAwayGoals: model.expectedAwayGoals,
        expectedTotalGoals: model.expectedTotalGoals,
      },
    };
  }

  private resolveProbability(
    market: PredictionMarket,
    selection: string,
    model: ReturnType<typeof RawGoalModelUtil.calculate>,
  ): number {
    switch (market) {
      case PredictionMarket.OVER_UNDER:
        return this.resolveOverUnder(selection, model.totalGoalProbabilities);

      case PredictionMarket.GOAL_RANGE:
        return this.resolveGoalRange(selection, model.totalGoalProbabilities);

      case PredictionMarket.TEAM_TOTAL_GOALS:
        return this.resolveTeamTotal(selection, model);

      case PredictionMarket.EXACT_GOALS:
        return this.resolveExactGoals(selection, model);

      default:
        return 0;
    }
  }

  private resolveOverUnder(selection: string, probabilities: number[]): number {
    const match = selection
      .trim()
      .toUpperCase()
      .match(/^(OVER|UNDER)[_: -]?(\d+(?:\.\d+)?)$/);

    if (!match) {
      return 0;
    }

    const side = match[1];
    const line = Number(match[2]);

    if (!Number.isFinite(line)) {
      return 0;
    }

    const over = this.probabilityOver(probabilities, line);

    return side === 'OVER' ? over : this.probabilityUnder(probabilities, line);
  }

  private resolveGoalRange(selection: string, probabilities: number[]): number {
    const normalized = selection.trim().toUpperCase().replace(/\s+/g, '');

    const exactMatch = normalized.match(
      /^(?:GOALS?|TOTAL_?GOALS?)[_: -]?(\d+)$/,
    );

    if (exactMatch) {
      const goals = Number(exactMatch[1]);

      return this.probabilityExactly(probabilities, goals);
    }

    const rangeMatch = normalized.match(
      /^(?:GOALS?|TOTAL_?GOALS?)[_: -]?(\d+)[_-](\d+)$|^(\d+)[_-](\d+)$/,
    );

    if (!rangeMatch) {
      return 0;
    }

    const minimum = Number(rangeMatch[1] ?? rangeMatch[3]);

    const maximum = Number(rangeMatch[2] ?? rangeMatch[4]);

    if (
      !Number.isFinite(minimum) ||
      !Number.isFinite(maximum) ||
      minimum > maximum
    ) {
      return 0;
    }

    return this.clamp(
      probabilities.reduce(
        (sum, probability, goals) =>
          goals >= minimum && goals <= maximum ? sum + probability : sum,
        0,
      ),
    );
  }

  private resolveTeamTotal(
    selection: string,
    model: ReturnType<typeof RawGoalModelUtil.calculate>,
  ): number {
    const match = selection
      .trim()
      .toUpperCase()
      .match(/^(HOME|AWAY)_(OVER|UNDER)[_: -]?(\d+(?:\.\d+)?)$/);

    if (!match) {
      return 0;
    }

    const team = match[1];
    const side = match[2];
    const line = Number(match[3]);

    const probabilities =
      team === 'HOME'
        ? model.homeGoalProbabilities
        : model.awayGoalProbabilities;

    return side === 'OVER'
      ? this.probabilityOver(probabilities, line)
      : this.probabilityUnder(probabilities, line);
  }

  private resolveExactGoals(
    selection: string,
    model: ReturnType<typeof RawGoalModelUtil.calculate>,
  ): number {
    const normalized = selection.trim().toUpperCase();

    const match = normalized.match(/^(HOME|AWAY)[_: -]?(\d+)$/);

    if (match) {
      const team = match[1];
      const goals = Number(match[2]);

      return this.probabilityExactly(
        team === 'HOME'
          ? model.homeGoalProbabilities
          : model.awayGoalProbabilities,
        goals,
      );
    }

    const scoreMatch = normalized.match(/^(\d+)[-:](\d+)$/);

    if (!scoreMatch) {
      return 0;
    }

    const homeGoals = Number(scoreMatch[1]);

    const awayGoals = Number(scoreMatch[2]);

    if (
      homeGoals < 0 ||
      awayGoals < 0 ||
      homeGoals >= model.matrix.length ||
      awayGoals >= model.matrix.length
    ) {
      return 0;
    }

    return this.clamp(model.matrix[homeGoals]?.[awayGoals] ?? 0);
  }

  private probabilityOver(probabilities: number[], line: number): number {
    return this.clamp(
      probabilities.reduce(
        (sum, probability, goals) => (goals > line ? sum + probability : sum),
        0,
      ),
    );
  }

  private probabilityUnder(probabilities: number[], line: number): number {
    return this.clamp(
      probabilities.reduce(
        (sum, probability, goals) => (goals < line ? sum + probability : sum),
        0,
      ),
    );
  }

  private probabilityExactly(probabilities: number[], goals: number): number {
    if (goals < 0 || goals >= probabilities.length) {
      return 0;
    }

    return this.clamp(probabilities[goals] ?? 0);
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
