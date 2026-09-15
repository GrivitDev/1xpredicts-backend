import { RawPredictionFeatures } from '../../interfaces/raw-prediction-features.interface';

const MAX_GOALS = 10;

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

    const homeGoalProbabilities = this.buildPoissonDistribution(homeLambda);

    const awayGoalProbabilities = this.buildPoissonDistribution(awayLambda);

    const matrix = this.buildScoreMatrix(
      homeGoalProbabilities,
      awayGoalProbabilities,
    );

    const empiricalMatrix = this.buildEmpiricalMatrix(features);

    const blendedMatrix = this.blendMatrices(
      matrix,
      empiricalMatrix,
      this.getEmpiricalWeight(features),
    );

    const normalizedMatrix = this.normalizeMatrix(blendedMatrix);

    const homeGoalProbabilitiesFromMatrix = this.sumHomeGoals(normalizedMatrix);

    const awayGoalProbabilitiesFromMatrix = this.sumAwayGoals(normalizedMatrix);

    const totalGoalProbabilities = this.sumTotalGoals(normalizedMatrix);

    const halfTime = this.buildHalfTimeModel(features);

    const secondHalf = this.buildSecondHalfModel(features);

    return {
      matrix: normalizedMatrix,
      homeGoals: homeGoalProbabilitiesFromMatrix,
      awayGoals: awayGoalProbabilitiesFromMatrix,
      totalGoals: totalGoalProbabilities,

      homeWin: this.calculateHomeWin(normalizedMatrix),
      draw: this.calculateDraw(normalizedMatrix),
      awayWin: this.calculateAwayWin(normalizedMatrix),

      homeLambda,
      awayLambda,

      expectedHomeGoals: this.expectedValue(homeGoalProbabilitiesFromMatrix),

      expectedAwayGoals: this.expectedValue(awayGoalProbabilitiesFromMatrix),

      expectedTotalGoals: this.expectedValue(totalGoalProbabilities),

      homeGoalProbabilities: homeGoalProbabilitiesFromMatrix,

      awayGoalProbabilities: awayGoalProbabilitiesFromMatrix,

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
    const venue = isHome ? team.venue : team.venue;

    const overall = this.safePositive(team.averageGoalsScored);

    const venueScoring = this.safePositive(venue?.averageGoalsScored);

    const opponentConceding = this.safePositive(
      isHome
        ? features.away.averageGoalsConceded
        : features.home.averageGoalsConceded,
    );

    const opponentVenueConceding = this.safePositive(
      isHome
        ? features.away.venue?.averageGoalsConceded
        : features.home.venue?.averageGoalsConceded,
    );

    const recent = this.safePositive(team.recent?.averageGoalsScored);

    const baseScoring = this.weightedAverage([
      {
        value: venueScoring,
        weight: this.getSampleWeight(venue?.sampleSize ?? 0, 0.45),
      },
      {
        value: overall,
        weight: this.getSampleWeight(team.sampleSize, 0.3),
      },
      {
        value: recent,
        weight: this.getSampleWeight(team.recent?.sampleSize ?? 0, 0.15),
      },
    ]);

    const defensiveExpectation = this.weightedAverage([
      {
        value: opponentVenueConceding,
        weight: this.getSampleWeight(
          features.away.venue?.sampleSize ?? 0,
          0.45,
        ),
      },
      {
        value: opponentConceding,
        weight: this.getSampleWeight(
          isHome ? features.away.sampleSize : features.home.sampleSize,
          0.3,
        ),
      },
    ]);

    let lambda = this.weightedAverage([
      {
        value: baseScoring,
        weight: 0.55,
      },
      {
        value: defensiveExpectation,
        weight: 0.45,
      },
    ]);

    const h2h = features.h2h;
    const h2hGoals = h2h?.averageGoalsForTeam;

    if (
      typeof h2hGoals === 'number' &&
      Number.isFinite(h2hGoals) &&
      h2hGoals >= 0 &&
      h2h
    ) {
      const h2hWeight = this.getH2HWeight(h2h.sampleSize);

      lambda = lambda * (1 - h2hWeight) + h2hGoals * h2hWeight;
    }

    const firstHalfRate = this.safeRate(team.firstHalf.averageGoalsScored);

    const secondHalfRate = this.safeRate(team.secondHalf.averageGoalsScored);

    const timingSignal = firstHalfRate + secondHalfRate;

    if (timingSignal > 0 && Number.isFinite(timingSignal)) {
      const timingAverage = timingSignal / 2;

      lambda = lambda * 0.92 + timingAverage * 0.08;
    }

    const floor = isHome ? 0.05 : 0.04;

    const cap = 5;

    return this.clamp(Math.max(lambda, floor), 0, cap);
  }

  private static buildPoissonDistribution(lambda: number): number[] {
    const probabilities = new Array<number>(MAX_GOALS + 1).fill(0);

    const safeLambda = this.clamp(lambda, 0, 5);

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
    const matrix = Array.from({ length: MAX_GOALS + 1 }, () =>
      new Array<number>(MAX_GOALS + 1).fill(0),
    );

    const historical = [
      ...(features.home.historical ?? []),
      ...(features.away.historical ?? []),
    ];

    const completed = historical.filter((match) => match.completed);

    if (!completed.length) {
      return matrix;
    }

    for (const match of completed) {
      const homeGoals = Math.min(
        Math.max(Math.round(Number(match.homeGoals ?? 0)), 0),
        MAX_GOALS,
      );

      const awayGoals = Math.min(
        Math.max(Math.round(Number(match.awayGoals ?? 0)), 0),
        MAX_GOALS,
      );

      matrix[homeGoals][awayGoals]++;
    }

    return this.normalizeMatrix(matrix);
  }

  private static getEmpiricalWeight(features: RawPredictionFeatures): number {
    const historicalSample = Math.max(
      features.home.historical?.length ?? 0,
      features.away.historical?.length ?? 0,
    );

    if (historicalSample < 5) {
      return 0;
    }

    if (historicalSample < 10) {
      return 0.08;
    }

    if (historicalSample < 20) {
      return 0.15;
    }

    if (historicalSample < 30) {
      return 0.22;
    }

    return 0.28;
  }

  private static blendMatrices(
    poisson: number[][],
    empirical: number[][],
    empiricalWeight: number,
  ): number[][] {
    const weight = this.clamp(empiricalWeight, 0, 0.35);

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
      const equal = 1 / ((MAX_GOALS + 1) * (MAX_GOALS + 1));

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
        result[homeGoals + awayGoals] += matrix[homeGoals][awayGoals];
      }
    }

    return this.normalize(result);
  }

  private static calculateHomeWin(matrix: number[][]): number {
    let probability = 0;

    for (let homeGoals = 0; homeGoals <= MAX_GOALS; homeGoals++) {
      for (let awayGoals = 0; awayGoals <= MAX_GOALS; awayGoals++) {
        if (homeGoals > awayGoals) {
          probability += matrix[homeGoals][awayGoals];
        }
      }
    }

    return this.clamp(probability);
  }

  private static calculateDraw(matrix: number[][]): number {
    let probability = 0;

    for (let goals = 0; goals <= MAX_GOALS; goals++) {
      probability += matrix[goals][goals];
    }

    return this.clamp(probability);
  }

  private static calculateAwayWin(matrix: number[][]): number {
    let probability = 0;

    for (let homeGoals = 0; homeGoals <= MAX_GOALS; homeGoals++) {
      for (let awayGoals = 0; awayGoals <= MAX_GOALS; awayGoals++) {
        if (awayGoals > homeGoals) {
          probability += matrix[homeGoals][awayGoals];
        }
      }
    }

    return this.clamp(probability);
  }

  private static buildHalfTimeModel(
    features: RawPredictionFeatures,
  ): GoalModelResult['halfTime'] {
    const homeLambda = this.getHalfLambda(features.home);

    const awayLambda = this.getHalfLambda(features.away);

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
    const homeLambda = this.getSecondHalfLambda(features.home);

    const awayLambda = this.getSecondHalfLambda(features.away);

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

  private static getHalfLambda(team: RawPredictionFeatures['home']): number {
    const firstHalf = this.safePositive(team.firstHalf.averageGoalsScored);

    if (firstHalf > 0) {
      return this.clamp(firstHalf, 0.01, 3);
    }

    return this.clamp(
      this.safePositive(team.averageGoalsScored) * 0.45,
      0.01,
      3,
    );
  }

  private static getSecondHalfLambda(
    team: RawPredictionFeatures['home'],
  ): number {
    const secondHalf = this.safePositive(team.secondHalf.averageGoalsScored);

    if (secondHalf > 0) {
      return this.clamp(secondHalf, 0.01, 3);
    }

    const total = this.safePositive(team.averageGoalsScored);

    return this.clamp(total * 0.55, 0.01, 3);
  }

  private static getSampleWeight(
    sampleSize: number,
    baseWeight: number,
  ): number {
    const reliability = 1 - Math.exp(-Math.max(sampleSize, 0) / 12);

    return baseWeight * reliability;
  }

  private static getH2HWeight(sampleSize: number): number {
    if (sampleSize < 3) {
      return 0;
    }

    if (sampleSize < 5) {
      return 0.03;
    }

    if (sampleSize < 10) {
      return 0.05;
    }

    return 0.08;
  }

  private static weightedAverage(
    values: Array<{
      value: number;
      weight: number;
    }>,
  ): number {
    const valid = values.filter(
      (entry) =>
        Number.isFinite(entry.value) && entry.value >= 0 && entry.weight > 0,
    );

    if (!valid.length) {
      return 0;
    }

    const totalWeight = valid.reduce((sum, entry) => sum + entry.weight, 0);

    if (totalWeight <= 0) {
      return 0;
    }

    return (
      valid.reduce((sum, entry) => sum + entry.value * entry.weight, 0) /
      totalWeight
    );
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
      return safe.map(() => (safe.length ? 1 / safe.length : 0));
    }

    return safe.map((value) => value / total);
  }

  private static safePositive(value: number | undefined | null): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      return 0;
    }

    return value;
  }

  private static safeRate(value: number | undefined | null): number {
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

  private static clamp(value: number, minimum = 0, maximum = 1): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
