// src/predictions-engine/engines/probability/raw-goal-model.util.ts

import { RawPredictionFeatures } from '../../interfaces/raw-prediction-features.interface';

const MAX_GOALS = 10;

const DEFAULT_HOME_GOALS = 1.2;
const DEFAULT_AWAY_GOALS = 1.05;

const MAX_TEAM_LAMBDA = 3.5;

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
    const homeLambda = this.calculateTeamLambda(features.home, true, features);

    const awayLambda = this.calculateTeamLambda(features.away, false, features);

    const poissonHome = this.buildPoissonDistribution(homeLambda);

    const poissonAway = this.buildPoissonDistribution(awayLambda);

    const poissonMatrix = this.buildScoreMatrix(poissonHome, poissonAway);

    const empiricalMatrix = this.buildEmpiricalMatrix(features);

    const empiricalWeight = this.getEmpiricalWeight(features);

    const blendedMatrix = this.blendMatrices(
      poissonMatrix,
      empiricalMatrix,
      empiricalWeight,
    );

    const normalizedMatrix = this.normalizeMatrix(blendedMatrix);

    const homeGoalProbabilities = this.sumHomeGoals(normalizedMatrix);

    const awayGoalProbabilities = this.sumAwayGoals(normalizedMatrix);

    const totalGoalProbabilities = this.sumTotalGoals(normalizedMatrix);

    const halfTime = this.buildHalfTimeModel(features);

    const secondHalf = this.buildSecondHalfModel(features);

    return {
      matrix: normalizedMatrix,

      homeGoals: homeGoalProbabilities,

      awayGoals: awayGoalProbabilities,

      totalGoals: totalGoalProbabilities,

      homeWin: this.calculateHomeWin(normalizedMatrix),

      draw: this.calculateDraw(normalizedMatrix),

      awayWin: this.calculateAwayWin(normalizedMatrix),

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

  static probabilityOver(probabilities: number[], line: number): number {
    return this.clamp(
      probabilities.reduce(
        (sum, probability, goals) => (goals > line ? sum + probability : sum),
        0,
      ),
    );
  }

  static probabilityUnder(probabilities: number[], line: number): number {
    return this.clamp(
      probabilities.reduce(
        (sum, probability, goals) => (goals < line ? sum + probability : sum),
        0,
      ),
    );
  }

  static probabilityExactly(probabilities: number[], goals: number): number {
    if (goals < 0 || goals >= probabilities.length) {
      return 0;
    }

    return this.clamp(probabilities[goals] ?? 0);
  }

  static probabilityAtLeast(probabilities: number[], goals: number): number {
    if (goals <= 0) {
      return 1;
    }

    if (goals >= probabilities.length) {
      return 0;
    }

    return this.clamp(
      probabilities.reduce(
        (sum, probability, index) => (index >= goals ? sum + probability : sum),
        0,
      ),
    );
  }

  private static calculateTeamLambda(
    team: RawPredictionFeatures['home'],
    isHome: boolean,
    features: RawPredictionFeatures,
  ): number {
    const scoringPrior = isHome ? DEFAULT_HOME_GOALS : DEFAULT_AWAY_GOALS;

    const opponent = isHome ? features.away : features.home;

    const teamOverallScoring = this.safePositive(team.averageGoalsScored);

    const teamRecentScoring = this.safePositive(
      team.recent?.averageGoalsScored,
    );

    const teamVenueScoring = this.safePositive(team.venue?.averageGoalsScored);

    const opponentOverallConceding = this.safePositive(
      opponent.averageGoalsConceded,
    );

    const opponentVenueConceding = this.safePositive(
      opponent.venue?.averageGoalsConceded,
    );

    /*
     * ----------------------------------------------------------
     * ATTACKING BASE
     * ----------------------------------------------------------
     *
     * Recent form and venue performance receive more weight than
     * the complete historical average, but sparse samples are
     * automatically shrunk toward the prior.
     */
    const attackInputs = [
      {
        value: teamVenueScoring,
        sample: team.venue?.sampleSize ?? 0,
        weight: 0.4,
      },
      {
        value: teamRecentScoring,
        sample: team.recent?.sampleSize ?? 0,
        weight: 0.3,
      },
      {
        value: teamOverallScoring,
        sample: team.sampleSize,
        weight: 0.3,
      },
    ];

    const attackingExpectation = this.weightedEvidenceAverage(
      attackInputs,
      scoringPrior,
    );

    /*
     * ----------------------------------------------------------
     * OPPOSITION DEFENCE
     * ----------------------------------------------------------
     */
    const defensiveInputs = [
      {
        value: opponentVenueConceding,
        sample: opponent.venue?.sampleSize ?? 0,
        weight: 0.55,
      },
      {
        value: opponentOverallConceding,
        sample: opponent.sampleSize,
        weight: 0.45,
      },
    ];

    const defensiveExpectation = this.weightedEvidenceAverage(
      defensiveInputs,
      isHome ? DEFAULT_AWAY_GOALS : DEFAULT_HOME_GOALS,
    );

    /*
     * ----------------------------------------------------------
     * CORE EXPECTED GOALS
     * ----------------------------------------------------------
     *
     * The team attack and opponent defence must both contribute.
     */
    let lambda = attackingExpectation * 0.58 + defensiveExpectation * 0.42;

    /*
     * ----------------------------------------------------------
     * RECENT FORM ADJUSTMENT
     * ----------------------------------------------------------
     *
     * Recent performance should move the prediction, but never
     * overpower the broader evidence.
     */
    const recentSample = Math.max(team.recent?.sampleSize ?? 0, 0);

    if (recentSample > 0 && teamOverallScoring > 0 && teamRecentScoring > 0) {
      const recentReliability = this.sampleReliability(recentSample);

      const recentDifference = teamRecentScoring - teamOverallScoring;

      const recentAdjustment = recentDifference * recentReliability * 0.2;

      lambda += recentAdjustment;
    }

    /*
     * ----------------------------------------------------------
     * VENUE ADJUSTMENT
     * ----------------------------------------------------------
     */
    const venueSample = Math.max(team.venue?.sampleSize ?? 0, 0);

    if (venueSample > 0 && teamOverallScoring > 0 && teamVenueScoring > 0) {
      const venueReliability = this.sampleReliability(venueSample);

      const venueDifference = teamVenueScoring - teamOverallScoring;

      const venueAdjustment = venueDifference * venueReliability * 0.18;

      lambda += venueAdjustment;
    }

    /*
     * ----------------------------------------------------------
     * H2H
     * ----------------------------------------------------------
     *
     * H2H is supplementary only.
     */
    const h2h = features.h2h;

    const h2hGoals = h2h?.averageGoalsForTeam;

    if (
      typeof h2hGoals === 'number' &&
      Number.isFinite(h2hGoals) &&
      h2hGoals >= 0 &&
      (h2h?.sampleSize ?? 0) >= 3
    ) {
      const h2hWeight = this.getH2HWeight(h2h?.sampleSize ?? 0);

      lambda = lambda * (1 - h2hWeight) + h2hGoals * h2hWeight;
    }

    /*
     * ----------------------------------------------------------
     * TIMING DATA
     * ----------------------------------------------------------
     *
     * Only use timing information when ESPN-derived values are
     * actually available.
     */
    const firstHalfRate = this.safePositive(team.firstHalf?.averageGoalsScored);

    const secondHalfRate = this.safePositive(
      team.secondHalf?.averageGoalsScored,
    );

    const timingValues = [firstHalfRate, secondHalfRate].filter(
      (value) => value > 0,
    );

    if (timingValues.length > 0) {
      const timingAverage = this.average(timingValues);

      const timingReliability = this.clamp(timingValues.length / 2);

      lambda =
        lambda * (1 - timingReliability * 0.05) +
        timingAverage * (timingReliability * 0.05);
    }

    /*
     * ----------------------------------------------------------
     * DATA SHRINKAGE
     * ----------------------------------------------------------
     *
     * Sparse data must remain close to the league-neutral prior.
     */
    const teamReliability = this.getTeamSampleReliability(team);

    const shrinkage = (1 - teamReliability) * 0.35;

    lambda = lambda * (1 - shrinkage) + scoringPrior * shrinkage;

    /*
     * Prevent unrealistic expectations while still allowing
     * genuinely strong teams to generate stronger predictions.
     */
    const floor = isHome ? 0.15 : 0.12;

    return this.clamp(Math.max(lambda, floor), 0, MAX_TEAM_LAMBDA);
  }

  private static buildPoissonDistribution(lambda: number): number[] {
    const probabilities = new Array<number>(MAX_GOALS + 1).fill(0);

    const safeLambda = this.clamp(lambda, 0, MAX_TEAM_LAMBDA);

    probabilities[0] = Math.exp(-safeLambda);

    for (let goals = 1; goals <= MAX_GOALS; goals++) {
      probabilities[goals] = probabilities[goals - 1] * (safeLambda / goals);
    }

    return this.normalize(probabilities);
  }

  private static buildScoreMatrix(home: number[], away: number[]): number[][] {
    return home.map((homeProbability) =>
      away.map((awayProbability) => homeProbability * awayProbability),
    );
  }

  private static buildEmpiricalMatrix(
    features: RawPredictionFeatures,
  ): number[][] {
    const matrix = Array.from(
      {
        length: MAX_GOALS + 1,
      },
      () => new Array<number>(MAX_GOALS + 1).fill(0),
    );

    const historical = [
      ...(features.home.historical ?? []),
      ...(features.away.historical ?? []),
    ];

    const completed = historical.filter((match) => match.completed === true);

    if (!completed.length) {
      return matrix;
    }

    /*
     * Historical matches are not necessarily aligned to the
     * current fixture's home/away orientation.
     *
     * We therefore use them as a generic score-shape component,
     * while the current Poisson model controls direction.
     */
    for (const match of completed) {
      const homeGoals = Math.min(
        Math.max(Math.round(Number(match.homeGoals ?? 0)), 0),
        MAX_GOALS,
      );

      const awayGoals = Math.min(
        Math.max(Math.round(Number(match.awayGoals ?? 0)), 0),
        MAX_GOALS,
      );

      if (homeGoals === awayGoals) {
        matrix[homeGoals][awayGoals] += 1;

        continue;
      }

      matrix[homeGoals][awayGoals] += 0.5;

      matrix[awayGoals][homeGoals] += 0.5;
    }

    return this.normalizeMatrix(matrix);
  }

  private static getEmpiricalWeight(features: RawPredictionFeatures): number {
    const homeSample = Math.max(features.home.historical?.length ?? 0, 0);

    const awaySample = Math.max(features.away.historical?.length ?? 0, 0);

    const balancedSample = Math.min(homeSample, awaySample);

    if (balancedSample < 5) {
      return 0;
    }

    if (balancedSample < 10) {
      return 0.03;
    }

    if (balancedSample < 20) {
      return 0.06;
    }

    if (balancedSample < 30) {
      return 0.09;
    }

    return 0.12;
  }

  private static blendMatrices(
    poisson: number[][],
    empirical: number[][],
    empiricalWeight: number,
  ): number[][] {
    const weight = this.clamp(empiricalWeight, 0, 0.15);

    return poisson.map((row, homeGoals) =>
      row.map(
        (value, awayGoals) =>
          value * (1 - weight) +
          (empirical[homeGoals]?.[awayGoals] ?? 0) * weight,
      ),
    );
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

    for (let homeGoals = 0; homeGoals <= MAX_GOALS; homeGoals++) {
      for (let awayGoals = 0; awayGoals <= MAX_GOALS; awayGoals++) {
        result[homeGoals + awayGoals] += matrix[homeGoals][awayGoals] ?? 0;
      }
    }

    return this.normalize(result);
  }

  private static calculateHomeWin(matrix: number[][]): number {
    let probability = 0;

    for (let homeGoals = 0; homeGoals <= MAX_GOALS; homeGoals++) {
      for (let awayGoals = 0; awayGoals <= MAX_GOALS; awayGoals++) {
        if (homeGoals > awayGoals) {
          probability += matrix[homeGoals][awayGoals] ?? 0;
        }
      }
    }

    return this.clamp(probability);
  }

  private static calculateDraw(matrix: number[][]): number {
    let probability = 0;

    for (let goals = 0; goals <= MAX_GOALS; goals++) {
      probability += matrix[goals]?.[goals] ?? 0;
    }

    return this.clamp(probability);
  }

  private static calculateAwayWin(matrix: number[][]): number {
    let probability = 0;

    for (let homeGoals = 0; homeGoals <= MAX_GOALS; homeGoals++) {
      for (let awayGoals = 0; awayGoals <= MAX_GOALS; awayGoals++) {
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
    const homeLambda = this.getHalfLambda(features.home, true);

    const awayLambda = this.getHalfLambda(features.away, false);

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
    const homeLambda = this.getSecondHalfLambda(features.home, true);

    const awayLambda = this.getSecondHalfLambda(features.away, false);

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
    isHome: boolean,
  ): number {
    const firstHalf = this.safePositive(team.firstHalf?.averageGoalsScored);

    if (firstHalf > 0) {
      return this.clamp(firstHalf, 0.05, 2.5);
    }

    const total = this.safePositive(team.averageGoalsScored);

    const factor = isHome ? 0.46 : 0.45;

    return this.clamp(
      total > 0
        ? total * factor
        : isHome
          ? DEFAULT_HOME_GOALS * factor
          : DEFAULT_AWAY_GOALS * factor,
      0.05,
      2.5,
    );
  }

  private static getSecondHalfLambda(
    team: RawPredictionFeatures['home'],
    isHome: boolean,
  ): number {
    const secondHalf = this.safePositive(team.secondHalf?.averageGoalsScored);

    if (secondHalf > 0) {
      return this.clamp(secondHalf, 0.05, 2.5);
    }

    const total = this.safePositive(team.averageGoalsScored);

    const factor = isHome ? 0.54 : 0.55;

    return this.clamp(
      total > 0
        ? total * factor
        : isHome
          ? DEFAULT_HOME_GOALS * factor
          : DEFAULT_AWAY_GOALS * factor,
      0.05,
      2.5,
    );
  }

  private static getTeamSampleReliability(
    team: RawPredictionFeatures['home'],
  ): number {
    const samples = [
      team.sampleSize,
      team.venue?.sampleSize ?? 0,
      team.recent?.sampleSize ?? 0,
    ].filter((sample) => Number.isFinite(sample) && sample > 0);

    if (!samples.length) {
      return 0;
    }

    const averageSample =
      samples.reduce((sum, sample) => sum + sample, 0) / samples.length;

    return this.sampleReliability(averageSample);
  }

  private static sampleReliability(sampleSize: number): number {
    if (!Number.isFinite(sampleSize) || sampleSize <= 0) {
      return 0;
    }

    return this.clamp(1 - Math.exp(-sampleSize / 18));
  }

  private static getSampleWeight(
    sampleSize: number,
    baseWeight: number,
  ): number {
    return this.clamp(baseWeight, 0, 1) * this.sampleReliability(sampleSize);
  }

  private static weightedEvidenceAverage(
    values: Array<{
      value: number;
      sample: number;
      weight: number;
    }>,
    fallback: number,
  ): number {
    let weightedValue = 0;

    let totalWeight = 0;

    for (const entry of values) {
      if (
        !Number.isFinite(entry.value) ||
        entry.value < 0 ||
        !Number.isFinite(entry.sample) ||
        entry.sample <= 0 ||
        !Number.isFinite(entry.weight) ||
        entry.weight <= 0
      ) {
        continue;
      }

      const sampleReliability = this.sampleReliability(entry.sample);

      const effectiveWeight = entry.weight * sampleReliability;

      weightedValue += entry.value * effectiveWeight;

      totalWeight += effectiveWeight;
    }

    const fallbackWeight = Math.max(1 - totalWeight, 0.15);

    weightedValue += fallback * fallbackWeight;

    totalWeight += fallbackWeight;

    if (totalWeight <= 0) {
      return fallback;
    }

    return weightedValue / totalWeight;
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

  private static safePositive(value: number | null | undefined): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      return 0;
    }

    return value;
  }

  private static nonNegative(value: number): number {
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  private static sum(values: number[]): number {
    return values.reduce((sum, value) => sum + this.nonNegative(value), 0);
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

    return Math.min(Math.max(value, minimum), maximum);
  }
}
