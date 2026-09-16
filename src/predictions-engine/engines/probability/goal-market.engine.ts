// src/predictions-engine/engines/probability/goal-market.engine.ts

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
    ].includes(market);
  }

  calculate(input: MarketModelInput): ProbabilityModelResult {
    const model = RawGoalModelUtil.calculate(input.features);

    const matrixProbability = this.resolveProbability(
      input.market,
      input.selection,
      model,
    );

    const empiricalEvidence = this.calculateEmpiricalEvidence(
      input,
      input.market,
      input.selection,
    );

    const probability = this.reconcileProbability(
      matrixProbability,
      empiricalEvidence,
      input,
    );

    const sampleSize = Math.max(input.features.overallSampleSize ?? 0, 0);

    const dataQuality = this.clamp(
      input.features.overallDataQuality ?? 0,
      0,
      100,
    );

    const modelReliability = this.calculateReliability(sampleSize, dataQuality);

    const empiricalProbability = empiricalEvidence.available
      ? empiricalEvidence.probability
      : undefined;

    return {
      market: input.market,

      selection: input.selection,

      probability,

      supportingProbability: probability,

      sampleSize,

      dataQuality,

      modelReliability,

      modelName: 'raw-goal-model',

      modelVersion: 'raw-goal-v3',

      modelOutputs: {
        expectedHomeGoals: model.expectedHomeGoals,

        expectedAwayGoals: model.expectedAwayGoals,

        expectedTotalGoals: model.expectedTotalGoals,

        matrixProbability,

        ...(empiricalProbability !== undefined
          ? {
              empiricalProbability,
            }
          : {}),
      },

      modelSignals: {
        expectedHomeGoals: model.expectedHomeGoals,

        expectedAwayGoals: model.expectedAwayGoals,

        expectedTotalGoals: model.expectedTotalGoals,

        matrixProbability,

        empiricalProbability: empiricalProbability ?? -1,

        empiricalEvidenceWeight: empiricalEvidence.weight,

        empiricalEvidenceAvailable: empiricalEvidence.available ? 1 : 0,

        comparisonConfidence: input.features.comparison?.confidence ?? 0,

        directionalDifference:
          input.features.comparison?.directionalDifference ?? 0,

        goalProductionHome:
          input.features.comparison?.goalProduction?.home ?? 0,

        goalProductionAway:
          input.features.comparison?.goalProduction?.away ?? 0,

        goalProductionDifference:
          input.features.comparison?.goalProduction?.difference ?? 0,

        goalPreventionHome:
          input.features.comparison?.goalPrevention?.home ?? 0,

        goalPreventionAway:
          input.features.comparison?.goalPrevention?.away ?? 0,

        goalPreventionDifference:
          input.features.comparison?.goalPrevention?.difference ?? 0,
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

      default:
        return 0;
    }
  }

  private calculateEmpiricalEvidence(
    input: MarketModelInput,
    market: PredictionMarket,
    selection: string,
  ): {
    probability: number;
    weight: number;
    available: boolean;
  } {
    if (market === PredictionMarket.TEAM_TOTAL_GOALS) {
      return this.calculateTeamTotalEmpiricalEvidence(input, selection);
    }

    if (market === PredictionMarket.OVER_UNDER) {
      return this.calculateOverUnderEmpiricalEvidence(input, selection);
    }

    if (market === PredictionMarket.GOAL_RANGE) {
      return this.calculateGoalRangeEmpiricalEvidence(input, selection);
    }

    return {
      probability: 0,
      weight: 0,
      available: false,
    };
  }

  private calculateOverUnderEmpiricalEvidence(
    input: MarketModelInput,
    selection: string,
  ): {
    probability: number;
    weight: number;
    available: boolean;
  } {
    const match = selection
      .trim()
      .toUpperCase()
      .match(/^(OVER|UNDER)[_:\s-]?(\d+(?:\.\d+)?)$/);

    if (!match) {
      return {
        probability: 0,
        weight: 0,
        available: false,
      };
    }

    const side = match[1];

    const line = Number(match[2]);

    if (!Number.isFinite(line) || line < 0) {
      return {
        probability: 0,
        weight: 0,
        available: false,
      };
    }

    const values: number[] = [];

    /*
     * The current raw feature contract exposes OVER rates for
     * recent/venue/H2H aggregates. UNDER probabilities are derived
     * as the complement of the corresponding OVER rate rather than
     * reading unsupported under-rate properties.
     */
    const sources: unknown[] = [
      input.features.home?.recent,
      input.features.away?.recent,
      input.features.home?.venue,
      input.features.away?.venue,
      input.features.h2h,
    ];

    const overKey = this.getOverRateKey(line);

    if (overKey === null) {
      return this.buildEmpiricalEvidence(values, input);
    }

    for (const source of sources) {
      const overRate = this.readRate(source, [overKey]);

      if (overRate === null) {
        continue;
      }

      values.push(side === 'OVER' ? overRate : this.clamp(1 - overRate));
    }

    return this.buildEmpiricalEvidence(values, input);
  }

  private calculateGoalRangeEmpiricalEvidence(
    input: MarketModelInput,
    selection: string,
  ): {
    probability: number;
    weight: number;
    available: boolean;
  } {
    const normalized = selection.trim().toUpperCase().replace(/\s+/g, '');

    const prefixed = normalized.match(
      /^(?:GOALS?|TOTAL_GOALS?|TOTALGOALS?)[_:\s-]?(.+)$/,
    );

    const value = prefixed ? prefixed[1] : normalized;

    const values: number[] = [];

    const sources: unknown[] = [
      input.features.home?.recent,
      input.features.away?.recent,
      input.features.home?.venue,
      input.features.away?.venue,
      input.features.h2h,
    ];

    /*
     * With the currently exposed OVER rates, the useful enabled
     * goal ranges can be derived directly:
     *
     * 0-1 = 1 - O1.5
     * 2   = O1.5 - O2.5
     * 3-4 = O2.5 - O4.5
     * 5+  = O4.5
     */
    for (const source of sources) {
      if (/^0-1$/.test(value)) {
        const over15 = this.readRate(source, ['over15Rate']);

        if (over15 !== null) {
          values.push(this.clamp(1 - over15));
        }

        continue;
      }

      if (value === '2') {
        const over15 = this.readRate(source, ['over15Rate']);

        const over25 = this.readRate(source, ['over25Rate']);

        if (over15 !== null && over25 !== null) {
          values.push(this.clamp(over15 - over25));
        }

        continue;
      }

      if (value === '3-4') {
        const over25 = this.readRate(source, ['over25Rate']);

        const over45 = this.readRate(source, ['over45Rate']);

        if (over25 !== null && over45 !== null) {
          values.push(this.clamp(over25 - over45));
        }

        continue;
      }

      if (value === '5+') {
        const over45 = this.readRate(source, ['over45Rate']);

        if (over45 !== null) {
          values.push(over45);
        }
      }
    }

    return this.buildEmpiricalEvidence(values, input);
  }

  private calculateTeamTotalEmpiricalEvidence(
    input: MarketModelInput,
    selection: string,
  ): {
    probability: number;
    weight: number;
    available: boolean;
  } {
    const match = selection
      .trim()
      .toUpperCase()
      .match(/^(HOME|AWAY)[_:\s-]?(OVER|UNDER)[_:\s-]?(\d+(?:\.\d+)?)$/);

    if (!match) {
      return {
        probability: 0,
        weight: 0,
        available: false,
      };
    }

    const team = match[1];

    const side = match[2];

    const line = Number(match[3]);

    if (!Number.isFinite(line) || line < 0) {
      return {
        probability: 0,
        weight: 0,
        available: false,
      };
    }

    const selectedTeam =
      team === 'HOME' ? input.features.home : input.features.away;

    const sources: unknown[] = [selectedTeam?.recent, selectedTeam?.venue];

    const overKey = this.getOverRateKey(line);

    if (overKey === null) {
      return this.buildEmpiricalEvidence([], input);
    }

    const values: number[] = [];

    for (const source of sources) {
      const overRate = this.readRate(source, [overKey]);

      if (overRate === null) {
        continue;
      }

      values.push(side === 'OVER' ? overRate : this.clamp(1 - overRate));
    }

    return this.buildEmpiricalEvidence(values, input);
  }

  private buildEmpiricalEvidence(
    values: number[],
    input: MarketModelInput,
  ): {
    probability: number;
    weight: number;
    available: boolean;
  } {
    if (values.length === 0) {
      return {
        probability: 0,
        weight: 0,
        available: false,
      };
    }

    const probability = this.clamp(
      values.reduce((sum, value) => sum + value, 0) / values.length,
    );

    const sampleReliability = this.clamp(
      1 - Math.exp(-(input.features.overallSampleSize ?? 0) / 20),
    );

    const dataReliability = this.clamp(
      (input.features.overallDataQuality ?? 0) / 100,
    );

    const comparisonConfidence = this.clamp(
      input.features.comparison?.confidence ?? 0,
    );

    const weight = this.clamp(
      (sampleReliability * 0.35 +
        dataReliability * 0.4 +
        comparisonConfidence * 0.25) *
        0.3,
      0,
      0.3,
    );

    return {
      probability,
      weight,
      available: true,
    };
  }

  private reconcileProbability(
    matrixProbability: number,
    empiricalEvidence: {
      probability: number;
      weight: number;
      available: boolean;
    },
    input: MarketModelInput,
  ): number {
    const matrix = this.clamp(matrixProbability);

    if (!empiricalEvidence.available) {
      return matrix;
    }

    const comparisonConfidence = this.clamp(
      input.features.comparison?.confidence ?? 0,
    );

    const dataQuality = this.clamp(
      (input.features.overallDataQuality ?? 0) / 100,
    );

    const evidenceWeight = this.clamp(
      empiricalEvidence.weight *
        (0.75 + comparisonConfidence * 0.15 + dataQuality * 0.1),
      0,
      0.3,
    );

    return this.clamp(
      matrix * (1 - evidenceWeight) +
        empiricalEvidence.probability * evidenceWeight,
    );
  }

  private pushRate(values: number[], source: unknown, keys: string[]): void {
    const value = this.readRate(source, keys);

    if (value !== null) {
      values.push(value);
    }
  }

  private readRate(source: unknown, keys: string[]): number | null {
    if (!source || typeof source !== 'object') {
      return null;
    }

    const record = source as Record<string, unknown>;

    for (const key of keys) {
      const value = record[key];

      if (typeof value !== 'number' || !Number.isFinite(value)) {
        continue;
      }

      const normalized = value > 1 && value <= 100 ? value / 100 : value;

      if (normalized >= 0 && normalized <= 1) {
        return normalized;
      }
    }

    return null;
  }

  private getOverRateKey(line: number): string | null {
    if (!Number.isFinite(line) || line < 0) {
      return null;
    }

    /*
     * Only rates exposed by the current raw feature contract
     * are used for empirical evidence.
     */
    switch (line) {
      case 0.5:
        return 'over05Rate';

      case 1.5:
        return 'over15Rate';

      case 2.5:
        return 'over25Rate';

      case 3.5:
        return 'over35Rate';

      case 4.5:
        return 'over45Rate';

      case 5.5:
        return 'over55Rate';

      default:
        return null;
    }
  }

  private resolveOverUnder(selection: string, probabilities: number[]): number {
    const normalized = selection.trim().toUpperCase();

    const match = normalized.match(/^(OVER|UNDER)[_:\s-]?(\d+(?:\.\d+)?)$/);

    if (!match) {
      return 0;
    }

    const side = match[1];

    const line = Number(match[2]);

    if (!Number.isFinite(line) || line < 0) {
      return 0;
    }

    return side === 'OVER'
      ? this.probabilityOver(probabilities, line)
      : this.probabilityUnder(probabilities, line);
  }

  private resolveGoalRange(selection: string, probabilities: number[]): number {
    const normalized = selection.trim().toUpperCase().replace(/\s+/g, '');

    const prefixed = normalized.match(
      /^(?:GOALS?|TOTAL_GOALS?|TOTALGOALS?)[_:\s-]?(.+)$/,
    );

    const value = prefixed ? prefixed[1] : normalized;

    if (/^\d+$/.test(value)) {
      const goals = Number(value);

      return Number.isFinite(goals)
        ? this.probabilityExactly(probabilities, goals)
        : 0;
    }

    const atLeastMatch = value.match(/^(\d+)\+$/);

    if (atLeastMatch) {
      const minimum = Number(atLeastMatch[1]);

      if (!Number.isFinite(minimum) || minimum < 0) {
        return 0;
      }

      return this.probabilityAtLeast(probabilities, minimum);
    }

    const rangeMatch = value.match(/^(\d+)-(\d+)$/);

    if (!rangeMatch) {
      return 0;
    }

    const minimum = Number(rangeMatch[1]);

    const maximum = Number(rangeMatch[2]);

    if (
      !Number.isFinite(minimum) ||
      !Number.isFinite(maximum) ||
      minimum < 0 ||
      maximum < 0 ||
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
    const normalized = selection.trim().toUpperCase();

    const match = normalized.match(
      /^(HOME|AWAY)[_:\s-]?(OVER|UNDER)[_:\s-]?(\d+(?:\.\d+)?)$/,
    );

    if (!match) {
      return 0;
    }

    const team = match[1];

    const side = match[2];

    const line = Number(match[3]);

    if (!Number.isFinite(line) || line < 0) {
      return 0;
    }

    const probabilities =
      team === 'HOME'
        ? model.homeGoalProbabilities
        : model.awayGoalProbabilities;

    return side === 'OVER'
      ? this.probabilityOver(probabilities, line)
      : this.probabilityUnder(probabilities, line);
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

  private probabilityAtLeast(probabilities: number[], goals: number): number {
    if (goals <= 0) {
      return 1;
    }

    if (goals >= probabilities.length) {
      return 0;
    }

    return this.clamp(
      probabilities.reduce(
        (sum, probability, index) => (index >= goals ? sum + probability : sum),
        0,
      ),
    );
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
