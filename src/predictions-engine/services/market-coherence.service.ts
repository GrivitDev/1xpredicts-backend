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

    rawProbability?: number;

    commonProbability: MarketProbabilityResult;
  }): MarketCoherenceResult {
    const reasons: string[] = [];

    const probability = this.clamp(input.probability, 0, 1);

    /*
     * IMPORTANT:
     *
     * ProbabilityEngine may already have applied calibration.
     *
     * Coherence must therefore compare the structural/raw
     * probability against the common score-matrix probability.
     *
     * Calibration is not treated as model contradiction.
     */
    const structuralProbability = this.clamp(
      input.rawProbability ?? input.commonProbability.probability,
      0,
      1,
    );

    const commonProbability = this.clamp(
      input.commonProbability.probability,
      0,
      1,
    );

    const probabilityDifference = Math.abs(
      structuralProbability - commonProbability,
    );

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
     * SCORE-MATRIX VALIDITY
     * ----------------------------------------------------------
     */
    if (!input.commonProbability.scoreMatrixCoherent) {
      reasons.push('COMMON_SCORE_MATRIX_CANNOT_PRICE_MARKET');
    }

    /*
     * ----------------------------------------------------------
     * MATCH-RESULT DISTRIBUTION
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
     * MARKET PROBABILITY VALIDITY
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
     * STRUCTURAL COHERENCE
     * ----------------------------------------------------------
     *
     * This evaluates whether the raw structural probability
     * agrees with the common market probability.
     *
     * It does not punish a legitimate calibration adjustment.
     */
    const matrixCoherence = this.calculateMatrixCoherence(
      probabilityDifference,
    );

    /*
     * ----------------------------------------------------------
     * SELECTION-ALIGNED EVIDENCE
     * ----------------------------------------------------------
     */
    const selectionEvidence = this.calculateSelectionEvidence(
      input.market,
      input.selection,
      directionalDifference,
      goalProductionDifference,
      goalPreventionDifference,
    );

    /*
     * ----------------------------------------------------------
     * MARKET-SPECIFIC DATA AVAILABILITY
     * ----------------------------------------------------------
     *
     * This is intentionally a small supporting signal.
     *
     * It does not become another probability model.
     */
    const marketSpecificEvidence = this.calculateMarketSpecificEvidence(input);

    /*
     * ----------------------------------------------------------
     * EVIDENCE SUPPORT
     * ----------------------------------------------------------
     *
     * This is a trust/coherence score, not a probability.
     *
     * Selection alignment is the largest component because the
     * evidence must actually support the chosen proposition.
     */
    const baseEvidenceSupport =
      matrixCoherence * 0.25 +
      selectionEvidence * 0.45 +
      comparisonConfidence * 0.2 +
      marketSpecificEvidence * 0.1;

    let evidenceSupport = this.clamp(baseEvidenceSupport, 0, 1);

    /*
     * ----------------------------------------------------------
     * HARD CONTRADICTIONS
     * ----------------------------------------------------------
     */
    this.addDirectionalContradiction(
      reasons,
      input.market,
      input.selection,
      probability,
      direction,
      directionalDifference,
      comparisonConfidence,
    );

    this.addBttsContradiction(
      reasons,
      input.market,
      input.selection,
      probability,
      goalProductionDifference,
      goalPreventionDifference,
      comparisonConfidence,
    );

    /*
     * A hard contradiction materially reduces coherence.
     *
     * This does not alter probability.
     */
    if (reasons.length > 0) {
      evidenceSupport = this.clamp(evidenceSupport * 0.25, 0, 1);
    }

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

  private calculateSelectionEvidence(
    market: PredictionMarket,
    selection: string,
    directionalDifference: number,
    goalProductionDifference: number,
    goalPreventionDifference: number,
  ): number {
    /*
     * ----------------------------------------------------------
     * DIRECT RESULT / HANDICAP MARKETS
     * ----------------------------------------------------------
     */
    if (
      market === PredictionMarket.MATCH_RESULT ||
      market === PredictionMarket.ASIAN_HANDICAP ||
      market === PredictionMarket.EUROPEAN_HANDICAP
    ) {
      return this.calculateDirectionalAlignment(
        market,
        selection,
        directionalDifference,
      );
    }

    /*
     * ----------------------------------------------------------
     * GOAL-DIRECTION MARKETS
     * ----------------------------------------------------------
     */
    if (
      market === PredictionMarket.BOTH_TEAMS_TO_SCORE ||
      market === PredictionMarket.OVER_UNDER ||
      market === PredictionMarket.FIRST_HALF_GOALS ||
      market === PredictionMarket.SECOND_HALF_GOALS ||
      market === PredictionMarket.TEAM_TOTAL_GOALS ||
      market === PredictionMarket.GOAL_RANGE
    ) {
      return this.calculateGoalAlignment(
        market,
        selection,
        goalProductionDifference,
        goalPreventionDifference,
      );
    }

    /*
     * Markets without reliable selection-specific comparison
     * evidence remain neutral.
     */
    return 0.5;
  }

  private calculateDirectionalAlignment(
    market: PredictionMarket,
    selection: string,
    directionalDifference: number,
  ): number {
    const upper = selection.trim().toUpperCase();

    const directional = this.clamp(directionalDifference, -1, 1);

    /*
     * DRAW / X
     *
     * A neutral team-direction signal is more compatible with
     * a draw than a strong directional imbalance.
     */
    if (
      market === PredictionMarket.MATCH_RESULT &&
      (upper === 'DRAW' || upper === 'X')
    ) {
      return this.clamp(1 - Math.abs(directional), 0, 1);
    }

    /*
     * HOME proposition.
     */
    if (
      upper === 'HOME' ||
      upper === '1' ||
      upper === 'HOME_WIN' ||
      upper.startsWith('HOME_')
    ) {
      return this.clamp(0.5 + directional * 0.5, 0, 1);
    }

    /*
     * AWAY proposition.
     */
    if (
      upper === 'AWAY' ||
      upper === '2' ||
      upper === 'AWAY_WIN' ||
      upper.startsWith('AWAY_')
    ) {
      return this.clamp(0.5 - directional * 0.5, 0, 1);
    }

    /*
     * European handicap draw.
     */
    if (upper === 'DRAW' || upper === 'X' || upper.startsWith('DRAW_')) {
      return this.clamp(1 - Math.abs(directional), 0, 1);
    }

    return 0.5;
  }

  private calculateGoalAlignment(
    market: PredictionMarket,
    selection: string,
    goalProductionDifference: number,
    goalPreventionDifference: number,
  ): number {
    const upper = selection.trim().toUpperCase();

    const production = this.clamp(goalProductionDifference, -1, 1);

    const prevention = this.clamp(goalPreventionDifference, -1, 1);

    /*
     * Higher production difference generally increases the
     * goal environment.
     *
     * Higher prevention difference means the home side has the
     * stronger prevention profile, therefore reducing the broad
     * goal environment.
     */
    const goalEnvironment = this.clamp(production - prevention, -1, 1);

    const positiveGoalSignal = this.clamp(0.5 + goalEnvironment * 0.5, 0, 1);

    /*
     * ----------------------------------------------------------
     * BTTS
     * ----------------------------------------------------------
     */
    if (market === PredictionMarket.BOTH_TEAMS_TO_SCORE) {
      if (upper === 'YES' || upper === 'BTTS_YES' || upper === '1') {
        return positiveGoalSignal;
      }

      if (upper === 'NO' || upper === 'BTTS_NO' || upper === '0') {
        return this.clamp(1 - positiveGoalSignal, 0, 1);
      }

      return 0.5;
    }

    /*
     * ----------------------------------------------------------
     * TEAM TOTAL GOALS
     * ----------------------------------------------------------
     */
    if (market === PredictionMarket.TEAM_TOTAL_GOALS) {
      if (upper.startsWith('HOME_')) {
        const homeScoringSignal = this.clamp(0.5 + production * 0.5, 0, 1);

        if (upper.includes('_OVER_') || upper.includes('_OVER:')) {
          return homeScoringSignal;
        }

        if (upper.includes('_UNDER_') || upper.includes('_UNDER:')) {
          return this.clamp(1 - homeScoringSignal, 0, 1);
        }
      }

      if (upper.startsWith('AWAY_')) {
        const awayScoringSignal = this.clamp(0.5 - production * 0.5, 0, 1);

        if (upper.includes('_OVER_') || upper.includes('_OVER:')) {
          return awayScoringSignal;
        }

        if (upper.includes('_UNDER_') || upper.includes('_UNDER:')) {
          return this.clamp(1 - awayScoringSignal, 0, 1);
        }
      }

      return 0.5;
    }

    /*
     * ----------------------------------------------------------
     * OVER / UNDER
     * ----------------------------------------------------------
     */
    if (
      market === PredictionMarket.OVER_UNDER ||
      market === PredictionMarket.FIRST_HALF_GOALS ||
      market === PredictionMarket.SECOND_HALF_GOALS
    ) {
      if (
        upper.startsWith('OVER_') ||
        upper.startsWith('OVER:') ||
        upper.startsWith('OVER ')
      ) {
        return positiveGoalSignal;
      }

      if (
        upper.startsWith('UNDER_') ||
        upper.startsWith('UNDER:') ||
        upper.startsWith('UNDER ')
      ) {
        return this.clamp(1 - positiveGoalSignal, 0, 1);
      }

      return 0.5;
    }

    /*
     * ----------------------------------------------------------
     * GOAL RANGE
     * ----------------------------------------------------------
     *
     * Broad ranges can receive only broad goal-environment
     * evidence.
     *
     * Exact range selection is not manufactured from a generic
     * directional signal.
     */
    if (market === PredictionMarket.GOAL_RANGE) {
      const normalized = upper.replace(/\s+/g, '');

      if (normalized === '0-1') {
        return this.clamp(1 - positiveGoalSignal, 0, 1);
      }

      if (normalized === '2') {
        return 0.5;
      }

      if (normalized === '3-4' || normalized === '5+') {
        return positiveGoalSignal;
      }

      return 0.5;
    }

    return 0.5;
  }

  private calculateMarketSpecificEvidence(input: {
    features: RawPredictionFeatures;
    market: PredictionMarket;
    selection: string;
  }): number {
    /*
     * This function measures availability of explicit
     * market-specific supporting data.
     *
     * It does not turn that data into another probability.
     */
    if (input.market === PredictionMarket.BOTH_TEAMS_TO_SCORE) {
      const h2hRate = this.readRate(input.features.h2h, [
        'bttsRate',
        'bothTeamsToScoreRate',
      ]);

      return h2hRate !== null ? 0.75 : 0.5;
    }

    if (input.market === PredictionMarket.MATCH_RESULT) {
      const upper = input.selection.trim().toUpperCase();

      if (upper === 'HOME' || upper === '1' || upper === 'HOME_WIN') {
        return this.readRate(input.features.h2h, ['homeWinRate']) !== null
          ? 0.75
          : 0.5;
      }

      if (upper === 'DRAW' || upper === 'X') {
        return this.readRate(input.features.h2h, ['drawRate']) !== null
          ? 0.75
          : 0.5;
      }

      if (upper === 'AWAY' || upper === '2' || upper === 'AWAY_WIN') {
        return this.readRate(input.features.h2h, ['awayWinRate']) !== null
          ? 0.75
          : 0.5;
      }
    }

    /*
     * Explicit period datasets increase evidence availability,
     * but generic full-match data is not accepted as period data.
     */
    if (
      input.market === PredictionMarket.HALF_TIME_RESULT ||
      input.market === PredictionMarket.SECOND_HALF_RESULT ||
      input.market === PredictionMarket.FIRST_HALF_GOALS ||
      input.market === PredictionMarket.SECOND_HALF_GOALS
    ) {
      const secondHalf =
        input.market === PredictionMarket.SECOND_HALF_RESULT ||
        input.market === PredictionMarket.SECOND_HALF_GOALS;

      if (this.hasExplicitPeriodEvidence(input.features, secondHalf)) {
        return 0.75;
      }

      return 0.35;
    }

    return 0.5;
  }

  private hasExplicitPeriodEvidence(
    features: RawPredictionFeatures,
    secondHalf: boolean,
  ): boolean {
    const periodKey = secondHalf ? 'secondHalf' : 'firstHalf';

    if (features.home?.[periodKey] || features.away?.[periodKey]) {
      return true;
    }

    const sources = [
      features.home?.sourceData?.competitionStats,
      features.away?.sourceData?.competitionStats,
      features.home?.sourceData?.performanceProfile,
      features.away?.sourceData?.performanceProfile,
    ];

    return sources.some((source) => {
      if (!source || typeof source !== 'object' || Array.isArray(source)) {
        return false;
      }

      const nested = source[periodKey];

      return !!nested && typeof nested === 'object' && !Array.isArray(nested);
    });
  }

  private addDirectionalContradiction(
    reasons: string[],
    market: PredictionMarket,
    selection: string,
    probability: number,
    direction: 'HOME' | 'DRAW' | 'AWAY' | 'NEUTRAL',
    directionalDifference: number,
    comparisonConfidence: number,
  ): void {
    if (
      market !== PredictionMarket.MATCH_RESULT ||
      comparisonConfidence < 0.75
    ) {
      return;
    }

    const upper = selection.trim().toUpperCase();

    /*
     * We only treat a strong directional opposition as a hard
     * contradiction when the selected probability is itself high.
     *
     * A low-probability selection can legitimately disagree with
     * the stronger side without being a contradiction.
     */
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
    market: PredictionMarket,
    selection: string,
    probability: number,
    productionDifference: number,
    preventionDifference: number,
    comparisonConfidence: number,
  ): void {
    if (
      market !== PredictionMarket.BOTH_TEAMS_TO_SCORE ||
      comparisonConfidence < 0.8
    ) {
      return;
    }

    const upper = selection.trim().toUpperCase();

    const environment = this.clamp(
      productionDifference - preventionDifference,
      -1,
      1,
    );

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

  private readRate(source: unknown, keys: string[]): number | null {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
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

  private calculateMatrixCoherence(probabilityDifference: number): number {
    if (probabilityDifference <= 0.02) {
      return 1;
    }

    if (probabilityDifference >= 0.25) {
      return 0;
    }

    return this.clamp(1 - (probabilityDifference - 0.02) / 0.23, 0, 1);
  }

  private clamp(value: number, minimum = 0, maximum = 1): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
