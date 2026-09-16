// src/predictions-engine/utils/market-probability.util.ts

import { PredictionMarket } from '../../enums/prediction-market.enum';

import { GoalModelResult } from './raw-goal-model.util';

export interface MarketProbabilityResult {
  probability: number;

  pushProbability?: number;

  winProbability?: number;

  lossProbability?: number;

  source:
    | 'COMMON_SCORE_MATRIX'
    | 'HALF_SCORE_MATRIX'
    | 'SECOND_HALF_SCORE_MATRIX';

  scoreMatrixCoherent: boolean;
}

export class MarketProbabilityUtil {
  static calculate(
    goalModel: GoalModelResult,
    market: PredictionMarket,
    selection: string,
  ): MarketProbabilityResult {
    switch (market) {
      case PredictionMarket.MATCH_RESULT:
        return this.calculateMatchResult(goalModel, selection);

      case PredictionMarket.OVER_UNDER:
        return this.calculateOverUnder(goalModel, selection);

      case PredictionMarket.BOTH_TEAMS_TO_SCORE:
        return this.calculateBtts(goalModel, selection);

      case PredictionMarket.GOAL_RANGE:
        return this.calculateGoalRange(goalModel, selection);

      case PredictionMarket.TEAM_TOTAL_GOALS:
        return this.calculateTeamTotal(goalModel, selection);

      case PredictionMarket.HALF_TIME_RESULT:
        return this.calculatePeriodResult(
          goalModel.halfTime,
          selection,
          'HALF_SCORE_MATRIX',
        );

      case PredictionMarket.SECOND_HALF_RESULT:
        return this.calculatePeriodResult(
          goalModel.secondHalf,
          selection,
          'SECOND_HALF_SCORE_MATRIX',
        );

      case PredictionMarket.FIRST_HALF_GOALS:
        return this.calculatePeriodGoals(
          goalModel.halfTime.totalGoals,
          selection,
          'HALF_SCORE_MATRIX',
        );

      case PredictionMarket.SECOND_HALF_GOALS:
        return this.calculatePeriodGoals(
          goalModel.secondHalf.totalGoals,
          selection,
          'SECOND_HALF_SCORE_MATRIX',
        );

      case PredictionMarket.ASIAN_HANDICAP:
        return this.calculateAsianHandicap(goalModel, selection);

      case PredictionMarket.EUROPEAN_HANDICAP:
        return this.calculateEuropeanHandicap(goalModel, selection);

      default:
        return {
          probability: 0,
          source: 'COMMON_SCORE_MATRIX',
          scoreMatrixCoherent: false,
        };
    }
  }

  private static calculateMatchResult(
    goalModel: GoalModelResult,
    selection: string,
  ): MarketProbabilityResult {
    const normalized = this.normalizeThreeWay(
      goalModel.homeWin,
      goalModel.draw,
      goalModel.awayWin,
    );

    switch (this.normalizeSelection(selection)) {
      case 'HOME':
        return {
          probability: normalized.home,
          source: 'COMMON_SCORE_MATRIX',
          scoreMatrixCoherent: true,
        };

      case 'DRAW':
        return {
          probability: normalized.draw,
          source: 'COMMON_SCORE_MATRIX',
          scoreMatrixCoherent: true,
        };

      case 'AWAY':
        return {
          probability: normalized.away,
          source: 'COMMON_SCORE_MATRIX',
          scoreMatrixCoherent: true,
        };

      default:
        return {
          probability: 0,
          source: 'COMMON_SCORE_MATRIX',
          scoreMatrixCoherent: false,
        };
    }
  }

  private static calculateOverUnder(
    goalModel: GoalModelResult,
    selection: string,
  ): MarketProbabilityResult {
    const match = selection
      .trim()
      .toUpperCase()
      .match(/^(OVER|UNDER)[_: -]?(\d+(?:\.\d+)?)$/);

    if (!match) {
      return {
        probability: 0,
        source: 'COMMON_SCORE_MATRIX',
        scoreMatrixCoherent: false,
      };
    }

    const type = match[1];
    const line = Number(match[2]);

    if (!Number.isFinite(line) || line < 0) {
      return {
        probability: 0,
        source: 'COMMON_SCORE_MATRIX',
        scoreMatrixCoherent: false,
      };
    }

    const over = this.probabilityTotalOver(
      goalModel.totalGoalProbabilities,
      line,
    );

    return {
      probability: type === 'OVER' ? over : this.clamp(1 - over),
      source: 'COMMON_SCORE_MATRIX',
      scoreMatrixCoherent: true,
    };
  }

  private static calculateBtts(
    goalModel: GoalModelResult,
    selection: string,
  ): MarketProbabilityResult {
    let yes = 0;

    for (let homeGoals = 0; homeGoals < goalModel.matrix.length; homeGoals++) {
      for (
        let awayGoals = 0;
        awayGoals < (goalModel.matrix[homeGoals]?.length ?? 0);
        awayGoals++
      ) {
        if (homeGoals > 0 && awayGoals > 0) {
          yes += goalModel.matrix[homeGoals]?.[awayGoals] ?? 0;
        }
      }
    }

    yes = this.clamp(yes);

    switch (this.normalizeSelection(selection)) {
      case 'YES':
        return {
          probability: yes,
          source: 'COMMON_SCORE_MATRIX',
          scoreMatrixCoherent: true,
        };

      case 'NO':
        return {
          probability: this.clamp(1 - yes),
          source: 'COMMON_SCORE_MATRIX',
          scoreMatrixCoherent: true,
        };

      default:
        return {
          probability: 0,
          source: 'COMMON_SCORE_MATRIX',
          scoreMatrixCoherent: false,
        };
    }
  }

  private static calculateGoalRange(
    goalModel: GoalModelResult,
    selection: string,
  ): MarketProbabilityResult {
    const total = goalModel.totalGoalProbabilities;

    const normalized = selection.trim().toUpperCase().replace(/\s+/g, '');

    const prefixed = normalized.match(
      /^(?:GOALS?|TOTAL_GOALS?|TOTALGOALS?)[_: -]?(.+)$/,
    );

    const value = prefixed ? prefixed[1] : normalized;

    if (/^\d+$/.test(value)) {
      const goals = Number(value);

      return {
        probability: this.probabilityExactly(total, goals),
        source: 'COMMON_SCORE_MATRIX',
        scoreMatrixCoherent: true,
      };
    }

    const atLeastMatch = value.match(/^(\d+)\+$/);

    if (atLeastMatch) {
      const minimum = Number(atLeastMatch[1]);

      return {
        probability: this.atLeast(total, minimum),
        source: 'COMMON_SCORE_MATRIX',
        scoreMatrixCoherent: true,
      };
    }

    const rangeMatch = value.match(/^(\d+)-(\d+)$/);

    if (!rangeMatch) {
      return {
        probability: 0,
        source: 'COMMON_SCORE_MATRIX',
        scoreMatrixCoherent: false,
      };
    }

    const minimum = Number(rangeMatch[1]);
    const maximum = Number(rangeMatch[2]);

    if (
      !Number.isFinite(minimum) ||
      !Number.isFinite(maximum) ||
      minimum < 0 ||
      maximum < minimum
    ) {
      return {
        probability: 0,
        source: 'COMMON_SCORE_MATRIX',
        scoreMatrixCoherent: false,
      };
    }

    return {
      probability: this.rangeSum(total, minimum, maximum),
      source: 'COMMON_SCORE_MATRIX',
      scoreMatrixCoherent: true,
    };
  }

  private static calculateTeamTotal(
    goalModel: GoalModelResult,
    selection: string,
  ): MarketProbabilityResult {
    const match = selection
      .trim()
      .toUpperCase()
      .match(/^(HOME|AWAY)[_: -]?(OVER|UNDER)[_: -]?(\d+(?:\.\d+)?)$/);

    if (!match) {
      return {
        probability: 0,
        source: 'COMMON_SCORE_MATRIX',
        scoreMatrixCoherent: false,
      };
    }

    const side = match[1];
    const type = match[2];
    const line = Number(match[3]);

    if (!Number.isFinite(line) || line < 0) {
      return {
        probability: 0,
        source: 'COMMON_SCORE_MATRIX',
        scoreMatrixCoherent: false,
      };
    }

    const probabilities =
      side === 'HOME'
        ? goalModel.homeGoalProbabilities
        : goalModel.awayGoalProbabilities;

    const over = this.probabilityTotalOver(probabilities, line);

    return {
      probability: type === 'OVER' ? over : this.clamp(1 - over),
      source: 'COMMON_SCORE_MATRIX',
      scoreMatrixCoherent: true,
    };
  }

  private static calculatePeriodResult(
    period: {
      homeWin: number;
      draw: number;
      awayWin: number;
    },
    selection: string,
    source: 'HALF_SCORE_MATRIX' | 'SECOND_HALF_SCORE_MATRIX',
  ): MarketProbabilityResult {
    const normalized = this.normalizeThreeWay(
      period.homeWin,
      period.draw,
      period.awayWin,
    );

    switch (this.normalizeSelection(selection)) {
      case 'HOME':
        return {
          probability: normalized.home,
          source,
          scoreMatrixCoherent: true,
        };

      case 'DRAW':
        return {
          probability: normalized.draw,
          source,
          scoreMatrixCoherent: true,
        };

      case 'AWAY':
        return {
          probability: normalized.away,
          source,
          scoreMatrixCoherent: true,
        };

      default:
        return {
          probability: 0,
          source,
          scoreMatrixCoherent: false,
        };
    }
  }

  private static calculatePeriodGoals(
    probabilities: number[],
    selection: string,
    source: 'HALF_SCORE_MATRIX' | 'SECOND_HALF_SCORE_MATRIX',
  ): MarketProbabilityResult {
    const match = selection
      .trim()
      .toUpperCase()
      .match(/^(OVER|UNDER)[_: -]?(\d+(?:\.\d+)?)$/);

    if (!match) {
      return {
        probability: 0,
        source,
        scoreMatrixCoherent: false,
      };
    }

    const line = Number(match[2]);

    if (!Number.isFinite(line) || line < 0) {
      return {
        probability: 0,
        source,
        scoreMatrixCoherent: false,
      };
    }

    const over = this.probabilityTotalOver(probabilities, line);

    return {
      probability: match[1] === 'OVER' ? over : this.clamp(1 - over),
      source,
      scoreMatrixCoherent: true,
    };
  }

  private static calculateAsianHandicap(
    goalModel: GoalModelResult,
    selection: string,
  ): MarketProbabilityResult {
    const match = selection
      .trim()
      .toUpperCase()
      .match(/^(HOME|AWAY|1|2)[_: -]?([+-]?\d+(?:\.\d+)?)$/);

    if (!match) {
      return {
        probability: 0,
        source: 'COMMON_SCORE_MATRIX',
        scoreMatrixCoherent: false,
      };
    }

    const side = match[1] === 'HOME' || match[1] === '1' ? 'HOME' : 'AWAY';

    const line = Number(match[2]);

    if (!Number.isFinite(line)) {
      return {
        probability: 0,
        source: 'COMMON_SCORE_MATRIX',
        scoreMatrixCoherent: false,
      };
    }

    const outcome = this.calculateAsianSettlement(goalModel.matrix, side, line);

    return {
      probability: this.normalizeAsianProbability(
        outcome.win,
        outcome.push,
        outcome.loss,
      ),
      winProbability: outcome.win,
      pushProbability: outcome.push,
      lossProbability: outcome.loss,
      source: 'COMMON_SCORE_MATRIX',
      scoreMatrixCoherent: true,
    };
  }

  private static calculateEuropeanHandicap(
    goalModel: GoalModelResult,
    selection: string,
  ): MarketProbabilityResult {
    const match = selection
      .trim()
      .toUpperCase()
      .match(/^(HOME|DRAW|AWAY|1|X|2)[_: -]?([+-]?\d+(?:\.\d+)?)$/);

    if (!match) {
      return {
        probability: 0,
        source: 'COMMON_SCORE_MATRIX',
        scoreMatrixCoherent: false,
      };
    }

    const side =
      match[1] === 'HOME' || match[1] === '1'
        ? 'HOME'
        : match[1] === 'DRAW' || match[1] === 'X'
          ? 'DRAW'
          : 'AWAY';

    const line = Number(match[2]);

    if (!Number.isFinite(line)) {
      return {
        probability: 0,
        source: 'COMMON_SCORE_MATRIX',
        scoreMatrixCoherent: false,
      };
    }

    let probability = 0;

    for (let homeGoals = 0; homeGoals < goalModel.matrix.length; homeGoals++) {
      const row = goalModel.matrix[homeGoals] ?? [];

      for (let awayGoals = 0; awayGoals < row.length; awayGoals++) {
        const matrixProbability = row[awayGoals] ?? 0;
        const adjusted = homeGoals - awayGoals + line;

        if (side === 'HOME' && adjusted > 0) {
          probability += matrixProbability;
        }

        if (side === 'DRAW' && adjusted === 0) {
          probability += matrixProbability;
        }

        if (side === 'AWAY' && adjusted < 0) {
          probability += matrixProbability;
        }
      }
    }

    return {
      probability: this.clamp(probability),
      source: 'COMMON_SCORE_MATRIX',
      scoreMatrixCoherent: true,
    };
  }

  private static calculateAsianSettlement(
    matrix: number[][],
    side: 'HOME' | 'AWAY',
    line: number,
  ): {
    win: number;
    push: number;
    loss: number;
  } {
    /*
     * Standard Asian result settlement for whole/half lines.
     *
     * Quarter lines are split across the two adjacent Asian
     * lines and averaged.
     */
    if (this.isQuarterLine(line)) {
      const lower = Math.floor(line * 2) / 2;
      const upper = Math.ceil(line * 2) / 2;

      const first = this.calculateAsianSettlement(matrix, side, lower);

      const second = this.calculateAsianSettlement(matrix, side, upper);

      return {
        win: (first.win + second.win) / 2,
        push: (first.push + second.push) / 2,
        loss: (first.loss + second.loss) / 2,
      };
    }

    let win = 0;
    let push = 0;
    let loss = 0;

    for (let homeGoals = 0; homeGoals < matrix.length; homeGoals++) {
      const row = matrix[homeGoals] ?? [];

      for (let awayGoals = 0; awayGoals < row.length; awayGoals++) {
        const probability = row[awayGoals] ?? 0;
        const margin = homeGoals - awayGoals;

        const adjusted = side === 'HOME' ? margin + line : -margin + line;

        if (adjusted > 0) {
          win += probability;
        } else if (adjusted < 0) {
          loss += probability;
        } else {
          push += probability;
        }
      }
    }

    return {
      win: this.clamp(win),
      push: this.clamp(push),
      loss: this.clamp(loss),
    };
  }

  private static normalizeAsianProbability(
    win: number,
    push: number,
    loss: number,
  ): number {
    const safeWin = this.clamp(win);
    const safePush = this.clamp(push);
    const safeLoss = this.clamp(loss);

    const total = safeWin + safePush + safeLoss;

    if (total <= 0) {
      return 0;
    }

    return this.clamp((safeWin + safePush * 0.5) / total);
  }

  private static probabilityTotalOver(
    probabilities: number[],
    line: number,
  ): number {
    let result = 0;

    for (let goals = 0; goals < probabilities.length; goals++) {
      if (goals > line) {
        result += probabilities[goals] ?? 0;
      }
    }

    return this.clamp(result);
  }

  private static probabilityExactly(
    probabilities: number[],
    goals: number,
  ): number {
    if (goals < 0 || goals >= probabilities.length) {
      return 0;
    }

    return this.clamp(probabilities[goals] ?? 0);
  }

  private static rangeSum(
    probabilities: number[],
    minimum: number,
    maximum: number,
  ): number {
    let result = 0;

    for (
      let goals = Math.max(0, minimum);
      goals <= maximum && goals < probabilities.length;
      goals++
    ) {
      result += probabilities[goals] ?? 0;
    }

    return this.clamp(result);
  }

  private static atLeast(probabilities: number[], minimum: number): number {
    if (minimum <= 0) {
      return 1;
    }

    let result = 0;

    for (let goals = minimum; goals < probabilities.length; goals++) {
      result += probabilities[goals] ?? 0;
    }

    return this.clamp(result);
  }

  private static normalizeThreeWay(
    home: number,
    draw: number,
    away: number,
  ): {
    home: number;
    draw: number;
    away: number;
  } {
    const safeHome = this.clamp(home);
    const safeDraw = this.clamp(draw);
    const safeAway = this.clamp(away);

    const total = safeHome + safeDraw + safeAway;

    if (total <= 0) {
      return {
        home: 0,
        draw: 0,
        away: 0,
      };
    }

    return {
      home: safeHome / total,
      draw: safeDraw / total,
      away: safeAway / total,
    };
  }

  private static normalizeSelection(selection: string): string {
    const normalized = selection.trim().toUpperCase();

    switch (normalized) {
      case '1':
      case 'HOME':
      case 'HOME_WIN':
        return 'HOME';

      case 'X':
      case 'DRAW':
        return 'DRAW';

      case '2':
      case 'AWAY':
      case 'AWAY_WIN':
        return 'AWAY';

      default:
        return normalized;
    }
  }

  private static isQuarterLine(line: number): boolean {
    const doubled = line * 2;

    return Math.abs(doubled - Math.round(doubled)) > 0.000001;
  }

  private static clamp(value: number, minimum = 0, maximum = 1): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
