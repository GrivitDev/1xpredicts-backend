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

    const secondHalf =
      input.market === PredictionMarket.SECOND_HALF_RESULT ||
      input.market === PredictionMarket.SECOND_HALF_GOALS;

    const timingData = secondHalf ? model.secondHalf : model.halfTime;

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

      /*
       * Preserve the raw period score-matrix probability as the
       * structural supporting probability.
       */
      supportingProbability: matrixProbability,

      sampleSize,

      dataQuality,

      modelReliability: this.calculateReliability(sampleSize, dataQuality),

      modelName: 'raw-half-model',

      modelVersion: 'raw-half-v4',

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

        empiricalProbability: empiricalProbability ?? -1,

        empiricalEvidenceWeight: timingEvidence.weight,

        empiricalEvidenceAvailable: timingEvidence.available ? 1 : 0,

        timingObservationCount: timingEvidence.observationCount,

        comparisonConfidence: this.clamp(
          input.features.comparison?.confidence ?? 0,
          0,
          1,
        ),

        directionalDifference: this.clamp(
          input.features.comparison?.directionalDifference ?? 0,
          -1,
          1,
        ),

        goalProductionDifference: this.clamp(
          input.features.comparison?.goalProduction?.difference ?? 0,
          -1,
          1,
        ),

        goalPreventionDifference: this.clamp(
          input.features.comparison?.goalPrevention?.difference ?? 0,
          -1,
          1,
        ),

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
    observationCount: number;
  } {
    const secondHalf =
      market === PredictionMarket.SECOND_HALF_RESULT ||
      market === PredictionMarket.SECOND_HALF_GOALS;

    const sources = this.getTargetPeriodSources(input, secondHalf);

    const values: Array<{
      probability: number;
      observations: number;
    }> = [];

    /*
     * ----------------------------------------------------------
     * PERIOD RESULT EVIDENCE
     * ----------------------------------------------------------
     */
    if (
      market === PredictionMarket.HALF_TIME_RESULT ||
      market === PredictionMarket.SECOND_HALF_RESULT
    ) {
      for (const source of sources) {
        const period = this.resolvePeriodObject(source, secondHalf);

        if (!period) {
          continue;
        }

        const probability = this.readTimingSelectionProbability(
          period,
          market,
          selection,
        );

        if (probability === null) {
          continue;
        }

        const observations = this.resolveObservationCount(period, source);

        if (observations <= 0) {
          continue;
        }

        values.push({
          probability,
          observations,
        });
      }
    }

    /*
     * ----------------------------------------------------------
     * PERIOD GOAL EVIDENCE
     * ----------------------------------------------------------
     */
    if (
      market === PredictionMarket.FIRST_HALF_GOALS ||
      market === PredictionMarket.SECOND_HALF_GOALS
    ) {
      this.collectGoalTimingEvidence(values, sources, secondHalf, selection);
    }

    if (!values.length) {
      return {
        probability: 0,
        weight: 0,
        available: false,
        observationCount: 0,
      };
    }

    const probability = this.calculateWeightedProbability(values);

    const observationCount = values.reduce(
      (sum, entry) => sum + entry.observations,
      0,
    );

    /*
     * Actual timing observations determine sample reliability.
     */
    const sampleReliability = this.clamp(
      1 - Math.exp(-observationCount / 30),
      0,
      1,
    );

    const dataReliability = this.clamp(
      (input.features.overallDataQuality ?? 0) / 100,
      0,
      1,
    );

    const comparisonConfidence = this.clamp(
      input.features.comparison?.confidence ?? 0,
      0,
      1,
    );

    /*
     * Comparison confidence can increase the confidence in the
     * timing evidence only when it actually exists.
     */
    const weight = this.clamp(
      (sampleReliability * 0.55 +
        dataReliability * 0.3 +
        comparisonConfidence * 0.15) *
        0.3,
      0,
      0.3,
    );

    return {
      probability,

      weight,

      available: true,

      observationCount,
    };
  }

  private getTargetPeriodSources(
    input: MarketModelInput,
    secondHalf: boolean,
  ): unknown[] {
    const sources: unknown[] = [];

    /*
     * Only the selected period is allowed into the timing model.
     */
    if (secondHalf) {
      sources.push(input.features.home?.secondHalf);

      sources.push(input.features.away?.secondHalf);
    } else {
      sources.push(input.features.home?.firstHalf);

      sources.push(input.features.away?.firstHalf);
    }

    /*
     * Structured provider datasets may contain the selected
     * period nested below competition statistics or profiles.
     */
    if (secondHalf) {
      sources.push(input.features.home?.sourceData?.competitionStats);

      sources.push(input.features.away?.sourceData?.competitionStats);

      sources.push(input.features.home?.sourceData?.performanceProfile);

      sources.push(input.features.away?.sourceData?.performanceProfile);
    } else {
      sources.push(input.features.home?.sourceData?.competitionStats);

      sources.push(input.features.away?.sourceData?.competitionStats);

      sources.push(input.features.home?.sourceData?.performanceProfile);

      sources.push(input.features.away?.sourceData?.performanceProfile);
    }

    if (input.features.h2h) {
      sources.push(input.features.h2h);
    }

    return sources.filter((source) => source !== null && source !== undefined);
  }

  private resolvePeriodObject(
    source: unknown,
    secondHalf: boolean,
  ): Record<string, unknown> | null {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      return null;
    }

    const record = source as Record<string, unknown>;

    /*
     * Direct period feature object.
     */
    const directLooksLikePeriod = this.hasAnyKey(record, [
      'homeWinRate',
      'awayWinRate',
      'drawRate',
      'over15Rate',
      'under15Rate',
      'goalsOver15Rate',
      'goalsUnder15Rate',
    ]);

    if (directLooksLikePeriod) {
      return record;
    }

    const periodKey = secondHalf ? 'secondHalf' : 'firstHalf';

    const nested = record[periodKey];

    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return nested as Record<string, unknown>;
    }

    return null;
  }

  private collectGoalTimingEvidence(
    values: Array<{
      probability: number;
      observations: number;
    }>,
    sources: unknown[],
    secondHalf: boolean,
    selection: string,
  ): void {
    const normalized = selection.trim().toUpperCase();

    const match = normalized.match(/^(OVER|UNDER)[:_\s-]?(\d+(?:\.\d+)?)$/);

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

    for (const source of sources) {
      const period = this.resolvePeriodObject(source, secondHalf);

      if (!period) {
        continue;
      }

      const value = this.readRate(period, keys);

      if (value === null) {
        continue;
      }

      const observations = this.resolveObservationCount(period, source);

      if (observations <= 0) {
        continue;
      }

      values.push({
        probability: value,
        observations,
      });
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

  private calculateWeightedProbability(
    values: Array<{
      probability: number;
      observations: number;
    }>,
  ): number {
    let weightedProbability = 0;

    let totalWeight = 0;

    for (const entry of values) {
      const observations = Math.max(Math.floor(entry.observations), 1);

      const reliability = this.clamp(1 - Math.exp(-observations / 20), 0, 1);

      const weight = Math.max(observations * reliability, 1);

      weightedProbability += entry.probability * weight;

      totalWeight += weight;
    }

    if (totalWeight <= 0) {
      return 0.5;
    }

    return this.clamp(weightedProbability / totalWeight);
  }

  private reconcileProbability(
    matrixProbability: number,
    timingEvidence: {
      probability: number;
      weight: number;
      available: boolean;
      observationCount: number;
    },
    input: MarketModelInput,
  ): number {
    const matrix = this.clamp(matrixProbability);

    if (!timingEvidence.available || timingEvidence.weight <= 0) {
      return matrix;
    }

    const comparisonConfidence = this.clamp(
      input.features.comparison?.confidence ?? 0,
      0,
      1,
    );

    const dataQuality = this.clamp(
      (input.features.overallDataQuality ?? 0) / 100,
      0,
      1,
    );

    /*
     * Timing evidence is secondary.
     *
     * Even when comparison confidence and data quality are strong,
     * it cannot replace the period score matrix.
     */
    const evidenceCoherence = this.clamp(
      comparisonConfidence * 0.55 + dataQuality * 0.45,
      0,
      1,
    );

    const evidenceWeight = this.clamp(
      timingEvidence.weight * (0.75 + evidenceCoherence * 0.25),
      0,
      0.3,
    );

    return this.clamp(
      matrix * (1 - evidenceWeight) +
        timingEvidence.probability * evidenceWeight,
    );
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

  private resolveObservationCount(period: unknown, source: unknown): number {
    const periodCount = this.readSampleSize(period);

    if (periodCount > 0) {
      return periodCount;
    }

    return this.readSampleSize(source);
  }

  private readSampleSize(source: unknown): number {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      return 0;
    }

    const record = source as Record<string, unknown>;

    const keys = [
      'sampleSize',
      'matchesAnalyzed',
      'played',
      'matches',
      'games',
    ];

    for (const key of keys) {
      const value = record[key];

      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return Math.floor(value);
      }
    }

    return 0;
  }

  private hasAnyKey(source: Record<string, unknown>, keys: string[]): boolean {
    return keys.some((key) =>
      Object.prototype.hasOwnProperty.call(source, key),
    );
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

    return Math.min(Math.max(minimum, value), maximum);
  }
}
