// src/predictions-engine/utils/settlement-outcome.util.ts

import { PredictionMarket } from '../enums/prediction-market.enum';
import { SettlementStatus } from '../enums/settlement-status.enum';

export interface SettlementEvaluation {
  status: SettlementStatus;

  actualOutcome: boolean | null;

  actualValue: unknown;

  resultLabel: string | null;
}

export interface SettlementScoreInput {
  finalHomeScore: number;

  finalAwayScore: number;

  halfTimeHomeScore: number | null;

  halfTimeAwayScore: number | null;
}

export class SettlementOutcomeUtil {
  static evaluate(
    market: PredictionMarket,
    selection: string,
    score: SettlementScoreInput,
  ): SettlementEvaluation {
    const finalHome = this.normalizeScore(score.finalHomeScore);
    const finalAway = this.normalizeScore(score.finalAwayScore);

    const totalGoals = finalHome + finalAway;

    const normalizedSelection = this.normalizeSelection(selection);

    switch (market) {
      case PredictionMarket.MATCH_RESULT:
        return this.matchResult(normalizedSelection, finalHome, finalAway);

      case PredictionMarket.OVER_UNDER:
        return this.overUnder(normalizedSelection, totalGoals);

      case PredictionMarket.BOTH_TEAMS_TO_SCORE:
        return this.btts(normalizedSelection, finalHome, finalAway);

      case PredictionMarket.GOAL_RANGE:
        return this.goalRange(normalizedSelection, totalGoals);

      case PredictionMarket.TEAM_TOTAL_GOALS:
        return this.teamTotalGoals(normalizedSelection, finalHome, finalAway);

      case PredictionMarket.HALF_TIME_RESULT:
        return this.halfTimeResult(normalizedSelection, score);

      case PredictionMarket.SECOND_HALF_RESULT:
        return this.secondHalfResult(normalizedSelection, score);

      case PredictionMarket.FIRST_HALF_GOALS:
        return this.firstHalfGoals(normalizedSelection, score);

      case PredictionMarket.SECOND_HALF_GOALS:
        return this.secondHalfGoals(normalizedSelection, score);

      case PredictionMarket.ASIAN_HANDICAP:
        return this.asianHandicap(normalizedSelection, finalHome, finalAway);

      case PredictionMarket.EUROPEAN_HANDICAP:
        return this.europeanHandicap(normalizedSelection, finalHome, finalAway);

      default:
        return this.pending('UNSUPPORTED_MARKET');
    }
  }

  private static matchResult(
    selection: string,
    home: number,
    away: number,
  ): SettlementEvaluation {
    const actual = this.scoreResult(home, away);

    if (actual !== 'HOME' && actual !== 'DRAW' && actual !== 'AWAY') {
      return this.pending('INVALID_RESULT');
    }

    const normalized = this.normalizeResult(selection);

    if (
      normalized !== 'HOME' &&
      normalized !== 'DRAW' &&
      normalized !== 'AWAY'
    ) {
      return this.pending('INVALID_SELECTION');
    }

    const won = normalized === actual;

    return this.evaluation(
      won ? SettlementStatus.WON : SettlementStatus.LOST,
      won,
      actual,
      actual,
    );
  }

  private static overUnder(
    selection: string,
    totalGoals: number,
  ): SettlementEvaluation {
    const parsed = selection.match(/^(OVER|UNDER)[:_ -]?(\d+(?:\.\d+)?)$/);

    if (!parsed) {
      return this.pending('INVALID_SELECTION');
    }

    const side = parsed[1];

    const line = Number(parsed[2]);

    if (!Number.isFinite(line) || line < 0) {
      return this.pending('INVALID_SELECTION');
    }

    if (totalGoals === line) {
      return this.evaluation(
        SettlementStatus.VOID,
        null,
        totalGoals,
        `${side}_${line}_PUSH`,
      );
    }

    const won = side === 'OVER' ? totalGoals > line : totalGoals < line;

    return this.evaluation(
      won ? SettlementStatus.WON : SettlementStatus.LOST,
      won,
      totalGoals,
      `${side}_${line}`,
    );
  }

  private static btts(
    selection: string,
    home: number,
    away: number,
  ): SettlementEvaluation {
    const normalized = selection
      .trim()
      .toUpperCase()
      .replace(/[\s_-]/g, '');

    const expectsYes =
      normalized === 'YES' || normalized === 'BTTSYES' || normalized === '1';

    const expectsNo =
      normalized === 'NO' || normalized === 'BTTSNO' || normalized === '0';

    if (!expectsYes && !expectsNo) {
      return this.pending('INVALID_SELECTION');
    }

    const actual = home > 0 && away > 0;

    const won = expectsYes ? actual : !actual;

    return this.evaluation(
      won ? SettlementStatus.WON : SettlementStatus.LOST,
      won,
      actual ? 'YES' : 'NO',
      actual ? 'YES' : 'NO',
    );
  }

  private static goalRange(
    selection: string,
    totalGoals: number,
  ): SettlementEvaluation {
    const normalized = selection.trim().toUpperCase().replace(/\s+/g, '');

    const value = normalized.replace(/^(?:GOALS?|TOTAL_?GOALS?)[:_-]?/i, '');

    const exactMatch = value.match(/^\d+$/);

    if (exactMatch) {
      const expected = Number(value);

      if (!Number.isFinite(expected) || expected < 0) {
        return this.pending('INVALID_SELECTION');
      }

      const won = totalGoals === expected;

      return this.evaluation(
        won ? SettlementStatus.WON : SettlementStatus.LOST,
        won,
        totalGoals,
        `${expected}`,
      );
    }

    const plusMatch = value.match(/^(\d+)\+$/);

    if (plusMatch) {
      const minimum = Number(plusMatch[1]);

      if (!Number.isFinite(minimum) || minimum < 0) {
        return this.pending('INVALID_SELECTION');
      }

      const won = totalGoals >= minimum;

      return this.evaluation(
        won ? SettlementStatus.WON : SettlementStatus.LOST,
        won,
        totalGoals,
        `${minimum}+`,
      );
    }

    const rangeMatch = value.match(/^(\d+)-(\d+)$/);

    if (!rangeMatch) {
      return this.pending('INVALID_SELECTION');
    }

    const minimum = Number(rangeMatch[1]);

    const maximum = Number(rangeMatch[2]);

    if (
      !Number.isFinite(minimum) ||
      !Number.isFinite(maximum) ||
      minimum < 0 ||
      maximum < minimum
    ) {
      return this.pending('INVALID_SELECTION');
    }

    const won = totalGoals >= minimum && totalGoals <= maximum;

    return this.evaluation(
      won ? SettlementStatus.WON : SettlementStatus.LOST,
      won,
      totalGoals,
      `${minimum}-${maximum}`,
    );
  }

  private static teamTotalGoals(
    selection: string,
    home: number,
    away: number,
  ): SettlementEvaluation {
    const match = selection.match(
      /^(HOME|AWAY)_(OVER|UNDER)[:_ -]?(\d+(?:\.\d+)?)$/,
    );

    if (!match) {
      return this.pending('INVALID_SELECTION');
    }

    const team = match[1];

    const side = match[2];

    const line = Number(match[3]);

    if (!Number.isFinite(line) || line < 0) {
      return this.pending('INVALID_SELECTION');
    }

    const goals = team === 'HOME' ? home : away;

    if (goals === line) {
      return this.evaluation(
        SettlementStatus.VOID,
        null,
        goals,
        `${team}_${side}_${line}_PUSH`,
      );
    }

    const won = side === 'OVER' ? goals > line : goals < line;

    return this.evaluation(
      won ? SettlementStatus.WON : SettlementStatus.LOST,
      won,
      goals,
      `${team}_${side}_${line}`,
    );
  }

  private static halfTimeResult(
    selection: string,
    score: SettlementScoreInput,
  ): SettlementEvaluation {
    if (score.halfTimeHomeScore === null || score.halfTimeAwayScore === null) {
      return this.pending('HALF_TIME_DATA_UNAVAILABLE');
    }

    const home = this.normalizeScore(score.halfTimeHomeScore);

    const away = this.normalizeScore(score.halfTimeAwayScore);

    const actual = this.scoreResult(home, away);

    const normalized = this.normalizeResult(selection);

    if (
      normalized !== 'HOME' &&
      normalized !== 'DRAW' &&
      normalized !== 'AWAY'
    ) {
      return this.pending('INVALID_SELECTION');
    }

    const won = normalized === actual;

    return this.evaluation(
      won ? SettlementStatus.WON : SettlementStatus.LOST,
      won,
      actual,
      actual,
    );
  }

  private static secondHalfResult(
    selection: string,
    score: SettlementScoreInput,
  ): SettlementEvaluation {
    if (score.halfTimeHomeScore === null || score.halfTimeAwayScore === null) {
      return this.pending('HALF_TIME_DATA_UNAVAILABLE');
    }

    const finalHome = this.normalizeScore(score.finalHomeScore);

    const finalAway = this.normalizeScore(score.finalAwayScore);

    const halfHome = this.normalizeScore(score.halfTimeHomeScore);

    const halfAway = this.normalizeScore(score.halfTimeAwayScore);

    const secondHome = Math.max(finalHome - halfHome, 0);

    const secondAway = Math.max(finalAway - halfAway, 0);

    const actual = this.scoreResult(secondHome, secondAway);

    const normalized = this.normalizeResult(selection);

    if (
      normalized !== 'HOME' &&
      normalized !== 'DRAW' &&
      normalized !== 'AWAY'
    ) {
      return this.pending('INVALID_SELECTION');
    }

    const won = normalized === actual;

    return this.evaluation(
      won ? SettlementStatus.WON : SettlementStatus.LOST,
      won,
      actual,
      actual,
    );
  }

  private static firstHalfGoals(
    selection: string,
    score: SettlementScoreInput,
  ): SettlementEvaluation {
    if (score.halfTimeHomeScore === null || score.halfTimeAwayScore === null) {
      return this.pending('HALF_TIME_DATA_UNAVAILABLE');
    }

    const total =
      this.normalizeScore(score.halfTimeHomeScore) +
      this.normalizeScore(score.halfTimeAwayScore);

    return this.evaluateGoalLine(selection, total);
  }

  private static secondHalfGoals(
    selection: string,
    score: SettlementScoreInput,
  ): SettlementEvaluation {
    if (score.halfTimeHomeScore === null || score.halfTimeAwayScore === null) {
      return this.pending('HALF_TIME_DATA_UNAVAILABLE');
    }

    const finalHome = this.normalizeScore(score.finalHomeScore);

    const finalAway = this.normalizeScore(score.finalAwayScore);

    const halfHome = this.normalizeScore(score.halfTimeHomeScore);

    const halfAway = this.normalizeScore(score.halfTimeAwayScore);

    const total =
      Math.max(finalHome - halfHome, 0) + Math.max(finalAway - halfAway, 0);

    return this.evaluateGoalLine(selection, total);
  }

  private static evaluateGoalLine(
    selection: string,
    totalGoals: number,
  ): SettlementEvaluation {
    return this.overUnder(selection, totalGoals);
  }

  private static asianHandicap(
    selection: string,
    home: number,
    away: number,
  ): SettlementEvaluation {
    const match = selection.match(
      /^(HOME|AWAY|1|2)[:_ -]?([+-]?\d+(?:\.\d+)?)$/,
    );

    if (!match) {
      return this.pending('INVALID_SELECTION');
    }

    const side = match[1] === 'HOME' || match[1] === '1' ? 'HOME' : 'AWAY';

    const line = Number(match[2]);

    if (!Number.isFinite(line)) {
      return this.pending('INVALID_SELECTION');
    }

    const adjusted = side === 'HOME' ? home + line - away : away + line - home;

    if (adjusted === 0) {
      return this.evaluation(
        SettlementStatus.VOID,
        null,
        adjusted,
        `${side}_${line}_PUSH`,
      );
    }

    const won = adjusted > 0;

    return this.evaluation(
      won ? SettlementStatus.WON : SettlementStatus.LOST,
      won,
      adjusted,
      `${side}_${line}_${won ? 'WIN' : 'LOSE'}`,
    );
  }

  private static europeanHandicap(
    selection: string,
    home: number,
    away: number,
  ): SettlementEvaluation {
    const match = selection.match(/^(HOME|DRAW|AWAY|1|X|2)[:_ -]?([+-]?\d+)$/);

    if (!match) {
      return this.pending('INVALID_SELECTION');
    }

    const side = this.normalizeResult(match[1]);

    const line = Number(match[2]);

    if (
      (side !== 'HOME' && side !== 'DRAW' && side !== 'AWAY') ||
      !Number.isFinite(line)
    ) {
      return this.pending('INVALID_SELECTION');
    }

    const adjusted = home - away + line;

    const actual = adjusted > 0 ? 'HOME' : adjusted < 0 ? 'AWAY' : 'DRAW';

    const won = side === actual;

    return this.evaluation(
      won ? SettlementStatus.WON : SettlementStatus.LOST,
      won,
      actual,
      actual,
    );
  }

  private static scoreResult(
    home: number,
    away: number,
  ): 'HOME' | 'DRAW' | 'AWAY' {
    if (home > away) {
      return 'HOME';
    }

    if (home < away) {
      return 'AWAY';
    }

    return 'DRAW';
  }

  private static normalizeResult(value: string): string {
    switch (value.trim().toUpperCase().replace(/\s+/g, '')) {
      case '1':
      case 'HOME':
      case 'HOMEWIN':
        return 'HOME';

      case 'X':
      case 'DRAW':
        return 'DRAW';

      case '2':
      case 'AWAY':
      case 'AWAYWIN':
        return 'AWAY';

      default:
        return value.trim().toUpperCase();
    }
  }

  private static normalizeSelection(value: string): string {
    return String(value ?? '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_');
  }

  private static normalizeScore(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.max(Math.floor(value), 0);
  }

  private static evaluation(
    status: SettlementStatus,
    actualOutcome: boolean | null,
    actualValue: unknown,
    resultLabel: string | null,
  ): SettlementEvaluation {
    return {
      status,
      actualOutcome,
      actualValue,
      resultLabel,
    };
  }

  private static pending(reason: string): SettlementEvaluation {
    return {
      status: SettlementStatus.PENDING,
      actualOutcome: null,
      actualValue: null,
      resultLabel: reason,
    };
  }
}
