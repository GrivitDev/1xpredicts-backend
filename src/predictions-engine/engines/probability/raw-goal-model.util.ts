// src/predictions-engine/engines/probability/raw-goal-model.util.ts

import { RawPredictionFeatures } from '../../interfaces/raw-prediction-features.interface';

const MAX_GOALS = 10;

const DEFAULT_HOME_GOALS = 1.2;
const DEFAULT_AWAY_GOALS = 1.05;

const MAX_TEAM_LAMBDA = 4.5;

export interface GoalScoreMatrix {
  matrix: number[][];
  homeGoals: number[];
  awayGoals: number[];
  totalGoals: number[];
  homeWin: number;
  draw: number;
  awayWin: number;
}

export interface GoalModelResult extends GoalScoreMatrix {
  homeLambda: number;
  awayLambda: number;

  expectedHomeGoals: number;
  expectedAwayGoals: number;
  expectedTotalGoals: number;

  homeGoalProbabilities: number[];
  awayGoalProbabilities: number[];
  totalGoalProbabilities: number[];

  halfTime: {
    homeGoals: number[];
    awayGoals: number[];
    totalGoals: number[];
    homeWin: number;
    draw: number;
    awayWin: number;
  };

  secondHalf: {
    homeGoals: number[];
    awayGoals: number[];
    totalGoals: number[];
    homeWin: number;
    draw: number;
    awayWin: number;
  };
}

export class RawGoalModelUtil {
  static calculate(features: RawPredictionFeatures): GoalModelResult {
    const homeLambda = this.calculateTeamLambda(
      features.home,
      features.away,
      true,
      features,
    );

    const awayLambda = this.calculateTeamLambda(
      features.away,
      features.home,
      false,
      features,
    );

    const homePoisson = this.buildPoissonDistribution(homeLambda);

    const awayPoisson = this.buildPoissonDistribution(awayLambda);

    const poissonMatrix = this.buildScoreMatrix(homePoisson, awayPoisson);

    const empiricalMatrix = this.buildDirectionalEmpiricalMatrix(features);

    const empiricalWeight = this.getEmpiricalWeight(features);

    const blendedMatrix = this.blendMatrices(
      poissonMatrix,
      empiricalMatrix,
      empiricalWeight,
    );

    const matrix = this.normalizeMatrix(blendedMatrix);

    const homeGoalProbabilities = this.sumHomeGoals(matrix);

    const awayGoalProbabilities = this.sumAwayGoals(matrix);

    const totalGoalProbabilities = this.sumTotalGoals(matrix);

    const halfTime = this.buildHalfTimeModel(features);

    const secondHalf = this.buildSecondHalfModel(features);

    return {
      matrix,

      homeGoals: homeGoalProbabilities,

      awayGoals: awayGoalProbabilities,

      totalGoals: totalGoalProbabilities,

      homeWin: this.calculateHomeWin(matrix),

      draw: this.calculateDraw(matrix),

      awayWin: this.calculateAwayWin(matrix),

      homeLambda,

      awayLambda,

      expectedHomeGoals: this.expectedValue(homeGoalProbabilities),

      expectedAwayGoals: this.expectedValue(awayGoalProbabilities),

      expectedTotalGoals: this.expectedValue(totalGoalProbabilities),

      homeGoalProbabilities,

      awayGoalProbabilities,

      totalGoalProbabilities,

      halfTime,

      secondHalf,
    };
  }

  private static calculateTeamLambda(
    team: RawPredictionFeatures['home'],
    opponent: RawPredictionFeatures['away'],
    isHome: boolean,
    features: RawPredictionFeatures,
  ): number {
    const attackEvidence = this.collectAttackEvidence(team, isHome);

    const defenceEvidence = this.collectDefenceEvidence(opponent, !isHome);

    const attack = this.weightedEvidenceAverage(attackEvidence);

    const defence = this.weightedEvidenceAverage(defenceEvidence);

    let lambda = 0;

    if (attack !== null && defence !== null) {
      lambda = attack * 0.52 + defence * 0.48;
    } else if (attack !== null) {
      lambda = attack;
    } else if (defence !== null) {
      lambda = defence;
    }

    if (!Number.isFinite(lambda) || lambda <= 0) {
      lambda = isHome ? DEFAULT_HOME_GOALS : DEFAULT_AWAY_GOALS;
    }

    /*
     * ----------------------------------------------------------
     * TEAM COMPARISON
     * ----------------------------------------------------------
     */
    const comparison = features.comparison;

    if (comparison) {
      const comparisonConfidence = this.clamp(comparison.confidence ?? 0, 0, 1);

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

      const directionalSignal = isHome
        ? directionalDifference
        : -directionalDifference;

      const productionSignal = isHome
        ? goalProductionDifference
        : -goalProductionDifference;

      /*
       * Positive goal-prevention difference means the home
       * side has stronger prevention evidence.
       *
       * Therefore:
       *
       *   home lambda  -> decreases
       *   away lambda  -> also decreases
       *
       * The previous away branch incorrectly increased the
       * away lambda when the home side had stronger prevention.
       */
      const preventionSignal = isHome
        ? -goalPreventionDifference
        : -goalPreventionDifference;

      const directionalAdjustment =
        directionalSignal * comparisonConfidence * 0.08;

      const productionAdjustment =
        productionSignal * comparisonConfidence * 0.12;

      const preventionAdjustment =
        preventionSignal * comparisonConfidence * 0.1;

      const comparisonAdjustment = this.clamp(
        directionalAdjustment + productionAdjustment + preventionAdjustment,
        -0.22,
        0.22,
      );

      lambda *= 1 + comparisonAdjustment;
    }

    /*
     * Standing evidence is supplementary.
     */
    const standingAdjustment = this.calculateStandingAdjustment(
      features,
      isHome,
    );

    lambda *= 1 + standingAdjustment;

    /*
     * Recent points-per-match.
     *
     * recentDifference is already:
     *
     *   current team's PPM
     *   -
     *   opponent's PPM
     *
     * Therefore it should not be inverted for away teams.
     * The previous inversion incorrectly penalized a stronger
     * away side.
     */
    const recentDifference =
      this.safeNumber(team.recent.pointsPerMatch) -
      this.safeNumber(opponent.recent.pointsPerMatch);

    if (Number.isFinite(recentDifference)) {
      const directionalRecent = this.clamp(recentDifference, -3, 3);

      lambda += directionalRecent * 0.07;
    }

    /*
     * Venue scoring remains directly compared with the team's
     * overall scoring level.
     */
    const venueScoring = this.safePositive(team.venue.averageGoalsScored);

    const overallScoring = this.safePositive(team.averageGoalsScored);

    if (venueScoring > 0 && overallScoring > 0) {
      const venueDifference = venueScoring - overallScoring;

      lambda += venueDifference * 0.1;
    }

    /*
     * H2H remains supplementary.
     */
    const h2h = features.h2h;

    if (h2h?.available && h2h.sampleSize > 0) {
      const h2hValue = isHome
        ? h2h.averageGoalsForHome
        : h2h.averageGoalsForAway;

      if (Number.isFinite(h2hValue) && h2hValue >= 0) {
        const weight = this.getH2HWeight(h2h.sampleSize);

        lambda = lambda * (1 - weight) + h2hValue * weight;
      }
    }

    return this.clamp(lambda, isHome ? 0.05 : 0.04, MAX_TEAM_LAMBDA);
  }

  private static collectAttackEvidence(
    team: RawPredictionFeatures['home'],
    isHome: boolean,
  ): Array<{
    value: number | null;
    sample: number;
    weight: number;
  }> {
    const stats = team.sourceData?.competitionStats;

    const profile = team.sourceData?.performanceProfile;

    return [
      {
        value: this.readNullableNumber(team.averageGoalsScored),
        sample: this.readNumber(team.sampleSize),
        weight: 0.12,
      },

      {
        value: this.readNullableNumber(team.recent.averageGoalsScored),
        sample: this.readNumber(team.recent.sampleSize),
        weight: 0.1,
      },

      {
        value: this.readNullableNumber(team.venue.averageGoalsScored),
        sample: this.readNumber(team.venue.sampleSize),
        weight: 0.14,
      },

      {
        value: stats ? this.readNullableNumber(stats.averageGoalsScored) : null,
        sample: stats ? this.readNumber(stats.played) : 0,
        weight: 0.1,
      },

      {
        value: stats
          ? isHome
            ? this.readNullableNumber(stats.homeAverageGoalsScored)
            : this.readNullableNumber(stats.awayAverageGoalsScored)
          : null,
        sample: stats
          ? isHome
            ? this.readNumber(stats.homePlayed)
            : this.readNumber(stats.awayPlayed)
          : 0,
        weight: 0.16,
      },

      {
        value: profile
          ? this.readNullableNumber(profile.averageGoalsScored)
          : null,
        sample: profile ? this.readNumber(profile.matchesAnalyzed) : 0,
        weight: 0.07,
      },

      {
        value: profile
          ? isHome
            ? this.readNullableNumber(profile.homeAverageGoalsScored)
            : this.readNullableNumber(profile.awayAverageGoalsScored)
          : null,
        sample: profile
          ? isHome
            ? this.readNumber(profile.homeMatches)
            : this.readNumber(profile.awayMatches)
          : 0,
        weight: 0.12,
      },

      {
        value: stats
          ? this.readNullableNumber(stats.averageExpectedGoals)
          : null,
        sample: stats ? this.readNumber(stats.played) : 0,
        weight: 0.09,
      },
    ];
  }

  private static collectDefenceEvidence(
    opponent: RawPredictionFeatures['away'],
    opponentIsHome: boolean,
  ): Array<{
    value: number | null;
    sample: number;
    weight: number;
  }> {
    const stats = opponent.sourceData?.competitionStats;

    const profile = opponent.sourceData?.performanceProfile;

    return [
      {
        value: this.readNullableNumber(opponent.averageGoalsConceded),
        sample: this.readNumber(opponent.sampleSize),
        weight: 0.12,
      },

      {
        value: this.readNullableNumber(opponent.recent.averageGoalsConceded),
        sample: this.readNumber(opponent.recent.sampleSize),
        weight: 0.08,
      },

      {
        value: this.readNullableNumber(opponent.venue.averageGoalsConceded),
        sample: this.readNumber(opponent.venue.sampleSize),
        weight: 0.12,
      },

      {
        value: stats
          ? this.readNullableNumber(stats.averageGoalsConceded)
          : null,
        sample: stats ? this.readNumber(stats.played) : 0,
        weight: 0.12,
      },

      {
        value: stats
          ? opponentIsHome
            ? this.readNullableNumber(stats.homeAverageGoalsConceded)
            : this.readNullableNumber(stats.awayAverageGoalsConceded)
          : null,
        sample: stats
          ? opponentIsHome
            ? this.readNumber(stats.homePlayed)
            : this.readNumber(stats.awayPlayed)
          : 0,
        weight: 0.16,
      },

      {
        value: profile
          ? this.readNullableNumber(profile.averageGoalsConceded)
          : null,
        sample: profile ? this.readNumber(profile.matchesAnalyzed) : 0,
        weight: 0.08,
      },

      {
        value: profile
          ? opponentIsHome
            ? this.readNullableNumber(profile.homeAverageGoalsConceded)
            : this.readNullableNumber(profile.awayAverageGoalsConceded)
          : null,
        sample: profile
          ? opponentIsHome
            ? this.readNumber(profile.homeMatches)
            : this.readNumber(profile.awayMatches)
          : 0,
        weight: 0.13,
      },

      {
        value: this.getDefensiveAdjustedConcession(opponent),
        sample: this.readNumber(opponent.sampleSize),
        weight: 0.07,
      },
    ];
  }

  private static getDefensiveAdjustedConcession(
    team: RawPredictionFeatures['home'],
  ): number | null {
    const base = this.safePositive(team.averageGoalsConceded);

    if (base <= 0) {
      return null;
    }

    const cleanSheet = this.clamp(team.cleanSheetRate ?? 0, 0, 1);

    const failedToScore = this.clamp(team.failedToScoreRate ?? 0, 0, 1);

    const multiplier = 1 - cleanSheet * 0.12 - failedToScore * 0.06;

    return Math.max(base * multiplier, 0.05);
  }

  private static calculateStandingAdjustment(
    features: RawPredictionFeatures,
    isHome: boolean,
  ): number {
    const own = isHome ? features.standings.home : features.standings.away;

    const opponent = isHome ? features.standings.away : features.standings.home;

    if (!own || !opponent) {
      return 0;
    }

    const ownPoints = Math.max(this.readNumber(own.points), 0);

    const opponentPoints = Math.max(this.readNumber(opponent.points), 0);

    const total = ownPoints + opponentPoints;

    if (total <= 0) {
      return 0;
    }

    /*
     * own is already side-specific.
     *
     * A stronger away side must receive a positive adjustment,
     * not a negative one.
     */
    const pointShare = ownPoints / total;

    return this.clamp((pointShare - 0.5) * 0.1, -0.05, 0.05);
  }

  private static buildDirectionalEmpiricalMatrix(
    features: RawPredictionFeatures,
  ): number[][] {
    const matrix = Array.from(
      {
        length: MAX_GOALS + 1,
      },
      () => new Array<number>(MAX_GOALS + 1).fill(0),
    );

    /*
     * Complete historical sample.
     */
    for (const match of features.home.historical) {
      const teamWasHome = match.homeTeamId === features.homeTeamId;

      const currentHomeGoals = teamWasHome ? match.homeGoals : match.awayGoals;

      const currentAwayGoals = teamWasHome ? match.awayGoals : match.homeGoals;

      this.addHistoricalScore(matrix, currentHomeGoals, currentAwayGoals);
    }

    for (const match of features.away.historical) {
      const teamWasHome = match.homeTeamId === features.awayTeamId;

      const currentAwayGoals = teamWasHome ? match.homeGoals : match.awayGoals;

      const currentHomeGoals = teamWasHome ? match.awayGoals : match.homeGoals;

      this.addHistoricalScore(matrix, currentHomeGoals, currentAwayGoals);
    }

    return this.normalizeMatrix(matrix);
  }

  private static addHistoricalScore(
    matrix: number[][],
    homeGoals: number,
    awayGoals: number,
  ): void {
    if (!Number.isFinite(homeGoals) || !Number.isFinite(awayGoals)) {
      return;
    }

    const safeHome = this.clampInteger(homeGoals, 0, MAX_GOALS);

    const safeAway = this.clampInteger(awayGoals, 0, MAX_GOALS);

    matrix[safeHome][safeAway] += 1;
  }

  private static getEmpiricalWeight(features: RawPredictionFeatures): number {
    const totalSample =
      features.home.historical.length + features.away.historical.length;

    if (totalSample <= 0) {
      return 0;
    }

    return this.clamp(0.04 + Math.min(totalSample / 300, 0.1), 0.04, 0.14);
  }

  private static blendMatrices(
    poisson: number[][],
    empirical: number[][],
    empiricalWeight: number,
  ): number[][] {
    const weight = this.clamp(empiricalWeight, 0, 0.2);

    return poisson.map((row, homeGoals) =>
      row.map(
        (value, awayGoals) =>
          value * (1 - weight) +
          (empirical[homeGoals]?.[awayGoals] ?? 0) * weight,
      ),
    );
  }

  private static buildScoreMatrix(home: number[], away: number[]): number[][] {
    return home.map((homeProbability) =>
      away.map((awayProbability) => homeProbability * awayProbability),
    );
  }

  private static buildPoissonDistribution(lambda: number): number[] {
    const probabilities = new Array<number>(MAX_GOALS + 1).fill(0);

    const safeLambda = this.clamp(lambda, 0, MAX_TEAM_LAMBDA);

    probabilities[0] = Math.exp(-safeLambda);

    for (let goals = 1; goals <= MAX_GOALS; goals += 1) {
      probabilities[goals] = probabilities[goals - 1] * (safeLambda / goals);
    }

    return this.normalize(probabilities);
  }

  private static normalizeMatrix(matrix: number[][]): number[][] {
    const total = matrix.reduce(
      (sum, row) =>
        sum +
        row.reduce((rowSum, value) => rowSum + this.nonNegative(value), 0),
      0,
    );

    if (total <= 0) {
      const cells = (MAX_GOALS + 1) * (MAX_GOALS + 1);

      const equal = cells > 0 ? 1 / cells : 0;

      return matrix.map((row) => row.map(() => equal));
    }

    return matrix.map((row) =>
      row.map((value) => this.nonNegative(value) / total),
    );
  }

  private static sumHomeGoals(matrix: number[][]): number[] {
    return Array.from(
      {
        length: MAX_GOALS + 1,
      },
      (_, homeGoals) => this.sum(matrix[homeGoals] ?? []),
    );
  }

  private static sumAwayGoals(matrix: number[][]): number[] {
    return Array.from(
      {
        length: MAX_GOALS + 1,
      },
      (_, awayGoals) => this.sum(matrix.map((row) => row[awayGoals] ?? 0)),
    );
  }

  private static sumTotalGoals(matrix: number[][]): number[] {
    const result = new Array<number>(MAX_GOALS * 2 + 1).fill(0);

    for (let homeGoals = 0; homeGoals <= MAX_GOALS; homeGoals += 1) {
      for (let awayGoals = 0; awayGoals <= MAX_GOALS; awayGoals += 1) {
        result[homeGoals + awayGoals] += matrix[homeGoals][awayGoals] ?? 0;
      }
    }

    return this.normalize(result);
  }

  private static calculateHomeWin(matrix: number[][]): number {
    let probability = 0;

    for (let homeGoals = 0; homeGoals <= MAX_GOALS; homeGoals += 1) {
      for (let awayGoals = 0; awayGoals <= MAX_GOALS; awayGoals += 1) {
        if (homeGoals > awayGoals) {
          probability += matrix[homeGoals][awayGoals] ?? 0;
        }
      }
    }

    return this.clamp(probability);
  }

  private static calculateDraw(matrix: number[][]): number {
    let probability = 0;

    for (let goals = 0; goals <= MAX_GOALS; goals += 1) {
      probability += matrix[goals]?.[goals] ?? 0;
    }

    return this.clamp(probability);
  }

  private static calculateAwayWin(matrix: number[][]): number {
    let probability = 0;

    for (let homeGoals = 0; homeGoals <= MAX_GOALS; homeGoals += 1) {
      for (let awayGoals = 0; awayGoals <= MAX_GOALS; awayGoals += 1) {
        if (awayGoals > homeGoals) {
          probability += matrix[homeGoals][awayGoals] ?? 0;
        }
      }
    }

    return this.clamp(probability);
  }

  private static buildHalfTimeModel(
    features: RawPredictionFeatures,
  ): GoalModelResult['halfTime'] {
    const homeLambda = this.getHalfLambda(features.home, features.away, true);

    const awayLambda = this.getHalfLambda(features.away, features.home, false);

    const home = this.buildPoissonDistribution(homeLambda);

    const away = this.buildPoissonDistribution(awayLambda);

    const matrix = this.normalizeMatrix(this.buildScoreMatrix(home, away));

    return {
      homeGoals: this.sumHomeGoals(matrix),

      awayGoals: this.sumAwayGoals(matrix),

      totalGoals: this.sumTotalGoals(matrix),

      homeWin: this.calculateHomeWin(matrix),

      draw: this.calculateDraw(matrix),

      awayWin: this.calculateAwayWin(matrix),
    };
  }

  private static buildSecondHalfModel(
    features: RawPredictionFeatures,
  ): GoalModelResult['secondHalf'] {
    const homeLambda = this.getSecondHalfLambda(
      features.home,
      features.away,
      true,
    );

    const awayLambda = this.getSecondHalfLambda(
      features.away,
      features.home,
      false,
    );

    const home = this.buildPoissonDistribution(homeLambda);

    const away = this.buildPoissonDistribution(awayLambda);

    const matrix = this.normalizeMatrix(this.buildScoreMatrix(home, away));

    return {
      homeGoals: this.sumHomeGoals(matrix),

      awayGoals: this.sumAwayGoals(matrix),

      totalGoals: this.sumTotalGoals(matrix),

      homeWin: this.calculateHomeWin(matrix),

      draw: this.calculateDraw(matrix),

      awayWin: this.calculateAwayWin(matrix),
    };
  }

  private static getHalfLambda(
    team: RawPredictionFeatures['home'],
    opponent: RawPredictionFeatures['away'],
    isHome: boolean,
  ): number {
    const scoring = this.getPeriodScoringAverage(team, 'firstHalf');

    const conceding = this.getPeriodScoringAverage(opponent, 'firstHalf', true);

    let lambda = this.combinePeriodEvidence(
      scoring,
      conceding,
      team,
      isHome,
      0.46,
    );

    if (lambda === null || !Number.isFinite(lambda) || lambda <= 0) {
      const fullMatch = this.safePositive(team.averageGoalsScored);

      lambda =
        fullMatch > 0
          ? fullMatch * 0.46
          : isHome
            ? DEFAULT_HOME_GOALS * 0.46
            : DEFAULT_AWAY_GOALS * 0.45;
    }

    return this.clamp(lambda, 0.03, 2.5);
  }

  private static getSecondHalfLambda(
    team: RawPredictionFeatures['home'],
    opponent: RawPredictionFeatures['away'],
    isHome: boolean,
  ): number {
    const scoring = this.getPeriodScoringAverage(team, 'secondHalf');

    const conceding = this.getPeriodScoringAverage(
      opponent,
      'secondHalf',
      true,
    );

    let lambda = this.combinePeriodEvidence(
      scoring,
      conceding,
      team,
      isHome,
      0.54,
    );

    if (lambda === null || !Number.isFinite(lambda) || lambda <= 0) {
      const fullMatch = this.safePositive(team.averageGoalsScored);

      lambda =
        fullMatch > 0
          ? fullMatch * 0.54
          : isHome
            ? DEFAULT_HOME_GOALS * 0.54
            : DEFAULT_AWAY_GOALS * 0.53;
    }

    return this.clamp(lambda, 0.03, 2.5);
  }

  private static getPeriodScoringAverage(
    team: RawPredictionFeatures['home'],
    period: 'firstHalf' | 'secondHalf',
    conceding = false,
  ): number | null {
    const periodData =
      period === 'firstHalf' ? team.firstHalf : team.secondHalf;

    if (!periodData) {
      return null;
    }

    const keys = conceding
      ? ['averageGoalsConceded', 'averageGoalsAgainst', 'goalsConceded']
      : ['averageGoalsScored', 'averageGoalsFor', 'goalsScored'];

    const value = this.readFirstNumber(periodData, keys);

    if (value === null || value < 0) {
      return null;
    }

    return value;
  }

  private static combinePeriodEvidence(
    scoring: number | null,
    conceding: number | null,
    team: RawPredictionFeatures['home'],
    isHome: boolean,
    scoringFactor: number,
  ): number | null {
    const available: number[] = [];

    if (scoring !== null && scoring >= 0) {
      available.push(scoring);
    }

    if (conceding !== null && conceding >= 0) {
      available.push(conceding);
    }

    if (available.length < 2) {
      const overallScoring = this.safePositive(team.averageGoalsScored);

      if (overallScoring > 0) {
        available.push(overallScoring * scoringFactor);
      }
    }

    if (!available.length) {
      return null;
    }

    const directAverage = this.average(available);

    const venueScoring = this.safePositive(team.venue.averageGoalsScored);

    const overallScoring = this.safePositive(team.averageGoalsScored);

    let lambda = directAverage;

    if (venueScoring > 0 && overallScoring > 0) {
      const venueRatio = this.clamp(venueScoring / overallScoring, 0.75, 1.35);

      lambda *= 0.9 + venueRatio * 0.1;
    }

    lambda *= isHome ? 1.03 : 0.99;

    return lambda;
  }

  private static getH2HWeight(sampleSize: number): number {
    if (sampleSize < 3) {
      return 0;
    }

    if (sampleSize < 5) {
      return 0.02;
    }

    if (sampleSize < 10) {
      return 0.04;
    }

    return 0.06;
  }

  private static weightedEvidenceAverage(
    values: Array<{
      value: number | null;
      sample: number;
      weight: number;
    }>,
  ): number | null {
    let weightedValue = 0;

    let totalWeight = 0;

    for (const entry of values) {
      if (
        entry.value === null ||
        !Number.isFinite(entry.value) ||
        entry.value < 0 ||
        !Number.isFinite(entry.sample) ||
        entry.sample <= 0 ||
        !Number.isFinite(entry.weight) ||
        entry.weight <= 0
      ) {
        continue;
      }

      const reliability = this.sampleReliability(entry.sample);

      if (reliability <= 0) {
        continue;
      }

      const effectiveWeight = entry.weight * reliability;

      weightedValue += entry.value * effectiveWeight;

      totalWeight += effectiveWeight;
    }

    if (totalWeight <= 0) {
      return null;
    }

    return weightedValue / totalWeight;
  }

  private static sampleReliability(sampleSize: number): number {
    if (!Number.isFinite(sampleSize) || sampleSize <= 0) {
      return 0;
    }

    return this.clamp(1 - Math.exp(-sampleSize / 25), 0, 1);
  }

  private static readNumber(value: unknown): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? Math.max(value, 0) : 0;
    }

    const number = Number(value);

    return Number.isFinite(number) ? Math.max(number, 0) : 0;
  }

  private static readNullableNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const number = Number(value);

    return Number.isFinite(number) ? number : null;
  }

  private static readFirstNumber(
    source: object,
    keys: string[],
  ): number | null {
    const record = source as Record<string, unknown>;

    for (const key of keys) {
      const value = this.readNullableNumber(record[key]);

      if (value !== null) {
        return value;
      }
    }

    return null;
  }

  private static safeNumber(value: unknown): number {
    const number = Number(value);

    return Number.isFinite(number) ? number : 0;
  }

  private static safePositive(value: number | null | undefined): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      return 0;
    }

    return value;
  }

  private static expectedValue(probabilities: number[]): number {
    return probabilities.reduce(
      (sum, probability, index) => sum + probability * index,
      0,
    );
  }

  private static normalize(values: number[]): number[] {
    const safe = values.map((value) => this.nonNegative(value));

    const total = this.sum(safe);

    if (total <= 0) {
      return safe.map(() => (safe.length > 0 ? 1 / safe.length : 0));
    }

    return safe.map((value) => value / total);
  }

  private static average(values: number[]): number {
    if (!values.length) {
      return 0;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private static sum(values: number[]): number {
    return values.reduce((sum, value) => sum + this.nonNegative(value), 0);
  }

  private static nonNegative(value: number): number {
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  private static clamp(value: number, minimum = 0, maximum = 1): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }

  private static clampInteger(
    value: number,
    minimum: number,
    maximum: number,
  ): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(Math.round(value), minimum), maximum);
  }
}
