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

    /*
     * BTTS is derived directly from the joint score distribution:
     *
     * P(BTTS YES) =
     *     sum P(home goals >= 1 AND away goals >= 1)
     *
     * The score matrix is already generated from the model lambdas,
     * which contain the relevant team scoring/concession evidence.
     *
     * We therefore do not blend another empirical BTTS estimate into
     * this probability because that evidence substantially overlaps
     * with the inputs already used by the goal model.
     */
    const matrixBttsYes = this.calculateBttsYes(model);

    const probability = this.resolveProbability(input.selection, matrixBttsYes);

    /*
     * Empirical BTTS evidence is retained for diagnostics and future
     * calibration analysis. It is deliberately not used to alter the
     * current probability.
     */
    const empiricalEvidence = this.calculateEmpiricalBttsEvidence(input);

    const sampleSize = Math.max(input.features.overallSampleSize ?? 0, 0);

    const dataQuality = this.clamp(
      input.features.overallDataQuality ?? 0,
      0,
      100,
    );

    const comparisonConfidence = this.clamp(
      input.features.comparison?.confidence ?? 0,
      0,
      1,
    );

    const directionalDifference = this.clamp(
      input.features.comparison?.directionalDifference ?? 0,
      -1,
      1,
    );

    const goalProductionDifference = this.clamp(
      input.features.comparison?.goalProduction?.difference ?? 0,
      -1,
      1,
    );

    const goalPreventionDifference = this.clamp(
      input.features.comparison?.goalPrevention?.difference ?? 0,
      -1,
      1,
    );

    const modelReliability = this.calculateReliability(sampleSize, dataQuality);

    const empiricalBttsYes = empiricalEvidence.available
      ? empiricalEvidence.probability
      : undefined;

    return {
      market: input.market,

      selection: input.selection,

      probability,

      /*
       * Structural BTTS probability remains the supporting probability
       * because it is the same authoritative score-distribution result.
       */
      supportingProbability: matrixBttsYes,

      sampleSize,

      dataQuality,

      modelReliability,

      modelName: 'raw-btts-model',

      /*
       * New version because empirical reconciliation no longer alters
       * the final BTTS probability.
       */
      modelVersion: 'raw-btts-v6',

      modelOutputs: {
        bttsYes: matrixBttsYes,

        bttsNo: this.clamp(1 - matrixBttsYes),

        matrixBttsYes,

        ...(empiricalBttsYes !== undefined
          ? {
              empiricalBttsYes,
            }
          : {}),
      },

      modelSignals: {
        bttsYes: matrixBttsYes,

        bttsNo: this.clamp(1 - matrixBttsYes),

        matrixBttsYes,

        /*
         * Diagnostic only.
         */
        empiricalBttsYes: empiricalBttsYes ?? -1,

        empiricalEvidenceWeight: empiricalEvidence.weight,

        empiricalEvidenceAvailable: empiricalEvidence.available ? 1 : 0,

        empiricalObservationCount: empiricalEvidence.observationCount,

        comparisonConfidence,

        directionalDifference,

        goalProductionDifference,

        goalPreventionDifference,

        /*
         * Descriptive scoring evidence.
         *
         * These signals do not overwrite the score-matrix probability.
         */
        homeScoringSignal: this.calculateScoringSignal(input.features.home),

        awayScoringSignal: this.calculateScoringSignal(input.features.away),
      },
    };
  }

  private calculateBttsYes(
    model: ReturnType<typeof RawGoalModelUtil.calculate>,
  ): number {
    /*
     * Exact matrix probability:
     *
     * home goals >= 1
     * AND
     * away goals >= 1
     */
    let probability = 0;

    for (let homeGoals = 1; homeGoals < model.matrix.length; homeGoals += 1) {
      const row = model.matrix[homeGoals] ?? [];

      for (let awayGoals = 1; awayGoals < row.length; awayGoals += 1) {
        probability += row[awayGoals] ?? 0;
      }
    }

    return this.clamp(probability);
  }

  private calculateEmpiricalBttsEvidence(input: MarketModelInput): {
    probability: number;
    weight: number;
    available: boolean;
    observationCount: number;
  } {
    const values: Array<{
      probability: number;
      observations: number;
    }> = [];

    /*
     * Overall team evidence.
     */
    this.pushRate(
      values,
      input.features.home,
      ['bttsRate'],
      this.readPositiveSample(input.features.home, 'sampleSize'),
    );

    this.pushRate(
      values,
      input.features.away,
      ['bttsRate'],
      this.readPositiveSample(input.features.away, 'sampleSize'),
    );

    /*
     * Recent evidence.
     */
    this.pushRate(
      values,
      input.features.home?.recent,
      ['bttsRate'],
      this.readPositiveSample(input.features.home?.recent, 'sampleSize'),
    );

    this.pushRate(
      values,
      input.features.away?.recent,
      ['bttsRate'],
      this.readPositiveSample(input.features.away?.recent, 'sampleSize'),
    );

    /*
     * Venue-specific evidence.
     */
    this.pushRate(
      values,
      input.features.home?.venue,
      ['bttsRate'],
      this.readPositiveSample(input.features.home?.venue, 'sampleSize'),
    );

    this.pushRate(
      values,
      input.features.away?.venue,
      ['bttsRate'],
      this.readPositiveSample(input.features.away?.venue, 'sampleSize'),
    );

    /*
     * H2H remains supplementary.
     */
    this.pushRate(
      values,
      input.features.h2h,
      ['bttsRate', 'bothTeamsToScoreRate'],
      this.readPositiveSample(input.features.h2h, 'sampleSize'),
    );

    if (!values.length) {
      return {
        probability: 0,
        weight: 0,
        available: false,
        observationCount: 0,
      };
    }

    const totalObservations = values.reduce(
      (sum, entry) => sum + entry.observations,
      0,
    );

    const weightedProbability =
      this.calculateWeightedEmpiricalProbability(values);

    const probability = this.clamp(weightedProbability);

    /*
     * Diagnostic evidence strength.
     *
     * It is NOT used to move matrixBttsYes.
     */
    const observationReliability = this.clamp(
      1 - Math.exp(-totalObservations / 25),
      0,
      1,
    );

    const dataReliability = this.clamp(
      (input.features.overallDataQuality ?? 0) / 100,
      0,
      1,
    );

    const weight = this.clamp(
      (observationReliability * 0.6 + dataReliability * 0.4) * 0.3,
      0,
      0.3,
    );

    return {
      probability,

      weight,

      available: true,

      observationCount: totalObservations,
    };
  }

  private calculateScoringSignal(team: {
    bttsRate: number;

    failedToScoreRate: number;

    averageGoalsScored: number;

    recent: {
      bttsRate: number;

      failedToScoreRate: number;

      averageGoalsScored: number;
    };

    venue: {
      bttsRate: number;

      failedToScoreRate: number;

      averageGoalsScored: number;
    };
  }): number {
    const values: number[] = [];

    const overallBtts = this.readRate(team.bttsRate);

    const recentBtts = this.readRate(team.recent?.bttsRate);

    const venueBtts = this.readRate(team.venue?.bttsRate);

    const failedToScore = this.readRate(team.failedToScoreRate);

    const recentFailedToScore = this.readRate(team.recent?.failedToScoreRate);

    const venueFailedToScore = this.readRate(team.venue?.failedToScoreRate);

    if (overallBtts !== null) {
      values.push(overallBtts);
    }

    if (recentBtts !== null) {
      values.push(recentBtts);
    }

    if (venueBtts !== null) {
      values.push(venueBtts);
    }

    if (failedToScore !== null) {
      values.push(1 - failedToScore);
    }

    if (recentFailedToScore !== null) {
      values.push(1 - recentFailedToScore);
    }

    if (venueFailedToScore !== null) {
      values.push(1 - venueFailedToScore);
    }

    if (!values.length) {
      return 0.5;
    }

    return this.clamp(
      values.reduce((sum, value) => sum + value, 0) / values.length,
    );
  }

  private calculateWeightedEmpiricalProbability(
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

  private pushRate(
    values: Array<{
      probability: number;

      observations: number;
    }>,
    source: unknown,
    keys: string[],
    observations: number,
  ): void {
    if (!source || typeof source !== 'object') {
      return;
    }

    if (observations <= 0) {
      return;
    }

    const record = source as Record<string, unknown>;

    for (const key of keys) {
      const value = record[key];

      if (typeof value !== 'number' || !Number.isFinite(value)) {
        continue;
      }

      const normalized = value > 1 && value <= 100 ? value / 100 : value;

      if (normalized >= 0 && normalized <= 1) {
        values.push({
          probability: normalized,

          observations,
        });

        return;
      }
    }
  }

  private readPositiveSample(source: unknown, key: string): number {
    if (!source || typeof source !== 'object') {
      return 0;
    }

    const value = (source as Record<string, unknown>)[key];

    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return Math.floor(value);
    }

    return 0;
  }

  private readRate(value: number | null | undefined): number | null {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return null;
    }

    if (value >= 0 && value <= 1) {
      return value;
    }

    if (value > 1 && value <= 100) {
      return value / 100;
    }

    return null;
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
    const safeSampleSize = Math.max(
      Number.isFinite(sampleSize) ? sampleSize : 0,
      0,
    );

    const safeDataQuality = this.clamp(dataQuality, 0, 100);

    const sampleReliability = 1 - Math.exp(-safeSampleSize / 20);

    return this.clamp(
      sampleReliability * 0.4 + (safeDataQuality / 100) * 0.6,
      0,
      1,
    );
  }

  private clamp(value: number, minimum = 0, maximum = 1): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
