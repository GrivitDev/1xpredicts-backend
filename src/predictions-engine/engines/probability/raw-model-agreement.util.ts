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
    realityProbability: number,
  ): RawModelAgreementResult {
    const realityModel = this.clamp(realityProbability);

    const safetyModel = this.calculateSafetyModel(features, realityModel);

    const independentModel = this.calculateIndependentModel(
      features,
      market,
      selection,
    );

    const modelOutputs: Record<string, number> = {
      safetyModel,
      realityModel,
      independentModel,
    };

    const values = Object.values(modelOutputs);

    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;

    const meanAbsoluteDeviation =
      values.reduce((sum, value) => sum + Math.abs(value - mean), 0) /
      values.length;

    const agreement = this.clamp(1 - meanAbsoluteDeviation * 3);

    return {
      agreement,
      modelOutputs,
      signals: Object.keys(modelOutputs),
    };
  }

  private static calculateSafetyModel(
    features: RawPredictionFeatures,
    probability: number,
  ): number {
    const dataQuality = this.normalizedPercentage(features.overallDataQuality);

    const completeness = this.normalizedPercentage(features.dataCompleteness);

    const historicalQuality = this.normalizedPercentage(
      features.historicalDataQuality,
    );

    const sampleReliability = this.sampleReliability(
      features.overallSampleSize,
    );

    const evidenceStrength =
      dataQuality * 0.35 +
      completeness * 0.2 +
      historicalQuality * 0.2 +
      sampleReliability * 0.25;

    const uncertainty = (1 - evidenceStrength) * 0.6;

    return this.clamp(probability * (1 - uncertainty) + 0.5 * uncertainty);
  }

  private static calculateIndependentModel(
    features: RawPredictionFeatures,
    market: PredictionMarket,
    selection: string,
  ): number {
    switch (market) {
      case PredictionMarket.MATCH_RESULT:
      case PredictionMarket.DOUBLE_CHANCE:
      case PredictionMarket.DRAW_NO_BET:
        return this.calculateResultProbability(features, market, selection);

      case PredictionMarket.BOTH_TEAMS_TO_SCORE:
        return this.calculateBttsProbability(features, selection);

      case PredictionMarket.OVER_UNDER:
      case PredictionMarket.FIRST_HALF_GOALS:
      case PredictionMarket.SECOND_HALF_GOALS:
        return this.calculateOverUnderProbability(features, market, selection);

      case PredictionMarket.GOAL_RANGE:
        return this.calculateGoalRangeProbability(features, selection);

      case PredictionMarket.TEAM_TOTAL_GOALS:
        return this.calculateTeamTotalProbability(features, selection);

      case PredictionMarket.HALF_TIME_RESULT:
      case PredictionMarket.SECOND_HALF_RESULT:
        return this.calculatePeriodResultProbability(
          features,
          market,
          selection,
        );

      case PredictionMarket.ASIAN_HANDICAP:
      case PredictionMarket.EUROPEAN_HANDICAP:
        return this.calculateHandicapProbability(features, market, selection);

      default:
        return 0.5;
    }
  }

  private static calculateResultProbability(
    features: RawPredictionFeatures,
    market: PredictionMarket,
    selection: string,
  ): number {
    const homeStrength = this.calculateTeamStrength(features.home);

    const awayStrength = this.calculateTeamStrength(features.away);

    const standingHome = this.getStandingProbability(features, true);

    const standingAway = this.getStandingProbability(features, false);

    const homeEdge = homeStrength * 0.55 + standingHome * 0.25 + 0.2;

    const awayEdge = awayStrength * 0.55 + standingAway * 0.25;

    const drawStrength = this.calculateDrawStrength(features);

    const total = homeEdge + awayEdge + drawStrength;

    if (total <= 0) {
      return 0.5;
    }

    const home = this.clamp(homeEdge / total);

    const draw = this.clamp(drawStrength / total);

    const away = this.clamp(awayEdge / total);

    switch (market) {
      case PredictionMarket.MATCH_RESULT:
        if (selection === 'HOME') {
          return home;
        }

        if (selection === 'DRAW') {
          return draw;
        }

        if (selection === 'AWAY') {
          return away;
        }

        return 0.5;

      case PredictionMarket.DOUBLE_CHANCE:
        if (
          selection === 'HOME_OR_DRAW' ||
          selection === 'HOME_DRAW' ||
          selection === '1X'
        ) {
          return this.clamp(home + draw);
        }

        if (
          selection === 'AWAY_OR_DRAW' ||
          selection === 'DRAW_AWAY' ||
          selection === 'X2'
        ) {
          return this.clamp(away + draw);
        }

        return 0.5;

      case PredictionMarket.DRAW_NO_BET:
        if (selection === 'HOME') {
          const denominator = home + away;

          return denominator > 0 ? this.clamp(home / denominator) : 0.5;
        }

        if (selection === 'AWAY') {
          const denominator = home + away;

          return denominator > 0 ? this.clamp(away / denominator) : 0.5;
        }

        return 0.5;

      default:
        return 0.5;
    }
  }

  private static calculateBttsProbability(
    features: RawPredictionFeatures,
    selection: string,
  ): number {
    const values = [
      features.home.bttsRate,
      features.away.bttsRate,
      features.home.recent.bttsRate,
      features.away.recent.bttsRate,
      features.home.venue.bttsRate,
      features.away.venue.bttsRate,
    ];

    if (features.h2h?.available && features.h2h.sampleSize > 0) {
      values.push(features.h2h.bttsRate);
    }

    const probability = this.averageAvailable(values);

    if (selection === 'YES') {
      return probability;
    }

    if (selection === 'NO') {
      return this.clamp(1 - probability);
    }

    return 0.5;
  }

  private static calculateOverUnderProbability(
    features: RawPredictionFeatures,
    market: PredictionMarket,
    selection: string,
  ): number {
    const match = selection
      .trim()
      .toUpperCase()
      .match(/^(OVER|UNDER)[:_ -]?(\d+(?:\.\d+)?)$/);

    if (!match) {
      return 0.5;
    }

    const type = match[1] as 'OVER' | 'UNDER';

    const line = Number(match[2]);

    let rate: number;

    if (market === PredictionMarket.FIRST_HALF_GOALS) {
      rate = this.calculatePeriodOverRate(features, line, true);
    } else if (market === PredictionMarket.SECOND_HALF_GOALS) {
      rate = this.calculatePeriodOverRate(features, line, false);
    } else {
      rate = this.calculateTotalGoalsOverRate(features, line);
    }

    return type === 'OVER' ? rate : this.clamp(1 - rate);
  }

  private static calculateGoalRangeProbability(
    features: RawPredictionFeatures,
    selection: string,
  ): number {
    const home = this.averageAvailable([
      features.home.over05Rate,
      features.home.recent.over05Rate,
      features.home.venue.over05Rate,
    ]);

    const away = this.averageAvailable([
      features.away.over05Rate,
      features.away.recent.over05Rate,
      features.away.venue.over05Rate,
    ]);

    const over0 = this.averageAvailable([home, away]);

    const over2 = this.averageAvailable([
      features.home.over25Rate,
      features.away.over25Rate,
      features.home.recent.over25Rate,
      features.away.recent.over25Rate,
      features.home.venue.over25Rate,
      features.away.venue.over25Rate,
    ]);

    const over4 = this.averageAvailable([
      features.home.over45Rate,
      features.away.over45Rate,
      features.home.recent.over45Rate,
      features.away.recent.over45Rate,
      features.home.venue.over45Rate,
      features.away.venue.over45Rate,
    ]);

    switch (selection.trim().toUpperCase()) {
      case '0':
        return this.clamp(1 - over0);

      case '1-2':
      case '1_2':
        return this.clamp(Math.max(over0 - over2, 0));

      case '3-4':
      case '3_4':
        return this.clamp(Math.max(over2 - over4, 0));

      case '5+':
      case '5_PLUS':
        return this.clamp(over4);

      default:
        return 0.5;
    }
  }

  private static calculateTeamTotalProbability(
    features: RawPredictionFeatures,
    selection: string,
  ): number {
    const match = selection
      .trim()
      .toUpperCase()
      .match(/^(HOME|AWAY)_(OVER|UNDER)_(\d+(?:\.\d+)?)$/);

    if (!match) {
      return 0.5;
    }

    const team = match[1] === 'HOME' ? features.home : features.away;

    const type = match[2] as 'OVER' | 'UNDER';

    const line = Number(match[3]);

    const rate = this.getTeamOverRate(team, line);

    return type === 'OVER' ? rate : this.clamp(1 - rate);
  }

  private static calculatePeriodResultProbability(
    features: RawPredictionFeatures,
    market: PredictionMarket,
    selection: string,
  ): number {
    const homePeriod =
      market === PredictionMarket.HALF_TIME_RESULT
        ? features.home.firstHalf
        : features.home.secondHalf;

    const awayPeriod =
      market === PredictionMarket.HALF_TIME_RESULT
        ? features.away.firstHalf
        : features.away.secondHalf;

    const homeGoals = this.safeNonNegative(homePeriod.averageGoalsScored);

    const awayGoals = this.safeNonNegative(awayPeriod.averageGoalsScored);

    const total = homeGoals + awayGoals;

    if (total <= 0) {
      return 0.5;
    }

    const homeProbability = homeGoals / total;

    const awayProbability = awayGoals / total;

    const drawBase = 1 - Math.abs(homeProbability - awayProbability);

    const draw = this.clamp(drawBase * 0.35);

    const directionalTotal = homeProbability + awayProbability + draw;

    const home =
      directionalTotal > 0 ? homeProbability / directionalTotal : 0.33;

    const away =
      directionalTotal > 0 ? awayProbability / directionalTotal : 0.33;

    const normalizedDraw =
      directionalTotal > 0 ? draw / directionalTotal : 0.34;

    if (selection === 'HOME') {
      return this.clamp(home);
    }

    if (selection === 'DRAW') {
      return this.clamp(normalizedDraw);
    }

    if (selection === 'AWAY') {
      return this.clamp(away);
    }

    return 0.5;
  }

  private static calculateHandicapProbability(
    features: RawPredictionFeatures,
    market: PredictionMarket,
    selection: string,
  ): number {
    const match = selection
      .trim()
      .toUpperCase()
      .match(/^(HOME|DRAW|AWAY)_(.+)$/);

    if (!match) {
      return 0.5;
    }

    const side = match[1];

    const margin = this.estimateStrengthMargin(features);

    const line = Number(match[2]);

    if (!Number.isFinite(line)) {
      return 0.5;
    }

    if (market === PredictionMarket.EUROPEAN_HANDICAP) {
      if (side === 'HOME') {
        return this.sigmoid(margin - line, 1.2);
      }

      if (side === 'AWAY') {
        return this.sigmoid(-margin + line, 1.2);
      }

      return this.sigmoid(Math.abs(margin - line) - 0.5, 1.3);
    }

    if (side === 'HOME') {
      return this.sigmoid(margin + line, 1.1);
    }

    return this.sigmoid(-margin - line, 1.1);
  }

  private static calculateTotalGoalsOverRate(
    features: RawPredictionFeatures,
    line: number,
  ): number {
    const directRates = this.getCombinedGoalRate(features, line);

    if (directRates !== null) {
      return directRates;
    }

    const expected =
      this.estimateTeamGoals(features.home) +
      this.estimateTeamGoals(features.away);

    return this.poissonOverProbability(expected, line);
  }

  private static calculatePeriodOverRate(
    features: RawPredictionFeatures,
    line: number,
    firstHalf: boolean,
  ): number {
    const home = firstHalf ? features.home.firstHalf : features.home.secondHalf;

    const away = firstHalf ? features.away.firstHalf : features.away.secondHalf;

    const expected =
      this.safeNonNegative(home.averageGoalsScored) +
      this.safeNonNegative(away.averageGoalsScored);

    if (expected <= 0) {
      return 0.5;
    }

    return this.poissonOverProbability(expected, line);
  }

  private static getCombinedGoalRate(
    features: RawPredictionFeatures,
    line: number,
  ): number | null {
    const home = this.getTeamOverRate(features.home, line);

    const away = this.getTeamOverRate(features.away, line);

    const values = [home, away].filter((value) => Number.isFinite(value));

    if (!values.length) {
      return null;
    }

    return this.clamp(this.average(values));
  }

  private static getTeamOverRate(
    team: RawPredictionFeatures['home'],
    line: number,
  ): number {
    const rate = this.readGoalRate(team, line);

    if (rate !== null) {
      return rate;
    }

    return this.poissonOverProbability(this.estimateTeamGoals(team), line);
  }

  private static readGoalRate(
    team: RawPredictionFeatures['home'],
    line: number,
  ): number | null {
    const key = this.goalRateKey(line);

    const overall = this.safeProbability(team[key]);

    const recent = this.safeProbability(team.recent[key]);

    const venue = this.safeProbability(team.venue[key]);

    const values = [overall, recent, venue].filter(
      (value): value is number => value !== null,
    );

    if (!values.length) {
      return null;
    }

    return this.clamp(this.average(values));
  }

  private static estimateTeamGoals(
    team: RawPredictionFeatures['home'],
  ): number {
    const overall = this.safeNonNegative(team.averageGoalsScored);

    const recent = this.safeNonNegative(team.recent.averageGoalsScored);

    const venue = this.safeNonNegative(team.venue.averageGoalsScored);

    const samples = [
      {
        value: overall,
        sample: team.sampleSize,
      },
      {
        value: recent,
        sample: team.recent.sampleSize,
      },
      {
        value: venue,
        sample: team.venue.sampleSize,
      },
    ];

    const weighted = samples.reduce(
      (sum, item) => sum + item.value * this.sampleReliability(item.sample),
      0,
    );

    const weight = samples.reduce(
      (sum, item) => sum + this.sampleReliability(item.sample),
      0,
    );

    if (weight <= 0) {
      return 1;
    }

    const observed = weighted / weight;

    const reliability = this.clamp(this.sampleReliability(team.sampleSize));

    return this.clamp(observed * reliability + 1 * (1 - reliability), 0.2, 3);
  }

  private static calculateTeamStrength(
    team: RawPredictionFeatures['home'],
  ): number {
    const winRate = this.safeProbability(team.winRate) ?? 0.5;

    const recentWinRate = this.safeProbability(team.recent.winRate) ?? 0.5;

    const venueWinRate = this.safeProbability(team.venue.winRate) ?? 0.5;

    const pointsPerMatch = this.normalizedPointsPerMatch(team.pointsPerMatch);

    return this.clamp(
      winRate * 0.3 +
        recentWinRate * 0.25 +
        venueWinRate * 0.25 +
        pointsPerMatch * 0.2,
    );
  }

  private static calculateDrawStrength(
    features: RawPredictionFeatures,
  ): number {
    const homeDraw = this.safeProbability(features.home.drawRate) ?? 0.2;

    const awayDraw = this.safeProbability(features.away.drawRate) ?? 0.2;

    const homeVenueDraw =
      this.safeProbability(features.home.venue.drawRate) ?? 0.2;

    const awayVenueDraw =
      this.safeProbability(features.away.venue.drawRate) ?? 0.2;

    return this.clamp(
      (homeDraw + awayDraw + homeVenueDraw + awayVenueDraw) / 4,
      0.05,
      0.45,
    );
  }

  private static getStandingProbability(
    features: RawPredictionFeatures,
    home: boolean,
  ): number {
    const homeStanding = features.standings?.home;

    const awayStanding = features.standings?.away;

    if (!homeStanding || !awayStanding) {
      return 0.5;
    }

    const homePoints = Math.max(homeStanding.points, 0);

    const awayPoints = Math.max(awayStanding.points, 0);

    const total = homePoints + awayPoints;

    if (total <= 0) {
      return 0.5;
    }

    return this.clamp(home ? homePoints / total : awayPoints / total);
  }

  private static estimateStrengthMargin(
    features: RawPredictionFeatures,
  ): number {
    const homeStrength = this.calculateTeamStrength(features.home);

    const awayStrength = this.calculateTeamStrength(features.away);

    const homeGoals = this.estimateTeamGoals(features.home);

    const awayGoals = this.estimateTeamGoals(features.away);

    return (homeStrength - awayStrength) * 1.5 + (homeGoals - awayGoals);
  }

  private static normalizedPointsPerMatch(value: number): number {
    if (!Number.isFinite(value)) {
      return 0.5;
    }

    return this.clamp(value / 3);
  }

  private static goalRateKey(
    line: number,
  ):
    | 'over05Rate'
    | 'over15Rate'
    | 'over25Rate'
    | 'over35Rate'
    | 'over45Rate'
    | 'over55Rate' {
    if (line <= 0.5) {
      return 'over05Rate';
    }

    if (line <= 1.5) {
      return 'over15Rate';
    }

    if (line <= 2.5) {
      return 'over25Rate';
    }

    if (line <= 3.5) {
      return 'over35Rate';
    }

    if (line <= 4.5) {
      return 'over45Rate';
    }

    return 'over55Rate';
  }

  private static poissonOverProbability(lambda: number, line: number): number {
    let probability = 0;

    const maxGoals = 12;

    for (let goals = 0; goals <= maxGoals; goals++) {
      if (goals > line) {
        probability += this.poissonProbability(lambda, goals);
      }
    }

    return this.clamp(probability);
  }

  private static poissonProbability(lambda: number, goals: number): number {
    if (!Number.isFinite(lambda) || !Number.isFinite(goals) || goals < 0) {
      return 0;
    }

    const safeLambda = Math.max(lambda, 0);

    if (goals === 0) {
      return Math.exp(-safeLambda);
    }

    let probability = Math.exp(-safeLambda);

    for (let index = 1; index <= goals; index++) {
      probability *= safeLambda / index;
    }

    return this.clamp(probability);
  }

  private static sigmoid(value: number, scale: number): number {
    const safeScale = Math.max(Math.abs(scale), 0.01);

    return this.clamp(1 / (1 + Math.exp(-value / safeScale)));
  }

  private static average(values: number[]): number {
    if (!values.length) {
      return 0.5;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private static averageAvailable(
    values: Array<number | null | undefined>,
  ): number {
    const valid = values.filter(
      (value): value is number =>
        typeof value === 'number' && Number.isFinite(value),
    );

    if (!valid.length) {
      return 0.5;
    }

    return this.clamp(
      this.average(valid.map((value) => (value > 1 ? value / 100 : value))),
    );
  }

  private static safeProbability(
    value: number | null | undefined,
  ): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return null;
    }

    return this.clamp(value > 1 ? value / 100 : value);
  }

  private static safeNonNegative(value: number | null | undefined): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      return 0;
    }

    return value;
  }

  private static sampleReliability(sampleSize: number): number {
    if (!Number.isFinite(sampleSize) || sampleSize <= 0) {
      return 0;
    }

    return this.clamp(1 - Math.exp(-sampleSize / 18));
  }

  private static normalizedPercentage(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return this.clamp(value > 1 ? value / 100 : value);
  }

  private static clamp(value: number, minimum = 0, maximum = 1): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
