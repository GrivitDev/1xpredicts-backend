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

      case PredictionMarket.BTTS_GOALS:
        return this.bttsGoals(selection, finalHome, finalAway, totalGoals);

      case PredictionMarket.GOAL_RANGE:
        return this.goalRange(selection, totalGoals);

      case PredictionMarket.TEAM_TOTAL_GOALS:
        return this.teamTotalGoals(selection, finalHome, finalAway);

      case PredictionMarket.EXACT_GOALS:
        return this.exactGoals(selection, finalHome, finalAway, totalGoals);

      case PredictionMarket.CLEAN_SHEET:
        return this.cleanSheet(selection, finalHome, finalAway);

      case PredictionMarket.HALF_TIME_RESULT:
        return this.halfTimeResult(selection, score);

      case PredictionMarket.SECOND_HALF_RESULT:
        return this.secondHalfResult(selection, score);

      case PredictionMarket.HALF_TIME_FULL_TIME:
        return this.halfTimeFullTime(selection, score);

      case PredictionMarket.FIRST_HALF_GOALS:
        return this.halfGoals(selection, score, true);

      case PredictionMarket.SECOND_HALF_GOALS:
        return this.halfGoals(selection, score, false);

      case PredictionMarket.FIRST_TO_SCORE:
        /*
         * Final scores alone cannot establish scoring order.
         * This market remains pending until event-sequence
         * data is available.
         */
        return {
          status: SettlementStatus.PENDING,
          actualOutcome: null,
          actualValue: null,
          resultLabel: null,
        };

      case PredictionMarket.ASIAN_HANDICAP:
        return this.asianHandicap(selection, finalHome, finalAway);

      case PredictionMarket.EUROPEAN_HANDICAP:
        return this.europeanHandicap(selection, finalHome, finalAway);

      default:
        return {
          status: SettlementStatus.PENDING,
          actualOutcome: null,
          actualValue: null,
          resultLabel: null,
        };
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

    const actual =
      result === 'HOME' || result === 'DRAW'
        ? 'HOME_DRAW'
        : result === 'AWAY' || result === 'DRAW'
          ? 'DRAW_AWAY'
          : 'HOME_AWAY';

    let won = false;

    switch (normalized) {
      case '1X':
      case 'HOME_DRAW':
        won = result === 'HOME' || result === 'DRAW';
        break;

      case '12':
      case 'HOME_AWAY':
        won = result === 'HOME' || result === 'AWAY';
        break;

      case 'X2':
      case 'DRAW_AWAY':
        won = result === 'DRAW' || result === 'AWAY';
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

    const won = side === 'OVER' ? totalGoals > line : totalGoals < line;

    const pushed = totalGoals === line;

    if (pushed) {
      return this.void(`${totalGoals}`);
    }

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

    const expectsYes =
      normalized === 'YES' || normalized === 'BTTS_YES' || normalized === '1';

    const expectsNo =
      normalized === 'NO' || normalized === 'BTTS_NO' || normalized === '0';

    if (!expectsYes && !expectsNo) {
      return this.pending();
    }

    const won = expectsYes ? yes : !yes;

    return {
      status: won ? SettlementStatus.WON : SettlementStatus.LOST,

      actualOutcome: won,

      actualValue: yes,

      resultLabel: yes ? 'YES' : 'NO',
    };
  }

  private static bttsGoals(
    selection: string,
    home: number,
    away: number,
    totalGoals: number,
  ): SettlementEvaluation {
    const normalized = selection.trim().toUpperCase();

    const match = normalized.match(/^(YES|NO)(?:[:_-](\d+))?$/);

    if (!match) {
      return this.pending();
    }

    const expected = match[1];

    const minimum = Number(match[2] ?? 0);

    const yes = home > 0 && away > 0 && totalGoals >= minimum;

    const won = expected === 'YES' ? yes : !yes;

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
      return this.pending();
    }

    const minimum = Number(match[1] ?? match[3]);

    const maximum = Number(match[2] ?? match[4]);

    if (minimum > maximum) {
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

    const goals = team === 'HOME' ? home : away;

    const won = side === 'OVER' ? goals > line : goals < line;

    if (goals === line) {
      return this.void(`${goals}`);
    }

    return {
      status: won ? SettlementStatus.WON : SettlementStatus.LOST,

      actualOutcome: won,

      actualValue: goals,

      resultLabel: `${team}_${side}_${line}`,
    };
  }

  private static exactGoals(
    selection: string,
    home: number,
    away: number,
    totalGoals: number,
  ): SettlementEvaluation {
    const normalized = selection.trim().toUpperCase();

    const scoreMatch = normalized.match(/^(\d+)[-:](\d+)$/);

    if (scoreMatch) {
      const expectedHome = Number(scoreMatch[1]);

      const expectedAway = Number(scoreMatch[2]);

      const won = home === expectedHome && away === expectedAway;

      return {
        status: won ? SettlementStatus.WON : SettlementStatus.LOST,

        actualOutcome: won,

        actualValue: {
          home,
          away,
          total: totalGoals,
        },

        resultLabel: `${home}-${away}`,
      };
    }

    const teamMatch = normalized.match(/^(HOME|AWAY)[:_ -]?(\d+)$/);

    if (!teamMatch) {
      return this.pending();
    }

    const expected = Number(teamMatch[2]);

    const actual = teamMatch[1] === 'HOME' ? home : away;

    const won = actual === expected;

    return {
      status: won ? SettlementStatus.WON : SettlementStatus.LOST,

      actualOutcome: won,

      actualValue: actual,

      resultLabel: `${teamMatch[1]}_${actual}`,
    };
  }

  private static cleanSheet(
    selection: string,
    home: number,
    away: number,
  ): SettlementEvaluation {
    const normalized = selection.trim().toUpperCase();

    let won: boolean;

    if (
      normalized === 'HOME' ||
      normalized === 'HOME_YES' ||
      normalized === 'HOME_CLEAN_SHEET'
    ) {
      won = away === 0;
    } else if (
      normalized === 'AWAY' ||
      normalized === 'AWAY_YES' ||
      normalized === 'AWAY_CLEAN_SHEET'
    ) {
      won = home === 0;
    } else if (normalized === 'HOME_NO' || normalized === 'AWAY_SCORE') {
      won = away > 0;
    } else if (normalized === 'AWAY_NO' || normalized === 'HOME_SCORE') {
      won = home > 0;
    } else {
      return this.pending();
    }

    return {
      status: won ? SettlementStatus.WON : SettlementStatus.LOST,

      actualOutcome: won,

      actualValue: {
        home,
        away,
      },

      resultLabel: `${home}-${away}`,
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

  private static halfTimeFullTime(
    selection: string,
    score: SettlementScoreInput,
  ): SettlementEvaluation {
    if (score.halfTimeHomeScore === null || score.halfTimeAwayScore === null) {
      return this.pending();
    }

    const firstHalf =
      score.halfTimeHomeScore > score.halfTimeAwayScore
        ? 'HOME'
        : score.halfTimeHomeScore < score.halfTimeAwayScore
          ? 'AWAY'
          : 'DRAW';

    const fullTime =
      score.finalHomeScore > score.finalAwayScore
        ? 'HOME'
        : score.finalHomeScore < score.finalAwayScore
          ? 'AWAY'
          : 'DRAW';

    const actual = `${firstHalf}_${fullTime}`;

    const won = selection.trim().toUpperCase().replace(/\s+/g, '') === actual;

    return {
      status: won ? SettlementStatus.WON : SettlementStatus.LOST,

      actualOutcome: won,

      actualValue: actual,

      resultLabel: actual,
    };
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
