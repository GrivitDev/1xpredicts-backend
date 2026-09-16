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

      supportingProbability: probability,

      sampleSize,

      dataQuality,

      modelReliability,

      modelName: 'raw-btts-model',

      modelVersion: 'raw-btts-v4',

      modelOutputs: {
        bttsYes,

        bttsNo: 1 - bttsYes,

        matrixBttsYes,

        ...(empiricalBttsYes !== undefined
          ? {
              empiricalBttsYes,
            }
          : {}),
      },

      modelSignals: {
        bttsYes,

        bttsNo: 1 - bttsYes,

        matrixBttsYes,

        empiricalBttsYes: empiricalBttsYes ?? -1,

        empiricalEvidenceWeight: empiricalEvidence.weight,

        empiricalEvidenceAvailable: empiricalEvidence.available ? 1 : 0,

        comparisonConfidence,

        directionalDifference,

        goalProductionDifference,

        goalPreventionDifference,

        /*
         * BTTS is fundamentally driven by whether both teams
         * have evidence of scoring while also considering the
         * opponent's ability to prevent scoring.
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
      for (
        let awayGoals = 1;
        awayGoals < model.matrix[homeGoals].length;
        awayGoals += 1
      ) {
        probability += model.matrix[homeGoals][awayGoals] ?? 0;
      }
    }

    return this.clamp(probability);
  }

  private calculateEmpiricalBttsEvidence(input: MarketModelInput): {
    probability: number;
    weight: number;
    available: boolean;
  } {
    const values: number[] = [];

    /*
     * Overall team evidence.
     */
    this.pushRate(values, input.features.home, ['bttsRate']);

    this.pushRate(values, input.features.away, ['bttsRate']);

    /*
     * Recent evidence.
     */
    this.pushRate(values, input.features.home?.recent, ['bttsRate']);

    this.pushRate(values, input.features.away?.recent, ['bttsRate']);

    /*
     * Venue-specific evidence.
     */
    this.pushRate(values, input.features.home?.venue, ['bttsRate']);

    this.pushRate(values, input.features.away?.venue, ['bttsRate']);

    /*
     * H2H is supplementary.
     */
    this.pushRate(values, input.features.h2h, [
      'bttsRate',
      'bothTeamsToScoreRate',
    ]);

    /*
     * The raw historical fixtures themselves do not expose an
     * aggregate bttsRate. They are already represented through
     * the feature aggregates above, so they must not be treated
     * as if they were aggregate objects.
     */

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
      0,
      1,
    );

    /*
     * Comparison evidence is part of the weighting because the
     * team-comparison layer specifically measures the relationship
     * between the two teams rather than one team in isolation.
     */
    const goalProductionEvidence = this.clamp(
      0.5 + (input.features.comparison?.goalProduction?.difference ?? 0) * 0.5,
      0,
      1,
    );

    const goalPreventionEvidence = this.clamp(
      0.5 - (input.features.comparison?.goalPrevention?.difference ?? 0) * 0.5,
      0,
      1,
    );

    const comparisonGoalEvidence = this.clamp(
      goalProductionEvidence * 0.5 + goalPreventionEvidence * 0.5,
      0,
      1,
    );

    const evidenceStrength = this.clamp(
      sampleReliability * 0.3 +
        dataReliability * 0.3 +
        comparisonConfidence * 0.2 +
        comparisonGoalEvidence * 0.2,
      0,
      1,
    );

    const weight = this.clamp(evidenceStrength * 0.35, 0, 0.35);

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
     * Strong direct comparison evidence allows the empirical
     * evidence to challenge the matrix more meaningfully, but
     * never lets it completely replace the score matrix.
     */
    const comparisonCoherence = this.clamp(
      0.5 + goalProductionDifference * 0.25 - goalPreventionDifference * 0.25,
      0,
      1,
    );

    const coherenceWeight = this.clamp(
      comparisonConfidence * 0.45 +
        dataQuality * 0.25 +
        comparisonCoherence * 0.3,
      0,
      1,
    );

    const evidenceWeight = this.clamp(
      empiricalEvidence.weight * (0.7 + coherenceWeight * 0.3),
      0,
      0.35,
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

    /*
     * Do not fabricate a scoring probability when the BTTS
     * evidence is genuinely unavailable.
     */
    if (!values.length) {
      return 0.5;
    }

    return this.clamp(
      values.reduce((sum, value) => sum + value, 0) / values.length,
    );
  }

  private pushRate(values: number[], source: unknown, keys: string[]): void {
    if (!source || typeof source !== 'object') {
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
        values.push(normalized);

        return;
      }
    }
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
