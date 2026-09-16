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

    const matrixProbability = this.resolveProbability(
      input.market,
      input.selection,
      model,
    );

    const timingEvidence = this.calculateTimingEvidence(
      input,
      input.market,
      input.selection,
    );

    const probability = this.reconcileProbability(
      matrixProbability,
      timingEvidence,
      input,
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

    const empiricalProbability = timingEvidence.available
      ? timingEvidence.probability
      : undefined;

    return {
      market: input.market,

      selection: input.selection,

      probability,

      supportingProbability: probability,

      sampleSize,

      dataQuality,

      modelReliability: this.calculateReliability(sampleSize, dataQuality),

      modelName: 'raw-half-model',

      modelVersion: 'raw-half-v3',

      modelOutputs: {
        homeWin: timingData.homeWin,

        draw: timingData.draw,

        awayWin: timingData.awayWin,

        matrixProbability,

        ...(empiricalProbability !== undefined
          ? {
              empiricalProbability,
            }
          : {}),
      },

      modelSignals: {
        homeWin: timingData.homeWin,

        draw: timingData.draw,

        awayWin: timingData.awayWin,

        matrixProbability,

        /*
         * Record -1 when empirical timing evidence is unavailable
         * because modelSignals requires numeric values.
         */
        empiricalProbability: empiricalProbability ?? -1,

        empiricalEvidenceWeight: timingEvidence.weight,

        comparisonConfidence: input.features.comparison?.confidence ?? 0,

        directionalDifference:
          input.features.comparison?.directionalDifference ?? 0,

        goalProductionDifference:
          input.features.comparison?.goalProduction?.difference ?? 0,

        goalPreventionDifference:
          input.features.comparison?.goalPrevention?.difference ?? 0,

        timingEvidenceAvailable: timingEvidence.available ? 1 : 0,
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
      case 'HOME_WIN':
        return this.clamp(model.homeWin);

      case 'DRAW':
      case 'X':
        return this.clamp(model.draw);

      case 'AWAY':
      case '2':
      case 'AWAY_WIN':
        return this.clamp(model.awayWin);

      default:
        return 0;
    }
  }

  private resolveGoals(selection: string, probabilities: number[]): number {
    const normalized = selection.trim().toUpperCase();

    const match = normalized.match(/^(OVER|UNDER)[:_\s-]?(\d+(?:\.\d+)?)$/);

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

  private calculateTimingEvidence(
    input: MarketModelInput,
    market: PredictionMarket,
    selection: string,
  ): {
    probability: number;
    weight: number;
    available: boolean;
  } {
    const values: number[] = [];

    const secondHalf =
      market === PredictionMarket.SECOND_HALF_RESULT ||
      market === PredictionMarket.SECOND_HALF_GOALS;

    const periodKeys = secondHalf
      ? [
          'secondHalf',
          'secondHalfPerformance',
          'secondHalfStats',
          'secondHalfData',
        ]
      : [
          'firstHalf',
          'firstHalfPerformance',
          'firstHalfStats',
          'firstHalfData',
        ];

    /*
     * Do not treat the raw historical fixture array as though it
     * contained aggregate first/second-half properties.
     *
     * Timing evidence can come from structured team/H2H datasets.
     */
    const sources: unknown[] = [
      input.features.home?.firstHalf,
      input.features.away?.firstHalf,
      input.features.home?.secondHalf,
      input.features.away?.secondHalf,
      input.features.home?.sourceData?.competitionStats,
      input.features.away?.sourceData?.competitionStats,
      input.features.home?.sourceData?.performanceProfile,
      input.features.away?.sourceData?.performanceProfile,
      input.features.h2h,
    ];

    for (const source of sources) {
      for (const periodKey of periodKeys) {
        const period =
          periodKey === 'firstHalf'
            ? this.readObject(source, 'firstHalf')
            : periodKey === 'secondHalf'
              ? this.readObject(source, 'secondHalf')
              : this.readObject(source, periodKey);

        if (!period) {
          continue;
        }

        const value = this.readTimingSelectionProbability(
          period,
          market,
          selection,
        );

        if (value !== null) {
          values.push(value);
          break;
        }
      }
    }

    if (
      market === PredictionMarket.FIRST_HALF_GOALS ||
      market === PredictionMarket.SECOND_HALF_GOALS
    ) {
      this.collectGoalTimingEvidence(values, input, market, selection);
    }

    if (!values.length) {
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

  private collectGoalTimingEvidence(
    values: number[],
    input: MarketModelInput,
    market: PredictionMarket,
    selection: string,
  ): void {
    const sources: unknown[] = [
      input.features.home?.firstHalf,
      input.features.away?.firstHalf,
      input.features.home?.secondHalf,
      input.features.away?.secondHalf,
      input.features.home?.sourceData?.competitionStats,
      input.features.away?.sourceData?.competitionStats,
      input.features.home?.sourceData?.performanceProfile,
      input.features.away?.sourceData?.performanceProfile,
      input.features.h2h,
    ];

    const secondHalf = market === PredictionMarket.SECOND_HALF_GOALS;

    const periodNames = secondHalf
      ? ['secondHalf', 'secondHalfGoals', 'secondHalfTiming']
      : ['firstHalf', 'firstHalfGoals', 'firstHalfTiming'];

    const match = selection
      .trim()
      .toUpperCase()
      .match(/^(OVER|UNDER)[:_\s-]?(\d+(?:\.\d+)?)$/);

    if (!match) {
      return;
    }

    const side = match[1];

    const line = Number(match[2]);

    if (!Number.isFinite(line) || line < 0) {
      return;
    }

    const threshold = this.getThresholdKey(line);

    if (threshold === null) {
      return;
    }

    for (const source of sources) {
      /*
       * Raw firstHalf/secondHalf structured features are already
       * directly usable, while nested period names handle richer
       * source datasets.
       */
      const directPeriod = secondHalf
        ? this.asPeriod(
            source === input.features.home
              ? input.features.home?.secondHalf
              : source === input.features.away
                ? input.features.away?.secondHalf
                : null,
          )
        : this.asPeriod(
            source === input.features.home
              ? input.features.home?.firstHalf
              : source === input.features.away
                ? input.features.away?.firstHalf
                : null,
          );

      if (directPeriod) {
        const directKeys =
          side === 'OVER'
            ? [
                `over${threshold}Rate`,
                `goalsOver${threshold}Rate`,
                `over_${threshold}_rate`,
              ]
            : [
                `under${threshold}Rate`,
                `goalsUnder${threshold}Rate`,
                `under_${threshold}_rate`,
              ];

        const directValue = this.readRate(directPeriod, directKeys);

        if (directValue !== null) {
          values.push(directValue);
        }
      }

      for (const periodName of periodNames) {
        const period = this.readObject(source, periodName);

        if (!period) {
          continue;
        }

        const keys =
          side === 'OVER'
            ? [
                `over${threshold}Rate`,
                `goalsOver${threshold}Rate`,
                `over_${threshold}_rate`,
              ]
            : [
                `under${threshold}Rate`,
                `goalsUnder${threshold}Rate`,
                `under_${threshold}_rate`,
              ];

        const value = this.readRate(period, keys);

        if (value !== null) {
          values.push(value);
          break;
        }
      }
    }
  }

  private readTimingSelectionProbability(
    period: Record<string, unknown>,
    market: PredictionMarket,
    selection: string,
  ): number | null {
    const normalized = selection.trim().toUpperCase();

    if (
      market === PredictionMarket.HALF_TIME_RESULT ||
      market === PredictionMarket.SECOND_HALF_RESULT
    ) {
      const keys =
        normalized === 'HOME' || normalized === '1' || normalized === 'HOME_WIN'
          ? ['homeWinRate', 'homeWinProbability', 'winRate']
          : normalized === 'DRAW' || normalized === 'X'
            ? ['drawRate', 'drawProbability']
            : normalized === 'AWAY' ||
                normalized === '2' ||
                normalized === 'AWAY_WIN'
              ? ['awayWinRate', 'awayWinProbability']
              : [];

      if (!keys.length) {
        return null;
      }

      return this.readRate(period, keys);
    }

    return null;
  }

  private reconcileProbability(
    matrixProbability: number,
    timingEvidence: {
      probability: number;
      weight: number;
      available: boolean;
    },
    input: MarketModelInput,
  ): number {
    const matrix = this.clamp(matrixProbability);

    if (!timingEvidence.available) {
      return matrix;
    }

    const comparisonConfidence = this.clamp(
      input.features.comparison?.confidence ?? 0,
    );

    const dataQuality = this.clamp(
      (input.features.overallDataQuality ?? 0) / 100,
    );

    const evidenceWeight = this.clamp(
      timingEvidence.weight *
        (0.75 + comparisonConfidence * 0.15 + dataQuality * 0.1),
      0,
      0.3,
    );

    return this.clamp(
      matrix * (1 - evidenceWeight) +
        timingEvidence.probability * evidenceWeight,
    );
  }

  private asPeriod(source: unknown): Record<string, unknown> | null {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      return null;
    }

    return source as Record<string, unknown>;
  }

  private readObject(
    source: unknown,
    key: string,
  ): Record<string, unknown> | null {
    if (!source || typeof source !== 'object') {
      return null;
    }

    const value = (source as Record<string, unknown>)[key];

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private readRate(
    source: Record<string, unknown>,
    keys: string[],
  ): number | null {
    for (const key of keys) {
      const value = source[key];

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

  private getThresholdKey(line: number): string | null {
    if (!Number.isFinite(line) || line < 0) {
      return null;
    }

    if (Number.isInteger(line)) {
      return String(line);
    }

    return String(line).replace('.', '_');
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
