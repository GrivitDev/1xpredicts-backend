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

    const comparisonAvailable = !!features.comparison;

    const comparisonModel = comparisonAvailable
      ? this.clamp(
          this.calculateComparisonProbability(features, market, selection),
        )
      : null;

    /*
     * ----------------------------------------------------------
     * MODEL AGREEMENT
     * ----------------------------------------------------------
     *
     * Missing comparison evidence is NOT a 50% prediction.
     *
     * If comparison data is unavailable, agreement is calculated
     * only across the model paths that actually exist.
     */
    const values =
      comparisonModel === null
        ? [matrixModel, registeredModel]
        : [matrixModel, registeredModel, comparisonModel];

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

        comparisonModel: comparisonModel ?? matrixModel,
      },

      signals:
        comparisonModel === null
          ? ['matrixModel', 'registeredModel']
          : ['matrixModel', 'registeredModel', 'comparisonModel'],
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
        return this.calculateAsianHandicapComparisonProbability(
          difference,
          upper,
          comparison.confidence ?? 0,
        );

      case PredictionMarket.EUROPEAN_HANDICAP:
        return this.calculateEuropeanHandicapComparisonProbability(
          difference,
          upper,
          comparison.confidence ?? 0,
        );

      case PredictionMarket.BOTH_TEAMS_TO_SCORE:
        return this.calculateBttsComparisonProbability(features, upper);

      case PredictionMarket.OVER_UNDER:
        return this.calculateGoalDirectionComparisonProbability(
          productionDifference,
          preventionDifference,
          upper,
        );

      case PredictionMarket.FIRST_HALF_GOALS:
      case PredictionMarket.SECOND_HALF_GOALS:
        return this.calculatePeriodGoalComparisonProbability(
          productionDifference,
          preventionDifference,
          upper,
        );

      case PredictionMarket.GOAL_RANGE:
        return this.calculateGoalRangeComparisonProbability(
          productionDifference,
          preventionDifference,
          upper,
        );

      case PredictionMarket.TEAM_TOTAL_GOALS:
        return this.calculateTeamTotalComparisonProbability(
          difference,
          productionDifference,
          preventionDifference,
          upper,
        );

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

  private static calculateAsianHandicapComparisonProbability(
    difference: number,
    selection: string,
    confidence: number,
  ): number {
    const normalizedConfidence = this.clamp(confidence, 0, 1);

    if (normalizedConfidence <= 0) {
      return 0.5;
    }

    const parsed = this.parseHandicapSelection(selection);

    if (!parsed) {
      return 0.5;
    }

    /*
     * A handicap changes the strength required from the selected
     * side. Larger negative handicaps require stronger directional
     * evidence. Positive handicaps require less.
     *
     * The comparison signal is deliberately bounded and remains a
     * secondary model path.
     */
    const directional = parsed.side === 'HOME' ? difference : -difference;

    const linePressure = this.handicapLinePressure(parsed.line);

    const adjustedSignal = directional - linePressure;

    const base = this.directionalProbability(adjustedSignal);

    return this.clamp(0.5 + (base - 0.5) * normalizedConfidence);
  }

  private static calculateEuropeanHandicapComparisonProbability(
    difference: number,
    selection: string,
    confidence: number,
  ): number {
    const normalizedConfidence = this.clamp(confidence, 0, 1);

    if (normalizedConfidence <= 0) {
      return 0.5;
    }

    const parsed = this.parseHandicapSelection(selection);

    if (!parsed) {
      return 0.5;
    }

    const directional =
      parsed.side === 'HOME'
        ? difference
        : parsed.side === 'AWAY'
          ? -difference
          : 0;

    /*
     * European handicap lines are discrete outcome shifts.
     * Larger negative lines require stronger directional support.
     */
    if (parsed.side === 'DRAW') {
      const drawBase = this.drawProbability(
        {
          comparison: {
            directionalDifference: difference,
          },
        } as RawPredictionFeatures,
        difference,
      );

      const lineEffect = Math.abs(parsed.line) * 0.08;

      return this.clamp(
        0.5 +
          (drawBase - 0.5) * normalizedConfidence -
          Math.sign(parsed.line) * lineEffect,
      );
    }

    const linePressure = this.handicapLinePressure(parsed.line);

    const adjustedSignal = directional - linePressure;

    const base = this.directionalProbability(adjustedSignal);

    return this.clamp(0.5 + (base - 0.5) * normalizedConfidence);
  }

  private static calculateBttsComparisonProbability(
    features: RawPredictionFeatures,
    selection: string,
  ): number {
    const values: number[] = [];

    this.pushRate(values, features.home, ['bttsRate']);

    this.pushRate(values, features.away, ['bttsRate']);

    this.pushRate(values, features.home.recent, ['bttsRate']);

    this.pushRate(values, features.away.recent, ['bttsRate']);

    this.pushRate(values, features.home.venue, ['bttsRate']);

    this.pushRate(values, features.away.venue, ['bttsRate']);

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

  private static calculateGoalDirectionComparisonProbability(
    productionDifference: number,
    preventionDifference: number,
    selection: string,
  ): number {
    const goalEnvironment = this.clamp(
      productionDifference - preventionDifference,
      -1,
      1,
    );

    const threshold = this.extractThreshold(selection);

    const lineAdjustment =
      threshold === null ? 0 : this.clamp((threshold - 2.5) * 0.08, -0.2, 0.2);

    const overProbability = this.clamp(
      0.5 + goalEnvironment * 0.2 - lineAdjustment,
    );

    if (selection.includes('UNDER') || selection.startsWith('U')) {
      return this.clamp(1 - overProbability);
    }

    if (selection.includes('OVER') || selection.startsWith('O')) {
      return overProbability;
    }

    return 0.5;
  }

  private static calculatePeriodGoalComparisonProbability(
    productionDifference: number,
    preventionDifference: number,
    selection: string,
  ): number {
    /*
     * There are no dedicated half-specific comparison fields in
     * this contract.
     *
     * Therefore use the available goal environment only as a
     * bounded secondary signal rather than pretending that it is
     * an exact first-half/second-half probability.
     */
    return this.calculateGoalDirectionComparisonProbability(
      productionDifference,
      preventionDifference,
      selection,
    );
  }

  private static calculateTeamTotalComparisonProbability(
    difference: number,
    productionDifference: number,
    preventionDifference: number,
    selection: string,
  ): number {
    const upper = selection.trim().toUpperCase();

    const isHome = upper.startsWith('HOME_');

    const isAway = upper.startsWith('AWAY_');

    if (!isHome && !isAway) {
      return 0.5;
    }

    /*
     * Team-total evidence must be directed at the actual team.
     *
     * Production difference:
     *   positive => home attack advantage
     *
     * Prevention difference:
     *   positive => home defensive-prevention advantage
     *
     * For a team's own scoring total:
     *   stronger production supports OVER
     *   stronger opponent prevention supports UNDER
     */
    const teamProduction = isHome
      ? productionDifference
      : -productionDifference;

    const opponentPrevention = isHome
      ? -preventionDifference
      : preventionDifference;

    const threshold = this.extractThreshold(upper);

    const lineAdjustment =
      threshold === null
        ? 0
        : this.clamp((threshold - 1.5) * 0.08, -0.12, 0.16);

    const overSignal = this.clamp(
      0.5 + teamProduction * 0.2 + opponentPrevention * 0.2 - lineAdjustment,
    );

    if (upper.includes('_UNDER_')) {
      return this.clamp(1 - overSignal);
    }

    if (upper.includes('_OVER_')) {
      return overSignal;
    }

    return this.clamp(0.5 + difference * 0.15);
  }

  private static calculateGoalRangeComparisonProbability(
    productionDifference: number,
    preventionDifference: number,
    selection: string,
  ): number {
    const goalEnvironment = this.clamp(
      productionDifference - preventionDifference,
      -1,
      1,
    );

    /*
     * This is intentionally a soft ordering signal, not an exact
     * probability estimate. The actual exact-range probability is
     * calculated from the score matrix by MarketProbabilityUtil.
     */
    switch (selection.trim().toUpperCase()) {
      case '0-1':
        return this.clamp(0.5 - goalEnvironment * 0.25);

      case '2':
        return this.clamp(0.5 - goalEnvironment * 0.05);

      case '3-4':
        return this.clamp(0.5 + goalEnvironment * 0.1);

      case '5+':
        return this.clamp(0.5 + goalEnvironment * 0.25);

      default:
        return 0.5;
    }
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
     * Similar strength only modulates observed draw evidence.
     */
    if (historicalDraw !== null) {
      const similarity = this.clamp(1 - Math.abs(difference), 0, 1);

      return this.clamp(historicalDraw * (0.75 + similarity * 0.25));
    }

    return this.clamp(0.3 - Math.abs(difference) * 0.12, 0.05, 0.4);
  }

  private static parseHandicapSelection(selection: string): {
    side: 'HOME' | 'AWAY' | 'DRAW';

    line: number;
  } | null {
    const match = selection
      .trim()
      .toUpperCase()
      .match(/^(HOME|AWAY|DRAW|1|X|2)[_: -]?([+-]?\d+(?:\.\d+)?)$/);

    if (!match) {
      return null;
    }

    const side =
      match[1] === 'HOME' || match[1] === '1'
        ? 'HOME'
        : match[1] === 'DRAW' || match[1] === 'X'
          ? 'DRAW'
          : 'AWAY';

    const line = Number(match[2]);

    if (!Number.isFinite(line)) {
      return null;
    }

    return {
      side,
      line,
    };
  }

  private static handicapLinePressure(line: number): number {
    if (line <= -1.5) {
      return 0.5;
    }

    if (line <= -1) {
      return 0.34;
    }

    if (line <= -0.5) {
      return 0.18;
    }

    if (line <= 0.5) {
      return 0;
    }

    if (line <= 1) {
      return -0.16;
    }

    return -0.3;
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
