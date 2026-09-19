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

    /*
     * The score-matrix probability and registered probability are the
     * actual probability paths supplied to this utility.
     *
     * The comparison object is NOT treated as a third independent
     * probability model because its dimensions are derived from much
     * of the same underlying team evidence.
     */
    const comparisonSupport = features.comparison
      ? this.calculateComparisonSupport(features, market, selection)
      : null;

    /*
     * Agreement between actual probability paths is based directly on
     * their distance.
     *
     * 0.00 difference → 1.00 agreement
     * 1.00 difference → 0.00 agreement
     *
     * This is much more stable than calculating deviation from a mean
     * across correlated pseudo-models.
     */
    const probabilityAgreement = this.clamp(
      1 - Math.abs(matrixModel - registeredModel),
    );

    /*
     * Comparison evidence is a consistency check only.
     *
     * It can reduce agreement when it materially contradicts the
     * probability direction, but it cannot create agreement by itself.
     */
    const agreement = this.clamp(
      probabilityAgreement *
        this.comparisonAgreementModifier(comparisonSupport),
      0,
      1,
    );

    const signals = ['matrixModel', 'registeredModel'];

    if (comparisonSupport !== null) {
      signals.push(
        comparisonSupport > 0
          ? 'comparisonSupportsSelection'
          : comparisonSupport < 0
            ? 'comparisonContradictsSelection'
            : 'comparisonNeutral',
      );
    } else {
      signals.push('comparisonUnavailable');
    }

    return {
      agreement,

      modelOutputs: {
        matrixModel,

        registeredModel,

        /*
         * This value remains in the output for compatibility and
         * diagnostics, but it is explicitly NOT an independent model
         * probability.
         */
        comparisonModel:
          comparisonSupport === null
            ? 0.5
            : this.comparisonSupportToProbability(comparisonSupport),
      },

      signals,
    };
  }

  private static calculateComparisonSupport(
    features: RawPredictionFeatures,
    market: PredictionMarket,
    selection: string,
  ): number {
    const comparison = features.comparison;

    if (!comparison) {
      return 0;
    }

    const directionalDifference = this.clamp(
      comparison.directionalDifference ?? 0,
      -1,
      1,
    );

    const goalProductionDifference = this.clamp(
      comparison.goalProduction?.difference ?? 0,
      -1,
      1,
    );

    const goalPreventionDifference = this.clamp(
      comparison.goalPrevention?.difference ?? 0,
      -1,
      1,
    );

    switch (market) {
      case PredictionMarket.MATCH_RESULT:
      case PredictionMarket.HALF_TIME_RESULT:
      case PredictionMarket.SECOND_HALF_RESULT:
        return this.resultSelectionSupport(directionalDifference, selection);

      case PredictionMarket.ASIAN_HANDICAP:
      case PredictionMarket.EUROPEAN_HANDICAP:
        return this.handicapSelectionSupport(directionalDifference, selection);

      case PredictionMarket.BOTH_TEAMS_TO_SCORE:
        return this.bttsSelectionSupport(features, selection);

      case PredictionMarket.OVER_UNDER:
      case PredictionMarket.FIRST_HALF_GOALS:
      case PredictionMarket.SECOND_HALF_GOALS:
        return this.goalSelectionSupport(
          goalProductionDifference,
          goalPreventionDifference,
          selection,
        );

      case PredictionMarket.GOAL_RANGE:
        return this.goalRangeSelectionSupport(
          goalProductionDifference,
          goalPreventionDifference,
          selection,
        );

      case PredictionMarket.TEAM_TOTAL_GOALS:
        return this.teamTotalSelectionSupport(
          goalProductionDifference,
          goalPreventionDifference,
          selection,
        );

      default:
        return 0;
    }
  }

  private static resultSelectionSupport(
    difference: number,
    selection: string,
  ): number {
    const normalized = selection.trim().toUpperCase();

    if (
      normalized === 'HOME' ||
      normalized === '1' ||
      normalized === 'HOME_WIN' ||
      normalized.startsWith('HOME_')
    ) {
      return this.clamp(difference, -1, 1);
    }

    if (
      normalized === 'AWAY' ||
      normalized === '2' ||
      normalized === 'AWAY_WIN' ||
      normalized.startsWith('AWAY_')
    ) {
      return this.clamp(-difference, -1, 1);
    }

    /*
     * A directional comparison cannot reliably determine a draw
     * probability. Similarity is therefore used only as a weak
     * consistency signal.
     */
    if (normalized === 'DRAW' || normalized === 'X') {
      return this.clamp(1 - Math.abs(difference), 0, 1);
    }

    return 0;
  }

  private static handicapSelectionSupport(
    difference: number,
    selection: string,
  ): number {
    const parsed = this.parseHandicapSelection(selection);

    if (!parsed) {
      return 0;
    }

    if (parsed.side === 'DRAW') {
      return this.clamp(1 - Math.abs(difference), 0, 1);
    }

    const directedDifference =
      parsed.side === 'HOME' ? difference : -difference;

    /*
     * This is only a direction check.
     *
     * We deliberately do not manufacture a handicap probability from
     * the comparison score.
     */
    return this.clamp(directedDifference, -1, 1);
  }

  private static bttsSelectionSupport(
    features: RawPredictionFeatures,
    selection: string,
  ): number {
    const normalized = selection.trim().toUpperCase();

    const home = this.calculateTeamScoringSupport(features.home);

    const away = this.calculateTeamScoringSupport(features.away);

    /*
     * Both teams need scoring support for BTTS YES.
     */
    const yesSupport = this.clamp(Math.min(home, away), 0, 1);

    if (
      normalized === 'YES' ||
      normalized === 'BTTS_YES' ||
      normalized === '1'
    ) {
      return yesSupport;
    }

    if (normalized === 'NO' || normalized === 'BTTS_NO' || normalized === '0') {
      return this.clamp(-yesSupport, -1, 0);
    }

    return 0;
  }

  private static goalSelectionSupport(
    productionDifference: number,
    preventionDifference: number,
    selection: string,
  ): number {
    const normalized = selection.trim().toUpperCase();

    /*
     * Positive values indicate a more goal-friendly environment.
     */
    const goalEnvironment = this.clamp(
      (productionDifference - preventionDifference) / 2,
      -1,
      1,
    );

    if (normalized.includes('OVER') || normalized.startsWith('O')) {
      return goalEnvironment;
    }

    if (normalized.includes('UNDER') || normalized.startsWith('U')) {
      return -goalEnvironment;
    }

    return 0;
  }

  private static goalRangeSelectionSupport(
    productionDifference: number,
    preventionDifference: number,
    selection: string,
  ): number {
    const normalized = selection.trim().toUpperCase();

    const goalEnvironment = this.clamp(
      (productionDifference - preventionDifference) / 2,
      -1,
      1,
    );

    /*
     * Range direction is intentionally weak.
     *
     * The actual probability must come from the goal distribution.
     */
    switch (normalized) {
      case '0-1':
        return -goalEnvironment;

      case '2':
        return 0;

      case '3-4':
        return goalEnvironment * 0.5;

      case '5+':
        return goalEnvironment;

      default:
        return 0;
    }
  }

  private static teamTotalSelectionSupport(
    productionDifference: number,
    preventionDifference: number,
    selection: string,
  ): number {
    const normalized = selection.trim().toUpperCase();

    const isHome = normalized.startsWith('HOME_');

    const isAway = normalized.startsWith('AWAY_');

    if (!isHome && !isAway) {
      return 0;
    }

    const teamProduction = isHome
      ? productionDifference
      : -productionDifference;

    const opponentPrevention = isHome
      ? -preventionDifference
      : preventionDifference;

    const scoringEnvironment = this.clamp(
      (teamProduction + opponentPrevention) / 2,
      -1,
      1,
    );

    if (normalized.includes('_OVER_')) {
      return scoringEnvironment;
    }

    if (normalized.includes('_UNDER_')) {
      return -scoringEnvironment;
    }

    return 0;
  }

  private static calculateTeamScoringSupport(
    team: RawPredictionFeatures['home'],
  ): number {
    const values: number[] = [];

    this.pushRate(values, team.bttsRate);

    this.pushRate(values, team.recent?.bttsRate);

    this.pushRate(values, team.venue?.bttsRate);

    const failedToScore = this.readRate(team.failedToScoreRate);

    if (failedToScore !== null) {
      values.push(1 - failedToScore);
    }

    const recentFailedToScore = this.readRate(team.recent?.failedToScoreRate);

    if (recentFailedToScore !== null) {
      values.push(1 - recentFailedToScore);
    }

    const venueFailedToScore = this.readRate(team.venue?.failedToScoreRate);

    if (venueFailedToScore !== null) {
      values.push(1 - venueFailedToScore);
    }

    if (!values.length) {
      return 0.5;
    }

    return this.clamp(
      values.reduce((sum, value) => sum + value, 0) / values.length,
      0,
      1,
    );
  }

  private static comparisonSupportToProbability(support: number): number {
    return this.clamp(0.5 + this.clamp(support, -1, 1) * 0.5, 0, 1);
  }

  private static comparisonAgreementModifier(support: number | null): number {
    if (support === null) {
      return 1;
    }

    /*
     * Agreement should remain primarily about actual probability paths.
     *
     * Positive comparison support provides only a small consistency
     * benefit.
     *
     * Contradictory comparison evidence creates a modest penalty.
     *
     * This prevents comparison from becoming a hidden third model.
     */
    if (support > 0) {
      return 1;
    }

    if (support < 0) {
      return this.clamp(1 - Math.abs(support) * 0.15, 0.85, 1);
    }

    return 1;
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

  private static pushRate(
    values: number[],
    value: number | null | undefined,
  ): void {
    const normalized = this.readRate(value);

    if (normalized !== null) {
      values.push(normalized);
    }
  }

  private static readRate(value: number | null | undefined): number | null {
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

  private static clamp(value: number, minimum = 0, maximum = 1): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
