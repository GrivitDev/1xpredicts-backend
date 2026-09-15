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
    const finalHome = Math.max(Math.floor(score.finalHomeScore), 0);

    const finalAway = Math.max(Math.floor(score.finalAwayScore), 0);

    const totalGoals = finalHome + finalAway;

    switch (market) {
      case PredictionMarket.MATCH_RESULT:
        return this.matchResult(selection, finalHome, finalAway);

      case PredictionMarket.DOUBLE_CHANCE:
        return this.doubleChance(selection, finalHome, finalAway);

      case PredictionMarket.DRAW_NO_BET:
        return this.drawNoBet(selection, finalHome, finalAway);

      case PredictionMarket.OVER_UNDER:
        return this.overUnder(selection, totalGoals);

      case PredictionMarket.BOTH_TEAMS_TO_SCORE:
        return this.btts(selection, finalHome, finalAway);

      case PredictionMarket.GOAL_RANGE:
        return this.goalRange(selection, totalGoals);

      case PredictionMarket.TEAM_TOTAL_GOALS:
        return this.teamTotalGoals(selection, finalHome, finalAway);

      case PredictionMarket.HALF_TIME_RESULT:
        return this.halfTimeResult(selection, score);

      case PredictionMarket.SECOND_HALF_RESULT:
        return this.secondHalfResult(selection, score);

      case PredictionMarket.FIRST_HALF_GOALS:
        return this.halfGoals(selection, score, true);

      case PredictionMarket.SECOND_HALF_GOALS:
        return this.halfGoals(selection, score, false);

      case PredictionMarket.ASIAN_HANDICAP:
        return this.asianHandicap(selection, finalHome, finalAway);

      case PredictionMarket.EUROPEAN_HANDICAP:
        return this.europeanHandicap(selection, finalHome, finalAway);

      default:
        return this.pending();
    }
  }

  private static matchResult(
    selection: string,
    home: number,
    away: number,
  ): SettlementEvaluation {
    const result = home > away ? 'HOME' : home < away ? 'AWAY' : 'DRAW';

    return this.binary(selection, result);
  }

  private static doubleChance(
    selection: string,
    home: number,
    away: number,
  ): SettlementEvaluation {
    const result = home > away ? 'HOME' : home < away ? 'AWAY' : 'DRAW';

    const normalized = selection.trim().toUpperCase();

    let won: boolean;

    let actual: string;

    switch (normalized) {
      case '1X':
      case 'HOME_DRAW':
      case 'HOME_OR_DRAW':
        won = result === 'HOME' || result === 'DRAW';

        actual = result === 'AWAY' ? 'AWAY' : 'HOME_DRAW';

        break;

      case 'X2':
      case 'DRAW_AWAY':
      case 'AWAY_OR_DRAW':
        won = result === 'DRAW' || result === 'AWAY';

        actual = result === 'HOME' ? 'HOME' : 'DRAW_AWAY';

        break;

      case '12':
      case 'HOME_AWAY':
      case 'HOME_OR_AWAY':
        won = result === 'HOME' || result === 'AWAY';

        actual = result === 'DRAW' ? 'DRAW' : 'HOME_AWAY';

        break;

      default:
        return this.pending();
    }

    return {
      status: won ? SettlementStatus.WON : SettlementStatus.LOST,

      actualOutcome: won,

      actualValue: actual,

      resultLabel: result,
    };
  }

  private static drawNoBet(
    selection: string,
    home: number,
    away: number,
  ): SettlementEvaluation {
    if (home === away) {
      return this.void('DRAW');
    }

    const actual = home > away ? 'HOME' : 'AWAY';

    return this.binary(selection, actual);
  }

  private static overUnder(
    selection: string,
    totalGoals: number,
  ): SettlementEvaluation {
    const parsed = selection
      .trim()
      .toUpperCase()
      .match(/^(OVER|UNDER)[:_ -]?(\d+(?:\.\d+)?)$/);

    if (!parsed) {
      return this.pending();
    }

    const side = parsed[1];

    const line = Number(parsed[2]);

    if (!Number.isFinite(line)) {
      return this.pending();
    }

    const pushed = totalGoals === line;

    if (pushed) {
      return this.void(`${totalGoals}`);
    }

    const won = side === 'OVER' ? totalGoals > line : totalGoals < line;

    return {
      status: won ? SettlementStatus.WON : SettlementStatus.LOST,

      actualOutcome: won,

      actualValue: totalGoals,

      resultLabel: `${side}_${line}`,
    };
  }

  private static btts(
    selection: string,
    home: number,
    away: number,
  ): SettlementEvaluation {
    const yes = home > 0 && away > 0;

    const normalized = selection.trim().toUpperCase();

    let won: boolean;

    if (
      normalized === 'YES' ||
      normalized === 'BTTS_YES' ||
      normalized === '1'
    ) {
      won = yes;
    } else if (
      normalized === 'NO' ||
      normalized === 'BTTS_NO' ||
      normalized === '0'
    ) {
      won = !yes;
    } else {
      return this.pending();
    }

    return {
      status: won ? SettlementStatus.WON : SettlementStatus.LOST,

      actualOutcome: won,

      actualValue: yes,

      resultLabel: yes ? 'YES' : 'NO',
    };
  }

  private static goalRange(
    selection: string,
    totalGoals: number,
  ): SettlementEvaluation {
    const normalized = selection.trim().toUpperCase().replace(/\s+/g, '');

    const match = normalized.match(
      /^(?:GOALS?|TOTAL_?GOALS?)[_: -]?(\d+)[_-](\d+)$|^(\d+)[_-](\d+)$/,
    );

    if (!match) {
      const plusMatch = normalized.match(
        /^(?:GOALS?|TOTAL_?GOALS?)[_: -]?(\d+)\+$/i,
      );

      if (!plusMatch) {
        return this.pending();
      }

      const minimum = Number(plusMatch[1]);

      if (!Number.isFinite(minimum) || minimum < 0) {
        return this.pending();
      }

      const won = totalGoals >= minimum;

      return {
        status: won ? SettlementStatus.WON : SettlementStatus.LOST,

        actualOutcome: won,

        actualValue: totalGoals,

        resultLabel: `${minimum}+`,
      };
    }

    const minimum = Number(match[1] ?? match[3]);

    const maximum = Number(match[2] ?? match[4]);

    if (
      !Number.isFinite(minimum) ||
      !Number.isFinite(maximum) ||
      minimum < 0 ||
      maximum < minimum
    ) {
      return this.pending();
    }

    const won = totalGoals >= minimum && totalGoals <= maximum;

    return {
      status: won ? SettlementStatus.WON : SettlementStatus.LOST,

      actualOutcome: won,

      actualValue: totalGoals,

      resultLabel: `${minimum}-${maximum}`,
    };
  }

  private static teamTotalGoals(
    selection: string,
    home: number,
    away: number,
  ): SettlementEvaluation {
    const match = selection
      .trim()
      .toUpperCase()
      .match(/^(HOME|AWAY)_(OVER|UNDER)[:_ -]?(\d+(?:\.\d+)?)$/);

    if (!match) {
      return this.pending();
    }

    const team = match[1];

    const side = match[2];

    const line = Number(match[3]);

    if (!Number.isFinite(line)) {
      return this.pending();
    }

    const goals = team === 'HOME' ? home : away;

    if (goals === line) {
      return this.void(`${goals}`);
    }

    const won = side === 'OVER' ? goals > line : goals < line;

    return {
      status: won ? SettlementStatus.WON : SettlementStatus.LOST,

      actualOutcome: won,

      actualValue: goals,

      resultLabel: `${team}_${side}_${line}`,
    };
  }

  private static halfTimeResult(
    selection: string,
    score: SettlementScoreInput,
  ): SettlementEvaluation {
    if (score.halfTimeHomeScore === null || score.halfTimeAwayScore === null) {
      return this.pending();
    }

    const result =
      score.halfTimeHomeScore > score.halfTimeAwayScore
        ? 'HOME'
        : score.halfTimeHomeScore < score.halfTimeAwayScore
          ? 'AWAY'
          : 'DRAW';

    return this.binary(selection, result);
  }

  private static secondHalfResult(
    selection: string,
    score: SettlementScoreInput,
  ): SettlementEvaluation {
    if (score.halfTimeHomeScore === null || score.halfTimeAwayScore === null) {
      return this.pending();
    }

    const homeSecondHalf = score.finalHomeScore - score.halfTimeHomeScore;

    const awaySecondHalf = score.finalAwayScore - score.halfTimeAwayScore;

    const result =
      homeSecondHalf > awaySecondHalf
        ? 'HOME'
        : homeSecondHalf < awaySecondHalf
          ? 'AWAY'
          : 'DRAW';

    return this.binary(selection, result);
  }

  private static halfGoals(
    selection: string,
    score: SettlementScoreInput,
    firstHalf: boolean,
  ): SettlementEvaluation {
    if (score.halfTimeHomeScore === null || score.halfTimeAwayScore === null) {
      return this.pending();
    }

    const total = firstHalf
      ? score.halfTimeHomeScore + score.halfTimeAwayScore
      : score.finalHomeScore -
        score.halfTimeHomeScore +
        score.finalAwayScore -
        score.halfTimeAwayScore;

    return this.overUnder(selection, total);
  }

  private static asianHandicap(
    selection: string,
    home: number,
    away: number,
  ): SettlementEvaluation {
    const match = selection
      .trim()
      .toUpperCase()
      .match(/^(?:HOME|1)[:_ -]?([+-]?\d+(?:\.\d+)?)$/);

    if (!match) {
      return this.pending();
    }

    const line = Number(match[1]);

    if (!Number.isFinite(line)) {
      return this.pending();
    }

    const adjusted = home + line - away;

    if (adjusted === 0) {
      return this.void(`${home}-${away}`);
    }

    const won = adjusted > 0;

    return {
      status: won ? SettlementStatus.WON : SettlementStatus.LOST,

      actualOutcome: won,

      actualValue: adjusted,

      resultLabel: `${home}-${away}`,
    };
  }

  private static europeanHandicap(
    selection: string,
    home: number,
    away: number,
  ): SettlementEvaluation {
    const match = selection
      .trim()
      .toUpperCase()
      .match(/^(HOME|DRAW|AWAY)[:_ -]?([+-]?\d+(?:\.\d+)?)$/);

    if (!match) {
      return this.pending();
    }

    const outcome = match[1];

    const line = Number(match[2]);

    if (!Number.isFinite(line)) {
      return this.pending();
    }

    const adjusted = home + line - away;

    const actual = adjusted > 0 ? 'HOME' : adjusted < 0 ? 'AWAY' : 'DRAW';

    const won = actual === outcome;

    return {
      status: won ? SettlementStatus.WON : SettlementStatus.LOST,

      actualOutcome: won,

      actualValue: actual,

      resultLabel: actual,
    };
  }

  private static binary(
    selection: string,
    actual: string,
  ): SettlementEvaluation {
    const normalized = selection.trim().toUpperCase();

    const won = this.normalizeResult(normalized) === actual;

    return {
      status: won ? SettlementStatus.WON : SettlementStatus.LOST,

      actualOutcome: won,

      actualValue: actual,

      resultLabel: actual,
    };
  }

  private static normalizeResult(value: string): string {
    switch (value) {
      case '1':
      case 'HOME':
      case 'HOME_WIN':
        return 'HOME';

      case '2':
      case 'AWAY':
      case 'AWAY_WIN':
        return 'AWAY';

      case 'X':
      case 'DRAW':
        return 'DRAW';

      default:
        return value;
    }
  }

  private static void(actualValue: unknown): SettlementEvaluation {
    return {
      status: SettlementStatus.VOID,

      actualOutcome: null,

      actualValue,

      resultLabel: String(actualValue),
    };
  }

  private static pending(): SettlementEvaluation {
    return {
      status: SettlementStatus.PENDING,

      actualOutcome: null,

      actualValue: null,

      resultLabel: null,
    };
  }
}
