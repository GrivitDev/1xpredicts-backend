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

    const matrixBttsYes = this.calculateBttsYes(model);

    const empiricalEvidence = this.calculateEmpiricalBttsEvidence(input);

    const bttsYes = this.reconcileProbability(
      matrixBttsYes,
      empiricalEvidence,
      input,
    );

    const probability = this.resolveProbability(input.selection, bttsYes);

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

      supportingProbability: matrixBttsYes,

      sampleSize,

      dataQuality,

      modelReliability,

      modelName: 'raw-btts-model',

      modelVersion: 'raw-btts-v5',

      modelOutputs: {
        bttsYes,

        bttsNo: this.clamp(1 - bttsYes),

        matrixBttsYes,

        ...(empiricalBttsYes !== undefined
          ? {
              empiricalBttsYes,
            }
          : {}),
      },

      modelSignals: {
        bttsYes,

        bttsNo: this.clamp(1 - bttsYes),

        matrixBttsYes,

        empiricalBttsYes: empiricalBttsYes ?? -1,

        empiricalEvidenceWeight: empiricalEvidence.weight,

        empiricalEvidenceAvailable: empiricalEvidence.available ? 1 : 0,

        empiricalObservationCount: empiricalEvidence.observationCount,

        comparisonConfidence,

        directionalDifference,

        goalProductionDifference,

        goalPreventionDifference,

        /*
         * BTTS-specific scoring evidence.
         *
         * These are descriptive signals for downstream ensemble
         * and evidence evaluation. They do not directly overwrite
         * the score-matrix probability.
         */
        homeScoringSignal: this.calculateScoringSignal(input.features.home),

        awayScoringSignal: this.calculateScoringSignal(input.features.away),
      },
    };
  }

  private calculateBttsYes(
    model: ReturnType<typeof RawGoalModelUtil.calculate>,
  ): number {
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

    /*
     * Do not fabricate empirical evidence when no actual BTTS
     * observations are available.
     */
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
     * Reliability is based on the actual BTTS observations rather
     * than assuming that overallSampleSize represents every
     * aggregate source equally.
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

    const comparisonConfidence = this.clamp(
      input.features.comparison?.confidence ?? 0,
      0,
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

    /*
     * For BTTS:
     *
     *   stronger production on both sides supports YES
     *   stronger prevention suppresses YES
     *
     * Neutral comparison evidence must remain neutral.
     */
    const productionEvidence = this.clamp(
      0.5 + goalProductionDifference * 0.5,
      0,
      1,
    );

    const preventionEvidence = this.clamp(
      0.5 - goalPreventionDifference * 0.5,
      0,
      1,
    );

    const comparisonGoalEvidence = this.clamp(
      productionEvidence * 0.5 + preventionEvidence * 0.5,
      0,
      1,
    );

    /*
     * Comparison evidence is allowed to increase the empirical
     * weight only when it actually provides useful information.
     *
     * A neutral 0.5 comparison signal does not produce extra
     * influence.
     */
    const comparisonSupport = this.clamp(
      (Math.abs(productionEvidence - 0.5) +
        Math.abs(preventionEvidence - 0.5)) /
        1,
      0,
      1,
    );

    const evidenceStrength =
      observationReliability * 0.5 +
      dataReliability * 0.25 +
      comparisonConfidence * comparisonSupport * 0.15 +
      comparisonGoalEvidence * 0.1;

    /*
     * Empirical evidence remains secondary to the score matrix.
     *
     * Maximum influence = 30%.
     */
    const weight = this.clamp(evidenceStrength * 0.3, 0, 0.3);

    return {
      probability,

      weight,

      available: true,

      observationCount: totalObservations,
    };
  }

  private reconcileProbability(
    matrixProbability: number,
    empiricalEvidence: {
      probability: number;
      weight: number;
      available: boolean;
      observationCount: number;
    },
    input: MarketModelInput,
  ): number {
    const matrix = this.clamp(matrixProbability);

    if (!empiricalEvidence.available || empiricalEvidence.weight <= 0) {
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

    /*
     * Comparison coherence measures whether the available
     * production/prevention evidence has a meaningful direction.
     *
     * It does NOT reward high probability.
     */
    const productionDirection = Math.abs(goalProductionDifference);

    const preventionDirection = Math.abs(goalPreventionDifference);

    const directionalSupport = this.clamp(
      (productionDirection + preventionDirection) / 2,
      0,
      1,
    );

    const comparisonCoherence = this.clamp(
      comparisonConfidence * 0.6 + directionalSupport * 0.4,
      0,
      1,
    );

    /*
     * Empirical evidence can challenge the matrix, but it cannot
     * completely replace it.
     */
    const evidenceWeight = this.clamp(
      empiricalEvidence.weight *
        (0.7 + comparisonCoherence * 0.3) *
        (0.85 + dataQuality * 0.15),
      0,
      0.3,
    );

    return this.clamp(
      matrix * (1 - evidenceWeight) +
        empiricalEvidence.probability * evidenceWeight,
    );
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
