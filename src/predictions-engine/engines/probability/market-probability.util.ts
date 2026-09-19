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

      case PredictionMarket.DOUBLE_CHANCE:
        return this.calculateDoubleChance(goalModel, selection);

      case PredictionMarket.DRAW_NO_BET:
        return this.calculateDrawNoBet(goalModel, selection);

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
          goalModel.halfTime,
          selection,
          'HALF_SCORE_MATRIX',
        );

      case PredictionMarket.SECOND_HALF_GOALS:
        return this.calculatePeriodGoals(
          goalModel.secondHalf,
          selection,
          'SECOND_HALF_SCORE_MATRIX',
        );

      case PredictionMarket.ASIAN_HANDICAP:
        return this.calculateAsianHandicap(goalModel, selection);

      case PredictionMarket.EUROPEAN_HANDICAP:
        return this.calculateEuropeanHandicap(goalModel, selection);

      default:
        return this.unavailable('COMMON_SCORE_MATRIX');
    }
  }

  private static calculateMatchResult(
    goalModel: GoalModelResult,
    selection: string,
  ): MarketProbabilityResult {
    if (!this.matrixIsCoherent(goalModel.matrix)) {
      return this.unavailable('COMMON_SCORE_MATRIX');
    }

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
        return this.unavailable('COMMON_SCORE_MATRIX');
    }
  }

  private static calculateDoubleChance(
    goalModel: GoalModelResult,
    selection: string,
  ): MarketProbabilityResult {
    if (!this.matrixIsCoherent(goalModel.matrix)) {
      return this.unavailable('COMMON_SCORE_MATRIX');
    }

    const normalized = this.normalizeThreeWay(
      goalModel.homeWin,
      goalModel.draw,
      goalModel.awayWin,
    );

    const normalizedSelection = selection
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '');

    switch (normalizedSelection) {
      case 'HOME_OR_DRAW':
      case 'HOME_DRAW':
      case '1X':
        return {
          probability: this.clamp(normalized.home + normalized.draw),
          source: 'COMMON_SCORE_MATRIX',
          scoreMatrixCoherent: true,
        };

      case 'AWAY_OR_DRAW':
      case 'DRAW_AWAY':
      case 'X2':
        return {
          probability: this.clamp(normalized.away + normalized.draw),
          source: 'COMMON_SCORE_MATRIX',
          scoreMatrixCoherent: true,
        };

      case 'HOME_OR_AWAY':
      case 'HOME_AWAY':
      case '12':
        return {
          probability: this.clamp(normalized.home + normalized.away),
          source: 'COMMON_SCORE_MATRIX',
          scoreMatrixCoherent: true,
        };

      default:
        return this.unavailable('COMMON_SCORE_MATRIX');
    }
  }

  private static calculateDrawNoBet(
    goalModel: GoalModelResult,
    selection: string,
  ): MarketProbabilityResult {
    if (!this.matrixIsCoherent(goalModel.matrix)) {
      return this.unavailable('COMMON_SCORE_MATRIX');
    }

    const normalized = this.normalizeThreeWay(
      goalModel.homeWin,
      goalModel.draw,
      goalModel.awayWin,
    );

    const normalizedSelection = this.normalizeSelection(selection);

    if (normalizedSelection === 'HOME') {
      return {
        probability: normalized.home,
        winProbability: normalized.home,
        pushProbability: normalized.draw,
        lossProbability: normalized.away,
        source: 'COMMON_SCORE_MATRIX',
        scoreMatrixCoherent: this.settlementProbabilitiesAreCoherent(
          normalized.home,
          normalized.draw,
          normalized.away,
        ),
      };
    }

    if (normalizedSelection === 'AWAY') {
      return {
        probability: normalized.away,
        winProbability: normalized.away,
        pushProbability: normalized.draw,
        lossProbability: normalized.home,
        source: 'COMMON_SCORE_MATRIX',
        scoreMatrixCoherent: this.settlementProbabilitiesAreCoherent(
          normalized.away,
          normalized.draw,
          normalized.home,
        ),
      };
    }

    return this.unavailable('COMMON_SCORE_MATRIX');
  }

  private static calculateOverUnder(
    goalModel: GoalModelResult,
    selection: string,
  ): MarketProbabilityResult {
    const match = selection
      .trim()
      .toUpperCase()
      .match(/^(OVER|UNDER)[_: -]?(\d+(?:[._]\d+)?)$/);

    if (!match) {
      return this.unavailable('COMMON_SCORE_MATRIX');
    }

    const type = match[1];
    const line = this.parseNumericToken(match[2]);

    if (!this.isValidGoalLine(line)) {
      return this.unavailable('COMMON_SCORE_MATRIX');
    }

    const probabilities = goalModel.totalGoalProbabilities;

    if (!this.probabilityArrayIsCoherent(probabilities)) {
      return this.unavailable('COMMON_SCORE_MATRIX');
    }

    const probability =
      type === 'OVER'
        ? this.probabilityTotalOver(probabilities, line)
        : this.probabilityTotalUnder(probabilities, line);

    return {
      probability,
      source: 'COMMON_SCORE_MATRIX',
      scoreMatrixCoherent: true,
    };
  }

  private static calculateBtts(
    goalModel: GoalModelResult,
    selection: string,
  ): MarketProbabilityResult {
    if (!this.matrixIsCoherent(goalModel.matrix)) {
      return this.unavailable('COMMON_SCORE_MATRIX');
    }

    let yes = 0;

    for (
      let homeGoals = 0;
      homeGoals < goalModel.matrix.length;
      homeGoals += 1
    ) {
      const row = goalModel.matrix[homeGoals] ?? [];

      for (let awayGoals = 0; awayGoals < row.length; awayGoals += 1) {
        if (homeGoals > 0 && awayGoals > 0) {
          yes += row[awayGoals] ?? 0;
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
        return this.unavailable('COMMON_SCORE_MATRIX');
    }
  }

  private static calculateGoalRange(
    goalModel: GoalModelResult,
    selection: string,
  ): MarketProbabilityResult {
    const total = goalModel.totalGoalProbabilities;

    if (!this.probabilityArrayIsCoherent(total)) {
      return this.unavailable('COMMON_SCORE_MATRIX');
    }

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

      if (!Number.isFinite(minimum) || minimum < 0) {
        return this.unavailable('COMMON_SCORE_MATRIX');
      }

      return {
        probability: this.atLeast(total, minimum),
        source: 'COMMON_SCORE_MATRIX',
        scoreMatrixCoherent: true,
      };
    }

    const rangeMatch = value.match(/^(\d+)-(\d+)$/);

    if (!rangeMatch) {
      return this.unavailable('COMMON_SCORE_MATRIX');
    }

    const minimum = Number(rangeMatch[1]);
    const maximum = Number(rangeMatch[2]);

    if (
      !Number.isFinite(minimum) ||
      !Number.isFinite(maximum) ||
      minimum < 0 ||
      maximum < minimum
    ) {
      return this.unavailable('COMMON_SCORE_MATRIX');
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
      .match(/^(HOME|AWAY)[_: -]?(OVER|UNDER)[_: -]?(\d+(?:[._]\d+)?)$/);

    if (!match) {
      return this.unavailable('COMMON_SCORE_MATRIX');
    }

    const side = match[1];
    const type = match[2];
    const line = this.parseNumericToken(match[3]);

    if (!this.isValidGoalLine(line)) {
      return this.unavailable('COMMON_SCORE_MATRIX');
    }

    const probabilities =
      side === 'HOME'
        ? goalModel.homeGoalProbabilities
        : goalModel.awayGoalProbabilities;

    if (!this.probabilityArrayIsCoherent(probabilities)) {
      return this.unavailable('COMMON_SCORE_MATRIX');
    }

    const probability =
      type === 'OVER'
        ? this.probabilityTotalOver(probabilities, line)
        : this.probabilityTotalUnder(probabilities, line);

    return {
      probability,
      source: 'COMMON_SCORE_MATRIX',
      scoreMatrixCoherent: true,
    };
  }

  private static calculatePeriodResult(
    period: GoalModelResult['halfTime'],
    selection: string,
    source: 'HALF_SCORE_MATRIX' | 'SECOND_HALF_SCORE_MATRIX',
  ): MarketProbabilityResult {
    if (!this.periodModelIsCoherent(period)) {
      return this.unavailable(source);
    }

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
        return this.unavailable(source);
    }
  }

  private static calculatePeriodGoals(
    period: GoalModelResult['halfTime'],
    selection: string,
    source: 'HALF_SCORE_MATRIX' | 'SECOND_HALF_SCORE_MATRIX',
  ): MarketProbabilityResult {
    if (!this.periodModelIsCoherent(period)) {
      return this.unavailable(source);
    }

    const probabilities = period.totalGoals;

    const match = selection
      .trim()
      .toUpperCase()
      .match(/^(OVER|UNDER)[_: -]?(\d+(?:[._]\d+)?)$/);

    if (!match) {
      return this.unavailable(source);
    }

    const line = this.parseNumericToken(match[2]);

    if (!this.isValidGoalLine(line)) {
      return this.unavailable(source);
    }

    const probability =
      match[1] === 'OVER'
        ? this.probabilityTotalOver(probabilities, line)
        : this.probabilityTotalUnder(probabilities, line);

    return {
      probability,
      source,
      scoreMatrixCoherent: true,
    };
  }

  private static calculateAsianHandicap(
    goalModel: GoalModelResult,
    selection: string,
  ): MarketProbabilityResult {
    if (!this.matrixIsCoherent(goalModel.matrix)) {
      return this.unavailable('COMMON_SCORE_MATRIX');
    }

    const parsed = this.parseHandicapSelection(selection);

    if (!parsed || !this.isValidHandicapLine(parsed.line)) {
      return this.unavailable('COMMON_SCORE_MATRIX');
    }

    const outcome = this.calculateAsianSettlement(
      goalModel.matrix,
      parsed.side,
      parsed.line,
    );

    return {
      probability: outcome.win,
      winProbability: outcome.win,
      pushProbability: outcome.push,
      lossProbability: outcome.loss,
      source: 'COMMON_SCORE_MATRIX',
      scoreMatrixCoherent: this.settlementProbabilitiesAreCoherent(
        outcome.win,
        outcome.push,
        outcome.loss,
      ),
    };
  }

  private static calculateEuropeanHandicap(
    goalModel: GoalModelResult,
    selection: string,
  ): MarketProbabilityResult {
    if (!this.matrixIsCoherent(goalModel.matrix)) {
      return this.unavailable('COMMON_SCORE_MATRIX');
    }

    const parsed = this.parseEuropeanHandicapSelection(selection);

    if (!parsed || !this.isValidHandicapLine(parsed.line)) {
      return this.unavailable('COMMON_SCORE_MATRIX');
    }

    let probability = 0;

    for (
      let homeGoals = 0;
      homeGoals < goalModel.matrix.length;
      homeGoals += 1
    ) {
      const row = goalModel.matrix[homeGoals] ?? [];

      for (let awayGoals = 0; awayGoals < row.length; awayGoals += 1) {
        const matrixProbability = this.clamp(row[awayGoals] ?? 0);
        const adjusted = homeGoals - awayGoals + parsed.line;

        if (parsed.side === 'HOME' && adjusted > 0) {
          probability += matrixProbability;
        }

        if (parsed.side === 'DRAW' && Math.abs(adjusted) <= 0.000001) {
          probability += matrixProbability;
        }

        if (parsed.side === 'AWAY' && adjusted < 0) {
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
    if (!this.isQuarterLine(line)) {
      return this.calculateSingleAsianSettlement(matrix, side, line);
    }

    const lower = this.normalizeHandicapQuarter(Math.floor(line * 2) / 2);

    const upper = this.normalizeHandicapQuarter(Math.ceil(line * 2) / 2);

    let win = 0;
    let push = 0;
    let loss = 0;

    for (let homeGoals = 0; homeGoals < matrix.length; homeGoals += 1) {
      const row = matrix[homeGoals] ?? [];

      for (let awayGoals = 0; awayGoals < row.length; awayGoals += 1) {
        const probability = this.clamp(row[awayGoals] ?? 0);

        if (probability <= 0) {
          continue;
        }

        const first = this.asianOutcome(homeGoals, awayGoals, side, lower);

        const second = this.asianOutcome(homeGoals, awayGoals, side, upper);

        if (first === 'WIN' && second === 'WIN') {
          win += probability;
          continue;
        }

        if (
          (first === 'WIN' && second === 'PUSH') ||
          (first === 'PUSH' && second === 'WIN')
        ) {
          win += probability * 0.5;
          continue;
        }

        if (first === 'PUSH' && second === 'PUSH') {
          push += probability;
          continue;
        }

        if (first === 'LOSS' && second === 'LOSS') {
          loss += probability;
          continue;
        }

        if (
          (first === 'LOSS' && second === 'PUSH') ||
          (first === 'PUSH' && second === 'LOSS')
        ) {
          loss += probability * 0.5;
          continue;
        }

        push += probability;
      }
    }

    return this.normalizeSettlement(win, push, loss);
  }

  private static calculateSingleAsianSettlement(
    matrix: number[][],
    side: 'HOME' | 'AWAY',
    line: number,
  ): {
    win: number;
    push: number;
    loss: number;
  } {
    let win = 0;
    let push = 0;
    let loss = 0;

    for (let homeGoals = 0; homeGoals < matrix.length; homeGoals += 1) {
      const row = matrix[homeGoals] ?? [];

      for (let awayGoals = 0; awayGoals < row.length; awayGoals += 1) {
        const probability = this.clamp(row[awayGoals] ?? 0);

        if (probability <= 0) {
          continue;
        }

        const outcome = this.asianOutcome(homeGoals, awayGoals, side, line);

        if (outcome === 'WIN') {
          win += probability;
        } else if (outcome === 'LOSS') {
          loss += probability;
        } else {
          push += probability;
        }
      }
    }

    return this.normalizeSettlement(win, push, loss);
  }

  private static asianOutcome(
    homeGoals: number,
    awayGoals: number,
    side: 'HOME' | 'AWAY',
    line: number,
  ): 'WIN' | 'PUSH' | 'LOSS' {
    const margin = homeGoals - awayGoals;

    const adjusted = side === 'HOME' ? margin + line : -margin + line;

    if (adjusted > 0) {
      return 'WIN';
    }

    if (adjusted < 0) {
      return 'LOSS';
    }

    return 'PUSH';
  }

  private static normalizeSettlement(
    win: number,
    push: number,
    loss: number,
  ): {
    win: number;
    push: number;
    loss: number;
  } {
    const safeWin = this.clamp(win);
    const safePush = this.clamp(push);
    const safeLoss = this.clamp(loss);

    const total = safeWin + safePush + safeLoss;

    if (total <= 0 || !Number.isFinite(total)) {
      return {
        win: 0,
        push: 0,
        loss: 0,
      };
    }

    return {
      win: safeWin / total,
      push: safePush / total,
      loss: safeLoss / total,
    };
  }

  private static settlementProbabilitiesAreCoherent(
    win: number,
    push: number,
    loss: number,
  ): boolean {
    const total = win + push + loss;

    return (
      Number.isFinite(win) &&
      Number.isFinite(push) &&
      Number.isFinite(loss) &&
      win >= 0 &&
      push >= 0 &&
      loss >= 0 &&
      Math.abs(total - 1) <= 0.000001
    );
  }

  private static probabilityTotalOver(
    probabilities: number[],
    line: number,
  ): number {
    let result = 0;

    for (let goals = 0; goals < probabilities.length; goals += 1) {
      if (goals > line) {
        result += probabilities[goals] ?? 0;
      }
    }

    return this.clamp(result);
  }

  private static probabilityTotalUnder(
    probabilities: number[],
    line: number,
  ): number {
    let result = 0;

    for (let goals = 0; goals < probabilities.length; goals += 1) {
      if (goals < line) {
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
      goals += 1
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

    for (let goals = minimum; goals < probabilities.length; goals += 1) {
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

    if (total <= 0 || !Number.isFinite(total)) {
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

  private static periodModelIsCoherent(
    period: GoalModelResult['halfTime'],
  ): boolean {
    return (
      this.probabilityArrayIsCoherent(period.homeGoals) &&
      this.probabilityArrayIsCoherent(period.awayGoals) &&
      this.probabilityArrayIsCoherent(period.totalGoals) &&
      this.threeWayIsCoherent(period.homeWin, period.draw, period.awayWin)
    );
  }

  private static matrixIsCoherent(matrix: number[][]): boolean {
    if (!Array.isArray(matrix) || !matrix.length) {
      return false;
    }

    let total = 0;

    for (const row of matrix) {
      if (!Array.isArray(row)) {
        return false;
      }

      for (const value of row) {
        if (!Number.isFinite(value) || value < 0) {
          return false;
        }

        total += value;
      }
    }

    return Number.isFinite(total) && total > 0 && Math.abs(total - 1) <= 0.0001;
  }

  private static probabilityArrayIsCoherent(probabilities: number[]): boolean {
    if (!Array.isArray(probabilities) || probabilities.length === 0) {
      return false;
    }

    let total = 0;

    for (const value of probabilities) {
      if (!Number.isFinite(value) || value < 0) {
        return false;
      }

      total += value;
    }

    return Number.isFinite(total) && total > 0 && Math.abs(total - 1) <= 0.0001;
  }

  private static threeWayIsCoherent(
    home: number,
    draw: number,
    away: number,
  ): boolean {
    const safeHome = this.clamp(home);
    const safeDraw = this.clamp(draw);
    const safeAway = this.clamp(away);

    const total = safeHome + safeDraw + safeAway;

    return Number.isFinite(total) && total > 0 && Math.abs(total - 1) <= 0.0001;
  }

  private static parseHandicapSelection(selection: string): {
    side: 'HOME' | 'AWAY';
    line: number;
  } | null {
    const normalized = selection.trim().toUpperCase().replace(/\s+/g, '');

    let match = normalized.match(
      /^(HOME|AWAY|1|2)(?:_|:)?(PLUS|MINUS)(?:_|:)?(\d+(?:[._]\d+)?)$/,
    );

    if (match) {
      const side = match[1] === 'HOME' || match[1] === '1' ? 'HOME' : 'AWAY';

      const magnitude = this.parseNumericToken(match[3]);

      if (!Number.isFinite(magnitude)) {
        return null;
      }

      return {
        side,
        line: match[2] === 'MINUS' ? -magnitude : magnitude,
      };
    }

    match = normalized.match(/^(HOME|AWAY|1|2)(?:_|:)?([+-]?\d+(?:[._]\d+)?)$/);

    if (match) {
      const side = match[1] === 'HOME' || match[1] === '1' ? 'HOME' : 'AWAY';

      const line = this.parseNumericToken(match[2]);

      if (!Number.isFinite(line)) {
        return null;
      }

      return {
        side,
        line,
      };
    }

    return null;
  }

  private static parseEuropeanHandicapSelection(selection: string): {
    side: 'HOME' | 'DRAW' | 'AWAY';
    line: number;
  } | null {
    const normalized = selection.trim().toUpperCase().replace(/\s+/g, '');

    let match = normalized.match(
      /^(HOME|DRAW|AWAY|1|X|2)(?:_|:)?(PLUS|MINUS)(?:_|:)?(\d+(?:[._]\d+)?)$/,
    );

    if (match) {
      const side =
        match[1] === 'HOME' || match[1] === '1'
          ? 'HOME'
          : match[1] === 'DRAW' || match[1] === 'X'
            ? 'DRAW'
            : 'AWAY';

      const magnitude = this.parseNumericToken(match[3]);

      if (!Number.isFinite(magnitude)) {
        return null;
      }

      return {
        side,
        line: match[2] === 'MINUS' ? -magnitude : magnitude,
      };
    }

    match = normalized.match(
      /^(HOME|DRAW|AWAY|1|X|2)(?:_|:)?([+-]?\d+(?:[._]\d+)?)$/,
    );

    if (!match) {
      return null;
    }

    const side =
      match[1] === 'HOME' || match[1] === '1'
        ? 'HOME'
        : match[1] === 'DRAW' || match[1] === 'X'
          ? 'DRAW'
          : 'AWAY';

    const line = this.parseNumericToken(match[2]);

    if (!Number.isFinite(line)) {
      return null;
    }

    return {
      side,
      line,
    };
  }

  private static isValidGoalLine(line: number): boolean {
    if (!Number.isFinite(line) || line < 0) {
      return false;
    }

    const doubled = line * 2;

    return Math.abs(doubled - Math.round(doubled)) <= 0.000001;
  }

  private static isValidHandicapLine(line: number): boolean {
    if (!Number.isFinite(line)) {
      return false;
    }

    const quarterUnits = line * 4;

    return Math.abs(quarterUnits - Math.round(quarterUnits)) <= 0.000001;
  }

  private static isQuarterLine(line: number): boolean {
    if (!this.isValidHandicapLine(line)) {
      return false;
    }

    const doubled = line * 2;
    const nearestHalf = Math.round(doubled);

    return Math.abs(doubled - nearestHalf) > 0.000001;
  }

  private static normalizeHandicapQuarter(line: number): number {
    return Math.round(line * 4) / 4;
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

      case 'YES':
      case 'BTTS_YES':
        return 'YES';

      case 'NO':
      case 'BTTS_NO':
        return 'NO';

      default:
        return normalized;
    }
  }

  private static parseNumericToken(value: string): number {
    return Number(value.replace('_', '.'));
  }

  private static unavailable(
    source:
      | 'COMMON_SCORE_MATRIX'
      | 'HALF_SCORE_MATRIX'
      | 'SECOND_HALF_SCORE_MATRIX',
  ): MarketProbabilityResult {
    return {
      probability: 0,
      source,
      scoreMatrixCoherent: false,
    };
  }

  private static clamp(value: number, minimum = 0, maximum = 1): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
