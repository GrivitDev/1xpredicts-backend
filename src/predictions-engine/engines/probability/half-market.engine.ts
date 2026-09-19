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

    const secondHalf =
      input.market === PredictionMarket.SECOND_HALF_RESULT ||
      input.market === PredictionMarket.SECOND_HALF_GOALS;

    const timingData = secondHalf ? model.secondHalf : model.halfTime;

    /*
     * The period score model is authoritative.
     *
     * It uses only explicit first-half or second-half data from
     * RawGoalModelUtil and produces the corresponding period score
     * distribution.
     *
     * We do not reconcile another empirical probability into it because
     * that would reuse the same period evidence twice.
     */
    const matrixProbability = this.resolveProbability(
      input.market,
      input.selection,
      model,
    );

    const probability = this.clamp(matrixProbability);

    /*
     * Empirical timing evidence is retained only as a diagnostic
     * signal. It can later be used by calibration/audit systems without
     * changing the raw probability.
     */
    const timingEvidence = this.calculateTimingEvidence(
      input,
      input.market,
      input.selection,
    );

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

      supportingProbability: matrixProbability,

      sampleSize,

      dataQuality,

      modelReliability: this.calculateReliability(sampleSize, dataQuality),

      modelName: 'raw-half-model',

      /*
       * New version because empirical period reconciliation has been
       * removed from the raw probability path.
       */
      modelVersion: 'raw-half-v5',

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

        /*
         * Explicit period availability is important for downstream
         * confidence/safety logic.
         */
        timingEvidenceAvailable: timingEvidence.available ? 1 : 0,

        periodModelAvailable: timingData.available ? 1 : 0,
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
        return this.resolveGoals(selection, model.halfTime);

      case PredictionMarket.SECOND_HALF_GOALS:
        return this.resolveGoals(selection, model.secondHalf);

      default:
        return 0;
    }
  }

  private resolveResult(
    selection: string,
    model: {
      available: boolean;

      homeWin: number;

      draw: number;

      awayWin: number;
    },
  ): number {
    /*
     * Never fabricate a period probability when the period model is
     * unavailable.
     */
    if (!model.available) {
      return 0;
    }

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

  private resolveGoals(
    selection: string,
    model: {
      available: boolean;

      totalGoals: number[];
    },
  ): number {
    /*
     * No period data means no defensible period-goal probability.
     */
    if (!model.available) {
      return 0;
    }

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
        model.totalGoals.reduce(
          (sum, probability, goals) => (goals > line ? sum + probability : sum),
          0,
        ),
      );
    }

    return this.clamp(
      model.totalGoals.reduce(
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
     * Period-result empirical evidence.
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
     * Period-goal empirical evidence.
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
     * Diagnostic strength only.
     *
     * This no longer feeds back into the raw period probability.
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

    const weight = this.clamp(
      (sampleReliability * 0.65 + dataReliability * 0.35) * 0.3,
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
     * Only explicitly exposed period data is allowed as a direct
     * period source.
     *
     * This avoids accidentally treating full-match statistics as
     * first-half or second-half statistics.
     */
    if (secondHalf) {
      if (input.features.home?.secondHalf) {
        sources.push(input.features.home.secondHalf);
      }

      if (input.features.away?.secondHalf) {
        sources.push(input.features.away.secondHalf);
      }
    } else {
      if (input.features.home?.firstHalf) {
        sources.push(input.features.home.firstHalf);
      }

      if (input.features.away?.firstHalf) {
        sources.push(input.features.away.firstHalf);
      }
    }

    /*
     * Structured provider datasets are accepted only when they
     * explicitly contain the requested period as a nested property.
     *
     * Generic competition/profile objects themselves are NOT treated
     * as period data.
     */
    const periodKey = secondHalf ? 'secondHalf' : 'firstHalf';

    const structuredSources = [
      input.features.home?.sourceData?.competitionStats,
      input.features.away?.sourceData?.competitionStats,
      input.features.home?.sourceData?.performanceProfile,
      input.features.away?.sourceData?.performanceProfile,
    ];

    for (const source of structuredSources) {
      if (source && typeof source === 'object' && !Array.isArray(source)) {
        const record = source;

        const nested = record[periodKey];

        if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
          sources.push(nested);
        }
      }
    }

    /*
     * H2H is deliberately not added here because its aggregate
     * statistics are not inherently first-half/second-half data.
     */
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

    const periodKey = secondHalf ? 'secondHalf' : 'firstHalf';

    /*
     * Direct period feature object is accepted only when it carries
     * period-specific evidence fields.
     *
     * Generic full-match source objects are NOT accepted merely
     * because they contain homeWinRate/drawRate/awayWinRate.
     */
    if (
      this.hasAnyKey(record, [
        'averageGoalsScored',
        'averageGoalsConceded',
        'homeWinRate',
        'awayWinRate',
        'drawRate',
        'over05Rate',
        'over15Rate',
        'over25Rate',
        'over35Rate',
        'over45Rate',
        'under05Rate',
        'under15Rate',
        'under25Rate',
        'under35Rate',
        'under45Rate',
      ])
    ) {
      /*
       * Direct period objects from RawPredictionFeatures have their
       * own sampleSize and period statistics. They are safe here.
       */
      if (
        Object.prototype.hasOwnProperty.call(record, 'sampleSize') ||
        Object.prototype.hasOwnProperty.call(record, 'averageGoalsScored') ||
        Object.prototype.hasOwnProperty.call(record, 'averageGoalsConceded')
      ) {
        return record;
      }
    }

    /*
     * Nested provider-specific period object.
     */
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
    selection: string,
  ): number | null {
    const normalized = selection.trim().toUpperCase();

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
    const safeSampleSize = Math.max(
      Number.isFinite(sampleSize) ? sampleSize : 0,
      0,
    );

    const safeDataQuality = this.clamp(dataQuality, 0, 100);

    const sampleReliability = 1 - Math.exp(-safeSampleSize / 20);

    return this.clamp(
      sampleReliability * 0.45 + (safeDataQuality / 100) * 0.55,
      0,
      1,
    );
  }

  private clamp(value: number, minimum = 0, maximum = 1): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(minimum, value), maximum);
  }
}
