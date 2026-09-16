// src/predictions-engine/services/market-coherence.service.ts

import { Injectable } from '@nestjs/common';

import { PredictionMarket } from '../enums/prediction-market.enum';

import { RawPredictionFeatures } from '../interfaces/raw-prediction-features.interface';

import { GoalModelResult } from '../engines/probability/raw-goal-model.util';

import { MarketProbabilityResult } from '../engines/probability/market-probability.util';

export interface MarketCoherenceResult {
  coherent: boolean;

  reasons: string[];

  probabilityDifference: number;

  comparisonDirection: 'HOME' | 'DRAW' | 'AWAY' | 'NEUTRAL';

  evidenceSupport: number;

  comparisonConfidence: number;

  directionalDifference: number;

  goalProductionDifference: number;

  goalPreventionDifference: number;
}

@Injectable()
export class MarketCoherenceService {
  validate(input: {
    features: RawPredictionFeatures;

    goalModel: GoalModelResult;

    market: PredictionMarket;

    selection: string;

    probability: number;

    commonProbability: MarketProbabilityResult;
  }): MarketCoherenceResult {
    const reasons: string[] = [];

    const probability = this.clamp(input.probability, 0, 1);

    const commonProbability = this.clamp(
      input.commonProbability.probability,
      0,
      1,
    );

    const probabilityDifference = Math.abs(probability - commonProbability);

    const comparison = input.features.comparison;

    const comparisonConfidence = this.clamp(comparison?.confidence ?? 0, 0, 1);

    const directionalDifference = this.clamp(
      comparison?.directionalDifference ?? 0,
      -1,
      1,
    );

    const goalProductionDifference = this.clamp(
      comparison?.goalProduction?.difference ?? 0,
      -1,
      1,
    );

    const goalPreventionDifference = this.clamp(
      comparison?.goalPrevention?.difference ?? 0,
      -1,
      1,
    );

    const direction = this.getComparisonDirection(directionalDifference);

    /*
     * ----------------------------------------------------------
     * COMMON SCORE-MATRIX VALIDITY
     * ----------------------------------------------------------
     *
     * A structurally invalid probability matrix is a genuine
     * contradiction. Model disagreement by itself is not.
     */
    if (!input.commonProbability.scoreMatrixCoherent) {
      reasons.push('COMMON_SCORE_MATRIX_CANNOT_PRICE_MARKET');
    }

    /*
     * ----------------------------------------------------------
     * MATCH RESULT DISTRIBUTION
     * ----------------------------------------------------------
     */
    if (input.market === PredictionMarket.MATCH_RESULT) {
      const home = this.clamp(input.goalModel.homeWin, 0, 1);

      const draw = this.clamp(input.goalModel.draw, 0, 1);

      const away = this.clamp(input.goalModel.awayWin, 0, 1);

      const total = home + draw + away;

      if (!Number.isFinite(total) || total <= 0) {
        reasons.push('INVALID_MATCH_RESULT_DISTRIBUTION');
      }
    }

    /*
     * ----------------------------------------------------------
     * PROBABILITY VALIDITY
     * ----------------------------------------------------------
     */
    if (
      !Number.isFinite(input.probability) ||
      input.probability < 0 ||
      input.probability > 1
    ) {
      reasons.push('INVALID_MARKET_PROBABILITY');
    }

    /*
     * ----------------------------------------------------------
     * MODEL / EVIDENCE SUPPORT
     * ----------------------------------------------------------
     *
     * Probability disagreement with a common model is evidence
     * for further scoring, not proof that the prediction is wrong.
     *
     * A market-specific model can legitimately disagree with a
     * generic/common market model, especially for handicap and
     * line-specific goal markets.
     */
    const matrixCoherence = this.calculateMatrixCoherence(
      probabilityDifference,
    );

    const directionalEvidence = this.calculateDirectionalEvidence(
      input.market,
      input.selection,
      directionalDifference,
      comparisonConfidence,
    );

    const goalEvidence = this.calculateGoalEvidence(
      input.market,
      input.selection,
      goalProductionDifference,
      goalPreventionDifference,
      comparisonConfidence,
    );

    const marketSpecificEvidence = this.calculateMarketSpecificEvidence(
      input,
      comparisonConfidence,
    );

    const evidenceSupport = this.clamp(
      matrixCoherence * 0.3 +
        comparisonConfidence * 0.2 +
        directionalEvidence * 0.2 +
        goalEvidence * 0.15 +
        marketSpecificEvidence * 0.15,
      0,
      1,
    );

    /*
     * ----------------------------------------------------------
     * TRUE CONTRADICTION
     * ----------------------------------------------------------
     *
     * Hard contradictions are intentionally restricted to
     * situations where the underlying evidence directly opposes
     * the selected outcome.
     *
     * We do NOT reject a prediction merely because:
     * - its probability differs from the common model;
     * - the comparison is neutral;
     * - it is a handicap line;
     * - a broad goal environment points the other way;
     * - the selected goal line is high/low.
     */
    this.addDirectionalContradiction(
      reasons,
      input,
      direction,
      directionalDifference,
      comparisonConfidence,
    );

    /*
     * Goal-market comparison evidence remains part of
     * evidenceSupport, but broad production/prevention differences
     * are not strong enough by themselves to invalidate a specific
     * goal line such as UNDER_4.5 or HOME_OVER_1.5.
     */
    this.addBttsContradiction(
      reasons,
      input,
      goalProductionDifference,
      goalPreventionDifference,
      comparisonConfidence,
    );

    return {
      coherent: reasons.length === 0,

      reasons,

      probabilityDifference,

      comparisonDirection: direction,

      evidenceSupport,

      comparisonConfidence,

      directionalDifference,

      goalProductionDifference,

      goalPreventionDifference,
    };
  }

  private calculateMatrixCoherence(probabilityDifference: number): number {
    if (probabilityDifference <= 0.02) {
      return 1;
    }

    if (probabilityDifference >= 0.25) {
      return 0;
    }

    return this.clamp(1 - (probabilityDifference - 0.02) / 0.23, 0, 1);
  }

  private calculateDirectionalEvidence(
    market: PredictionMarket,
    selection: string,
    directionalDifference: number,
    comparisonConfidence: number,
  ): number {
    if (comparisonConfidence <= 0) {
      return 0.5;
    }

    const upper = selection.trim().toUpperCase();

    /*
     * These markets are goal-direction or line markets rather than
     * direct home-vs-away result markets.
     *
     * Their outcome cannot be validated by a simple HOME/AWAY
     * comparison direction.
     */
    if (
      market === PredictionMarket.BOTH_TEAMS_TO_SCORE ||
      market === PredictionMarket.OVER_UNDER ||
      market === PredictionMarket.GOAL_RANGE ||
      market === PredictionMarket.TEAM_TOTAL_GOALS ||
      market === PredictionMarket.FIRST_HALF_GOALS ||
      market === PredictionMarket.SECOND_HALF_GOALS
    ) {
      return 0.5;
    }

    const directionStrength = Math.abs(directionalDifference);

    if (upper === 'DRAW' || upper === 'X') {
      return this.clamp((1 - directionStrength) * comparisonConfidence, 0, 1);
    }

    /*
     * Only exact match-result outcomes are treated as direct
     * home/away directional selections here.
     *
     * Handicap selections such as HOME_0.5 or HOME_-1.5 are not
     * direct match-result selections and therefore must not inherit
     * this evidence interpretation.
     */
    if (
      market === PredictionMarket.MATCH_RESULT &&
      (upper === 'HOME' || upper === '1' || upper === 'HOME_WIN')
    ) {
      return this.clamp(
        (0.5 + directionalDifference * 0.5) * comparisonConfidence,
        0,
        1,
      );
    }

    if (
      market === PredictionMarket.MATCH_RESULT &&
      (upper === 'AWAY' || upper === '2' || upper === 'AWAY_WIN')
    ) {
      return this.clamp(
        (0.5 - directionalDifference * 0.5) * comparisonConfidence,
        0,
        1,
      );
    }

    return 0.5;
  }

  private calculateGoalEvidence(
    market: PredictionMarket,
    selection: string,
    goalProductionDifference: number,
    goalPreventionDifference: number,
    comparisonConfidence: number,
  ): number {
    const upper = selection.trim().toUpperCase();

    const goalEnvironment = this.clamp(
      goalProductionDifference - goalPreventionDifference,
      -1,
      1,
    );

    /*
     * ----------------------------------------------------------
     * BTTS
     * ----------------------------------------------------------
     */
    if (market === PredictionMarket.BOTH_TEAMS_TO_SCORE) {
      const positiveSignal = this.clamp(0.5 + goalEnvironment * 0.25, 0, 1);

      if (upper === 'YES' || upper === 'BTTS_YES' || upper === '1') {
        return comparisonConfidence > 0
          ? positiveSignal * comparisonConfidence
          : 0.5;
      }

      if (upper === 'NO' || upper === 'BTTS_NO' || upper === '0') {
        return comparisonConfidence > 0
          ? (1 - positiveSignal) * comparisonConfidence
          : 0.5;
      }

      return 0.5;
    }

    /*
     * ----------------------------------------------------------
     * OVER / UNDER / GOAL RANGE / TEAM TOTAL
     * ----------------------------------------------------------
     */
    if (
      market === PredictionMarket.OVER_UNDER ||
      market === PredictionMarket.FIRST_HALF_GOALS ||
      market === PredictionMarket.SECOND_HALF_GOALS ||
      market === PredictionMarket.GOAL_RANGE ||
      market === PredictionMarket.TEAM_TOTAL_GOALS
    ) {
      const directionalGoalSignal = this.clamp(
        0.5 + goalEnvironment * 0.5,
        0,
        1,
      );

      const confidenceFloor = Math.max(comparisonConfidence, 0.5);

      if (upper.includes('OVER') || upper.startsWith('O')) {
        return this.clamp(directionalGoalSignal * confidenceFloor, 0, 1);
      }

      if (upper.includes('UNDER') || upper.startsWith('U')) {
        return this.clamp((1 - directionalGoalSignal) * confidenceFloor, 0, 1);
      }

      /*
       * GOAL_RANGE has no direct OVER/UNDER token.
       *
       * Treat the range relationship as soft evidence only.
       */
      if (market === PredictionMarket.GOAL_RANGE) {
        if (upper === '0-1' || upper === '2') {
          return this.clamp(
            (1 - directionalGoalSignal) * confidenceFloor,
            0,
            1,
          );
        }

        if (upper === '3-4' || upper === '5+') {
          return this.clamp(directionalGoalSignal * confidenceFloor, 0, 1);
        }
      }
    }

    return this.clamp(
      (0.5 + Math.abs(goalEnvironment) * 0.5) *
        Math.max(comparisonConfidence, 0.5),
      0,
      1,
    );
  }

  private calculateMarketSpecificEvidence(
    input: {
      features: RawPredictionFeatures;
      market: PredictionMarket;
      selection: string;
    },
    comparisonConfidence: number,
  ): number {
    const features = input.features;

    const values: number[] = [];

    /*
     * ----------------------------------------------------------
     * BTTS
     * ----------------------------------------------------------
     */
    if (input.market === PredictionMarket.BOTH_TEAMS_TO_SCORE) {
      const bttsHome = this.readRate(features.home, ['bttsRate']);

      const bttsAway = this.readRate(features.away, ['bttsRate']);

      if (bttsHome !== null) {
        values.push(bttsHome);
      }

      if (bttsAway !== null) {
        values.push(bttsAway);
      }
    }

    /*
     * ----------------------------------------------------------
     * GOAL MARKETS
     * ----------------------------------------------------------
     *
     * Use the actual aggregate goal rates already present in the
     * constructed raw features. No unsupported datasets are
     * fabricated here.
     */
    if (
      input.market === PredictionMarket.OVER_UNDER ||
      input.market === PredictionMarket.GOAL_RANGE ||
      input.market === PredictionMarket.TEAM_TOTAL_GOALS ||
      input.market === PredictionMarket.FIRST_HALF_GOALS ||
      input.market === PredictionMarket.SECOND_HALF_GOALS
    ) {
      this.pushRate(values, features.home, [
        'over15Rate',
        'over25Rate',
        'over35Rate',
      ]);

      this.pushRate(values, features.away, [
        'over15Rate',
        'over25Rate',
        'over35Rate',
      ]);

      if (features.h2h?.available) {
        this.pushRate(values, features.h2h, [
          'over15Rate',
          'over25Rate',
          'over35Rate',
        ]);
      }
    }

    /*
     * H2H remains supplementary rather than replacing direct
     * team/competition evidence.
     */
    if (features.h2h?.available) {
      const upper = input.selection.trim().toUpperCase();

      let h2hRate: number | null = null;

      if (input.market === PredictionMarket.BOTH_TEAMS_TO_SCORE) {
        h2hRate = this.readRate(features.h2h, [
          'bttsRate',
          'bothTeamsToScoreRate',
        ]);

        if (h2hRate !== null) {
          values.push(h2hRate);
        }
      }

      if (
        input.market === PredictionMarket.MATCH_RESULT &&
        (upper === 'DRAW' || upper === 'X')
      ) {
        h2hRate = this.readRate(features.h2h, ['drawRate']);

        if (h2hRate !== null) {
          values.push(h2hRate);
        }
      }
    }

    if (!values.length) {
      return comparisonConfidence;
    }

    const empiricalEvidence = this.average(values);

    return this.clamp(
      empiricalEvidence * 0.65 + comparisonConfidence * 0.35,
      0,
      1,
    );
  }

  private addDirectionalContradiction(
    reasons: string[],
    input: {
      market: PredictionMarket;
      selection: string;
      probability: number;
    },
    direction: 'HOME' | 'DRAW' | 'AWAY' | 'NEUTRAL',
    directionalDifference: number,
    comparisonConfidence: number,
  ): void {
    /*
     * Only direct MATCH_RESULT selections can be contradicted by
     * the global home/away comparison direction.
     *
     * Handicap selections must not be rejected by this test because
     * a positive or negative handicap changes the actual proposition.
     */
    if (
      input.market !== PredictionMarket.MATCH_RESULT ||
      comparisonConfidence < 0.75
    ) {
      return;
    }

    const probability = this.clamp(input.probability, 0, 1);

    const upper = input.selection.trim().toUpperCase();

    if (
      (upper === 'HOME' || upper === '1' || upper === 'HOME_WIN') &&
      direction === 'AWAY' &&
      directionalDifference <= -0.3 &&
      probability >= 0.72
    ) {
      reasons.push('HOME_SELECTION_STRONGLY_CONTRADICTS_TEAM_COMPARISON');

      return;
    }

    if (
      (upper === 'AWAY' || upper === '2' || upper === 'AWAY_WIN') &&
      direction === 'HOME' &&
      directionalDifference >= 0.3 &&
      probability >= 0.72
    ) {
      reasons.push('AWAY_SELECTION_STRONGLY_CONTRADICTS_TEAM_COMPARISON');
    }
  }

  private addBttsContradiction(
    reasons: string[],
    input: {
      market: PredictionMarket;
      selection: string;
      probability: number;
    },
    productionDifference: number,
    preventionDifference: number,
    comparisonConfidence: number,
  ): void {
    if (
      input.market !== PredictionMarket.BOTH_TEAMS_TO_SCORE ||
      comparisonConfidence < 0.8
    ) {
      return;
    }

    const upper = input.selection.trim().toUpperCase();

    const probability = this.clamp(input.probability, 0, 1);

    const environment = this.clamp(
      productionDifference - preventionDifference,
      -1,
      1,
    );

    /*
     * BTTS is the one goal market where a broad scoring environment
     * can provide a meaningful contradiction, but the thresholds
     * are deliberately strong so that ordinary disagreement does not
     * become a hard rejection.
     */
    if (
      (upper === 'YES' || upper === 'BTTS_YES' || upper === '1') &&
      environment <= -0.7 &&
      probability >= 0.85
    ) {
      reasons.push('BTTS_YES_STRONGLY_CONTRADICTS_GOAL_COMPARISON');

      return;
    }

    if (
      (upper === 'NO' || upper === 'BTTS_NO' || upper === '0') &&
      environment >= 0.7 &&
      probability >= 0.85
    ) {
      reasons.push('BTTS_NO_STRONGLY_CONTRADICTS_GOAL_COMPARISON');
    }
  }

  private getComparisonDirection(
    difference: number,
  ): 'HOME' | 'DRAW' | 'AWAY' | 'NEUTRAL' {
    if (!Number.isFinite(difference)) {
      return 'NEUTRAL';
    }

    if (difference >= 0.12) {
      return 'HOME';
    }

    if (difference <= -0.12) {
      return 'AWAY';
    }

    return 'NEUTRAL';
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

  private average(values: number[]): number {
    if (!values.length) {
      return 0;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private clamp(value: number, minimum = 0, maximum = 1): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
