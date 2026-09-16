// src/predictions-engine/engines/probability/raw-model-agreement.util.ts

import { PredictionMarket } from '../../enums/prediction-market.enum';

import { RawPredictionFeatures } from '../../interfaces/raw-prediction-features.interface';

export interface RawModelAgreementResult {
  agreement: number;

  modelOutputs: Record<string, number>;

  signals: string[];
}

export class RawModelAgreementUtil {
  static calculate(
    features: RawPredictionFeatures,
    market: PredictionMarket,
    selection: string,
    commonProbability: number,
    registeredProbability: number,
  ): RawModelAgreementResult {
    const matrixModel = this.clamp(commonProbability);

    const registeredModel = this.clamp(registeredProbability);

    const comparisonModel = this.clamp(
      this.calculateComparisonProbability(features, market, selection),
    );

    /*
     * Three evidence paths:
     *
     * 1. Common score-matrix probability.
     * 2. Registered market model probability.
     * 3. Direct team-to-team comparison probability.
     *
     * Agreement measures convergence between those paths.
     * It does not reject a low-probability prediction.
     */
    const values = [matrixModel, registeredModel, comparisonModel];

    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;

    const deviation =
      values.reduce((sum, value) => sum + Math.abs(value - mean), 0) /
      values.length;

    const agreement = this.clamp(1 - deviation * 4);

    return {
      agreement,

      modelOutputs: {
        matrixModel,
        registeredModel,
        comparisonModel,
      },

      signals: ['matrixModel', 'registeredModel', 'comparisonModel'],
    };
  }

  private static calculateComparisonProbability(
    features: RawPredictionFeatures,
    market: PredictionMarket,
    selection: string,
  ): number {
    const comparison = features.comparison;

    if (!comparison) {
      return 0.5;
    }

    const difference = this.clamp(comparison.directionalDifference ?? 0, -1, 1);

    const upper = selection.trim().toUpperCase();

    switch (market) {
      case PredictionMarket.MATCH_RESULT:
      case PredictionMarket.HALF_TIME_RESULT:
      case PredictionMarket.SECOND_HALF_RESULT:
        return this.directionalSelectionProbability(
          difference,
          upper,
          features,
        );

      case PredictionMarket.ASIAN_HANDICAP:
      case PredictionMarket.EUROPEAN_HANDICAP:
        return this.directionalSelectionProbability(
          difference,
          upper,
          features,
        );

      case PredictionMarket.BOTH_TEAMS_TO_SCORE:
        return this.calculateBttsComparisonProbability(features, upper);

      case PredictionMarket.OVER_UNDER:
      case PredictionMarket.FIRST_HALF_GOALS:
      case PredictionMarket.SECOND_HALF_GOALS:
      case PredictionMarket.GOAL_RANGE:
      case PredictionMarket.TEAM_TOTAL_GOALS:
        return this.calculateGoalComparisonProbability(features, upper);

      default:
        return 0.5;
    }
  }

  private static directionalSelectionProbability(
    difference: number,
    selection: string,
    features: RawPredictionFeatures,
  ): number {
    if (
      selection === 'HOME' ||
      selection === '1' ||
      selection === 'HOME_WIN' ||
      selection.startsWith('HOME_')
    ) {
      return this.directionalProbability(difference);
    }

    if (
      selection === 'AWAY' ||
      selection === '2' ||
      selection === 'AWAY_WIN' ||
      selection.startsWith('AWAY_')
    ) {
      return this.directionalProbability(-difference);
    }

    if (selection === 'DRAW' || selection === 'X') {
      return this.drawProbability(features, difference);
    }

    return 0.5;
  }

  private static calculateBttsComparisonProbability(
    features: RawPredictionFeatures,
    selection: string,
  ): number {
    const values: number[] = [];

    /*
     * Overall team BTTS evidence.
     */
    this.pushRate(values, features.home, ['bttsRate']);

    this.pushRate(values, features.away, ['bttsRate']);

    /*
     * Recent evidence.
     */
    this.pushRate(values, features.home.recent, ['bttsRate']);

    this.pushRate(values, features.away.recent, ['bttsRate']);

    /*
     * Venue-specific evidence.
     */
    this.pushRate(values, features.home.venue, ['bttsRate']);

    this.pushRate(values, features.away.venue, ['bttsRate']);

    /*
     * H2H is supplementary.
     */
    this.pushRate(values, features.h2h, ['bttsRate', 'bothTeamsToScoreRate']);

    if (!values.length) {
      return 0.5;
    }

    const base = this.average(values);

    if (selection === 'YES' || selection === 'BTTS_YES' || selection === '1') {
      return base;
    }

    if (selection === 'NO' || selection === 'BTTS_NO' || selection === '0') {
      return this.clamp(1 - base);
    }

    return 0.5;
  }

  private static calculateGoalComparisonProbability(
    features: RawPredictionFeatures,
    selection: string,
  ): number {
    const comparison = features.comparison;

    if (!comparison) {
      return 0.5;
    }

    const productionDifference = this.clamp(
      comparison.goalProduction?.difference ?? 0,
      -1,
      1,
    );

    const preventionDifference = this.clamp(
      comparison.goalPrevention?.difference ?? 0,
      -1,
      1,
    );

    /*
     * Positive goal environment means the
     * matchup contains stronger scoring
     * evidence.
     */
    const goalEnvironment = this.clamp(
      productionDifference - preventionDifference,
      -1,
      1,
    );

    const threshold = this.extractThreshold(selection);

    /*
     * Higher lines require stronger scoring
     * evidence; lower lines require less.
     */
    const lineAdjustment =
      threshold === null ? 0 : this.clamp((threshold - 2.5) * 0.08, -0.2, 0.2);

    const overProbability = this.clamp(
      0.5 + goalEnvironment * 0.2 - lineAdjustment,
    );

    /*
     * OVER / UNDER.
     */
    if (selection.includes('UNDER') || selection.startsWith('U')) {
      return this.clamp(1 - overProbability);
    }

    if (selection.includes('OVER') || selection.startsWith('O')) {
      /*
       * Team-total selections also contain OVER,
       * so handle the directional team signal
       * before returning.
       */
      if (selection.startsWith('HOME')) {
        const directional = this.clamp(
          comparison.directionalDifference ?? 0,
          -1,
          1,
        );

        return this.clamp(
          0.5 + directional * 0.2 + goalEnvironment * 0.1 - lineAdjustment,
        );
      }

      if (selection.startsWith('AWAY')) {
        const directional = this.clamp(
          comparison.directionalDifference ?? 0,
          -1,
          1,
        );

        return this.clamp(
          0.5 - directional * 0.2 + goalEnvironment * 0.1 - lineAdjustment,
        );
      }

      return overProbability;
    }

    /*
     * Team-total selections.
     */
    if (selection.startsWith('HOME')) {
      const directional = this.clamp(
        comparison.directionalDifference ?? 0,
        -1,
        1,
      );

      return this.clamp(0.5 + directional * 0.2 + goalEnvironment * 0.1);
    }

    if (selection.startsWith('AWAY')) {
      const directional = this.clamp(
        comparison.directionalDifference ?? 0,
        -1,
        1,
      );

      return this.clamp(0.5 - directional * 0.2 + goalEnvironment * 0.1);
    }

    /*
     * GOAL_RANGE.
     *
     * Use the goal environment to distinguish
     * the currently enabled low/high ranges.
     */
    if (selection === '0-1') {
      return this.clamp(0.5 - goalEnvironment * 0.25);
    }

    if (selection === '2') {
      return this.clamp(0.5 - goalEnvironment * 0.05);
    }

    if (selection === '3-4') {
      return this.clamp(0.5 + goalEnvironment * 0.1);
    }

    if (selection === '5+') {
      return this.clamp(0.5 + goalEnvironment * 0.25);
    }

    return 0.5;
  }

  private static drawProbability(
    features: RawPredictionFeatures,
    difference: number,
  ): number {
    const values: number[] = [];

    this.pushRate(values, features.home, ['drawRate']);

    this.pushRate(values, features.away, ['drawRate']);

    this.pushRate(values, features.home.recent, ['drawRate']);

    this.pushRate(values, features.away.recent, ['drawRate']);

    this.pushRate(values, features.home.venue, ['drawRate']);

    this.pushRate(values, features.away.venue, ['drawRate']);

    this.pushRate(values, features.h2h, ['drawRate']);

    const historicalDraw = values.length ? this.average(values) : null;

    /*
     * Actual draw evidence comes first.
     * Similar strength only modulates the
     * observed draw evidence.
     */
    if (historicalDraw !== null) {
      const similarity = this.clamp(1 - Math.abs(difference), 0, 1);

      return this.clamp(historicalDraw * (0.75 + similarity * 0.25));
    }

    return this.clamp(0.3 - Math.abs(difference) * 0.12, 0.05, 0.4);
  }

  private static extractThreshold(selection: string): number | null {
    const match = selection.match(/(?:\d+\.\d+|\d+)/);

    if (!match) {
      return null;
    }

    const value = Number(match[0]);

    return Number.isFinite(value) ? value : null;
  }

  private static directionalProbability(difference: number): number {
    return this.clamp(0.5 + this.clamp(difference, -1, 1) * 0.65);
  }

  private static pushRate(
    values: number[],
    source: unknown,
    keys: string[],
  ): void {
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

  private static average(values: number[]): number {
    if (!values.length) {
      return 0;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private static clamp(value: number, minimum = 0, maximum = 1): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(minimum, value), maximum);
  }
}
