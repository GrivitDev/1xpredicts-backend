// src/predictions-engine/engines/probability/raw-goal-model.util.ts

import { RawPredictionFeatures } from '../../interfaces/raw-prediction-features.interface';

const MAX_GOALS = 10;

const DEFAULT_HOME_GOALS = 1.2;

const DEFAULT_AWAY_GOALS = 1.05;

const MIN_LAMBDA = 0.05;

const MAX_TEAM_LAMBDA = 4.5;

const MIN_BASELINE_SAMPLE = 4;

const MIN_VENUE_SAMPLE = 3;

const MIN_PERIOD_SAMPLE = 3;

const ATTACK_EVIDENCE_WEIGHTS = {
  venue: 0.45,
  opponentAdjusted: 0.3,
  overall: 0.15,
  recent: 0.1,
} as const;

const DEFENCE_EVIDENCE_WEIGHTS = {
  venue: 0.45,
  opponentAdjusted: 0.3,
  overall: 0.15,
  recent: 0.1,
} as const;

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
    available: boolean;

    homeGoals: number[];

    awayGoals: number[];

    totalGoals: number[];

    homeWin: number;

    draw: number;

    awayWin: number;
  };

  secondHalf: {
    available: boolean;

    homeGoals: number[];

    awayGoals: number[];

    totalGoals: number[];

    homeWin: number;

    draw: number;

    awayWin: number;
  };
}

interface GoalBaseline {
  homeGoals: number;

  awayGoals: number;

  sampleSize: number;
}

interface EvidenceValue {
  value: number;

  sampleSize: number;

  weight: number;
}

export class RawGoalModelUtil {
  static calculate(features: RawPredictionFeatures): GoalModelResult {
    const baseline = this.calculateHistoricalBaseline(features);

    const homeLambda = this.calculateTeamLambda(
      features.home,
      features.away,
      true,
      baseline,
    );

    const awayLambda = this.calculateTeamLambda(
      features.away,
      features.home,
      false,
      baseline,
    );

    const homePoisson = this.buildPoissonDistribution(homeLambda);

    const awayPoisson = this.buildPoissonDistribution(awayLambda);

    /*
     * The score model remains a Poisson score distribution.
     *
     * Goal evidence is already incorporated into the lambdas, so it is
     * not blended into the score matrix again.
     */
    const matrix = this.normalizeMatrix(
      this.buildScoreMatrix(homePoisson, awayPoisson),
    );

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

      /*
       * Lambda is the expected-goals estimate.
       *
       * We keep it independent from the truncated 0..10 matrix.
       */
      expectedHomeGoals: homeLambda,

      expectedAwayGoals: awayLambda,

      expectedTotalGoals: homeLambda + awayLambda,

      homeGoalProbabilities,

      awayGoalProbabilities,

      totalGoalProbabilities,

      halfTime,

      secondHalf,
    };
  }

  private static calculateHistoricalBaseline(
    features: RawPredictionFeatures,
  ): GoalBaseline {
    const matches = new Map<
      string,
      {
        homeGoals: number;
        awayGoals: number;
      }
    >();

    /*
     * Phase 1 does not currently expose a competition-wide historical
     * dataset to RawPredictionFeatures.
     *
     * Therefore we retain the existing de-duplicated match-history
     * baseline rather than inventing competition data.
     *
     * This baseline is treated as a prior anchor, not as a competition
     * truth.
     */
    const historicalSources = [
      features.home.historical ?? [],
      features.away.historical ?? [],
    ];

    for (const history of historicalSources) {
      for (const match of history) {
        if (!match.completed) {
          continue;
        }

        if (
          !Number.isFinite(match.homeGoals) ||
          !Number.isFinite(match.awayGoals)
        ) {
          continue;
        }

        if (match.homeGoals < 0 || match.awayGoals < 0) {
          continue;
        }

        if (
          !(match.fixtureDate instanceof Date) ||
          !Number.isFinite(match.fixtureDate.getTime())
        ) {
          continue;
        }

        if (match.fixtureDate >= features.fixtureDate) {
          continue;
        }

        if (!match.eventId) {
          continue;
        }

        matches.set(match.eventId, {
          homeGoals: match.homeGoals,

          awayGoals: match.awayGoals,
        });
      }
    }

    if (matches.size < MIN_BASELINE_SAMPLE) {
      return {
        homeGoals: DEFAULT_HOME_GOALS,

        awayGoals: DEFAULT_AWAY_GOALS,

        sampleSize: matches.size,
      };
    }

    let observedHomeGoals = 0;

    let observedAwayGoals = 0;

    for (const match of matches.values()) {
      observedHomeGoals += match.homeGoals;

      observedAwayGoals += match.awayGoals;
    }

    observedHomeGoals /= matches.size;

    observedAwayGoals /= matches.size;

    /*
     * Do not abruptly switch from the prior to a small-sample empirical
     * baseline.
     *
     * The observed baseline gains influence as the available historical
     * sample becomes stronger.
     */
    const empiricalHomeGoals = this.clamp(observedHomeGoals, 0.6, 2.5);

    const empiricalAwayGoals = this.clamp(observedAwayGoals, 0.4, 2.2);

    const empiricalWeight = this.sampleReliability(matches.size);

    return {
      homeGoals:
        DEFAULT_HOME_GOALS * (1 - empiricalWeight) +
        empiricalHomeGoals * empiricalWeight,

      awayGoals:
        DEFAULT_AWAY_GOALS * (1 - empiricalWeight) +
        empiricalAwayGoals * empiricalWeight,

      sampleSize: matches.size,
    };
  }

  private static calculateTeamLambda(
    team: RawPredictionFeatures['home'],
    opponent: RawPredictionFeatures['away'],
    isHome: boolean,
    baseline: GoalBaseline,
  ): number {
    const attackRate = this.calculateAttackRate(team, isHome, baseline);

    const defensiveRate = this.calculateDefensiveRate(
      opponent,
      !isHome,
      baseline,
    );

    const leagueSideBaseline = isHome ? baseline.homeGoals : baseline.awayGoals;

    /*
     * Relative attack strength:
     *
     * 1.00 = baseline scoring
     * >1.00 = stronger scoring
     * <1.00 = weaker scoring
     */
    const attackStrength =
      leagueSideBaseline > 0 ? attackRate / leagueSideBaseline : 1;

    /*
     * Relative defensive concession strength:
     *
     * 1.00 = baseline concession
     * >1.00 = concedes more than baseline
     * <1.00 = concedes less than baseline
     */
    const defensiveStrength =
      leagueSideBaseline > 0 ? defensiveRate / leagueSideBaseline : 1;

    const safeAttackStrength = this.clamp(attackStrength, 0.35, 2.5);

    const safeDefensiveStrength = this.clamp(defensiveStrength, 0.35, 2.5);

    /*
     * Standard multiplicative strength construction:
     *
     * baseline × attack strength × opponent defensive concession strength
     */
    const lambda =
      leagueSideBaseline * safeAttackStrength * safeDefensiveStrength;

    return this.clamp(
      lambda,
      isHome ? DEFAULT_HOME_GOALS * 0.25 : DEFAULT_AWAY_GOALS * 0.25,
      MAX_TEAM_LAMBDA,
    );
  }

  private static calculateAttackRate(
    team: RawPredictionFeatures['home'],
    isHome: boolean,
    baseline: GoalBaseline,
  ): number {
    const evidence: EvidenceValue[] = [];

    const venueAvailable =
      Boolean(team.dataAvailability?.venueMatches) &&
      team.venue.sampleSize >= MIN_VENUE_SAMPLE;

    if (venueAvailable) {
      const value = this.readNonNegative(team.venue.averageGoalsScored);

      if (value !== null) {
        evidence.push({
          value,

          sampleSize: team.venue.sampleSize,

          weight: ATTACK_EVIDENCE_WEIGHTS.venue,
        });
      }
    }

    if (
      team.opponentAdjusted?.available &&
      team.opponentAdjusted.effectiveSampleSize > 0
    ) {
      const value = this.readNonNegative(
        team.opponentAdjusted.averageGoalsScored,
      );

      if (value !== null) {
        evidence.push({
          value,

          sampleSize: team.opponentAdjusted.effectiveSampleSize,

          weight: ATTACK_EVIDENCE_WEIGHTS.opponentAdjusted,
        });
      }
    }

    if (team.sampleSize > 0) {
      const value = this.readNonNegative(team.averageGoalsScored);

      if (value !== null) {
        evidence.push({
          value,

          sampleSize: team.sampleSize,

          weight: ATTACK_EVIDENCE_WEIGHTS.overall,
        });
      }
    }

    if (team.recent.sampleSize > 0) {
      const value = this.readNonNegative(team.recent.averageGoalsScored);

      if (value !== null) {
        evidence.push({
          value,

          sampleSize: team.recent.sampleSize,

          weight: ATTACK_EVIDENCE_WEIGHTS.recent,
        });
      }
    }

    const fallback = isHome ? baseline.homeGoals : baseline.awayGoals;

    return this.weightedEvidenceAverage(evidence, fallback);
  }

  private static calculateDefensiveRate(
    team: RawPredictionFeatures['home'],
    isHome: boolean,
    baseline: GoalBaseline,
  ): number {
    const evidence: EvidenceValue[] = [];

    const venueAvailable =
      Boolean(team.dataAvailability?.venueMatches) &&
      team.venue.sampleSize >= MIN_VENUE_SAMPLE;

    if (venueAvailable) {
      const value = this.readNonNegative(team.venue.averageGoalsConceded);

      if (value !== null) {
        evidence.push({
          value,

          sampleSize: team.venue.sampleSize,

          weight: DEFENCE_EVIDENCE_WEIGHTS.venue,
        });
      }
    }

    if (
      team.opponentAdjusted?.available &&
      team.opponentAdjusted.effectiveSampleSize > 0
    ) {
      const value = this.readNonNegative(
        team.opponentAdjusted.averageGoalsConceded,
      );

      if (value !== null) {
        evidence.push({
          value,

          sampleSize: team.opponentAdjusted.effectiveSampleSize,

          weight: DEFENCE_EVIDENCE_WEIGHTS.opponentAdjusted,
        });
      }
    }

    if (team.sampleSize > 0) {
      const value = this.readNonNegative(team.averageGoalsConceded);

      if (value !== null) {
        evidence.push({
          value,

          sampleSize: team.sampleSize,

          weight: DEFENCE_EVIDENCE_WEIGHTS.overall,
        });
      }
    }

    if (team.recent.sampleSize > 0) {
      const value = this.readNonNegative(team.recent.averageGoalsConceded);

      if (value !== null) {
        evidence.push({
          value,

          sampleSize: team.recent.sampleSize,

          weight: DEFENCE_EVIDENCE_WEIGHTS.recent,
        });
      }
    }

    /*
     * For a home-goal expectation, the opponent's concession rate is
     * anchored to the home scoring baseline.
     *
     * For an away-goal expectation, it is anchored to the away scoring
     * baseline.
     */
    const fallback = isHome ? baseline.awayGoals : baseline.homeGoals;

    return this.weightedEvidenceAverage(evidence, fallback);
  }

  private static weightedEvidenceAverage(
    evidence: EvidenceValue[],
    fallback: number,
  ): number {
    let weightedValue = 0;

    let effectiveWeightTotal = 0;

    let availableWeightTotal = 0;

    for (const item of evidence) {
      if (
        !Number.isFinite(item.value) ||
        item.value < 0 ||
        !Number.isFinite(item.sampleSize) ||
        item.sampleSize <= 0 ||
        !Number.isFinite(item.weight) ||
        item.weight <= 0
      ) {
        continue;
      }

      availableWeightTotal += item.weight;

      const reliability = this.sampleReliability(item.sampleSize);

      const effectiveWeight = item.weight * reliability;

      if (effectiveWeight <= 0) {
        continue;
      }

      weightedValue += item.value * effectiveWeight;

      effectiveWeightTotal += effectiveWeight;
    }

    const safeFallback = Math.max(this.safeNonNegative(fallback), 0.01);

    if (effectiveWeightTotal <= 0 || !Number.isFinite(weightedValue)) {
      return safeFallback;
    }

    const observedRate = this.clamp(
      weightedValue / effectiveWeightTotal,
      0.05,
      4.5,
    );

    /*
     * Do not renormalize weak evidence into apparent certainty.
     *
     * The evidence weights represent the maximum influence available
     * from each source. Sample reliability determines how much of that
     * influence is actually earned.
     *
     * Any remaining influence stays with the prior/fallback.
     */
    const evidenceCoverage =
      availableWeightTotal > 0
        ? this.clamp(effectiveWeightTotal / availableWeightTotal, 0, 1)
        : 0;

    const result =
      observedRate * evidenceCoverage + safeFallback * (1 - evidenceCoverage);

    return this.clamp(result, 0.05, 4.5);
  }

  private static buildScoreMatrix(home: number[], away: number[]): number[][] {
    return home.map((homeProbability) =>
      away.map((awayProbability) => homeProbability * awayProbability),
    );
  }

  private static buildPoissonDistribution(lambda: number): number[] {
    const probabilities = new Array<number>(MAX_GOALS + 1).fill(0);

    const safeLambda = this.clamp(lambda, MIN_LAMBDA, MAX_TEAM_LAMBDA);

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

    if (total <= 0 || !Number.isFinite(total)) {
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
        result[homeGoals + awayGoals] += matrix[homeGoals]?.[awayGoals] ?? 0;
      }
    }

    return this.normalize(result);
  }

  private static calculateHomeWin(matrix: number[][]): number {
    let probability = 0;

    for (let homeGoals = 0; homeGoals <= MAX_GOALS; homeGoals += 1) {
      for (let awayGoals = 0; awayGoals <= MAX_GOALS; awayGoals += 1) {
        if (homeGoals > awayGoals) {
          probability += matrix[homeGoals]?.[awayGoals] ?? 0;
        }
      }
    }

    return this.clamp(probability, 0, 1);
  }

  private static calculateDraw(matrix: number[][]): number {
    let probability = 0;

    for (let goals = 0; goals <= MAX_GOALS; goals += 1) {
      probability += matrix[goals]?.[goals] ?? 0;
    }

    return this.clamp(probability, 0, 1);
  }

  private static calculateAwayWin(matrix: number[][]): number {
    let probability = 0;

    for (let homeGoals = 0; homeGoals <= MAX_GOALS; homeGoals += 1) {
      for (let awayGoals = 0; awayGoals <= MAX_GOALS; awayGoals += 1) {
        if (awayGoals > homeGoals) {
          probability += matrix[homeGoals]?.[awayGoals] ?? 0;
        }
      }
    }

    return this.clamp(probability, 0, 1);
  }

  private static buildHalfTimeModel(
    features: RawPredictionFeatures,
  ): GoalModelResult['halfTime'] {
    if (!this.hasUsablePeriodData(features.home, features.away, 'firstHalf')) {
      return this.unavailablePeriodModel();
    }

    const homeLambda = this.getPeriodLambda(
      features.home,
      features.away,
      'firstHalf',
    );

    const awayLambda = this.getPeriodLambda(
      features.away,
      features.home,
      'firstHalf',
    );

    if (homeLambda === null || awayLambda === null) {
      return this.unavailablePeriodModel();
    }

    return {
      available: true,

      ...this.buildPeriodProbabilityModel(homeLambda, awayLambda),
    };
  }

  private static buildSecondHalfModel(
    features: RawPredictionFeatures,
  ): GoalModelResult['secondHalf'] {
    if (!this.hasUsablePeriodData(features.home, features.away, 'secondHalf')) {
      return this.unavailablePeriodModel();
    }

    const homeLambda = this.getPeriodLambda(
      features.home,
      features.away,
      'secondHalf',
    );

    const awayLambda = this.getPeriodLambda(
      features.away,
      features.home,
      'secondHalf',
    );

    if (homeLambda === null || awayLambda === null) {
      return this.unavailablePeriodModel();
    }

    return {
      available: true,

      ...this.buildPeriodProbabilityModel(homeLambda, awayLambda),
    };
  }

  private static hasUsablePeriodData(
    home: RawPredictionFeatures['home'],
    away: RawPredictionFeatures['away'],
    period: 'firstHalf' | 'secondHalf',
  ): boolean {
    if (
      !home.dataAvailability?.halfTimeData ||
      !away.dataAvailability?.halfTimeData
    ) {
      return false;
    }

    const homeData = period === 'firstHalf' ? home.firstHalf : home.secondHalf;

    const awayData = period === 'firstHalf' ? away.firstHalf : away.secondHalf;

    return (
      homeData.sampleSize >= MIN_PERIOD_SAMPLE &&
      awayData.sampleSize >= MIN_PERIOD_SAMPLE
    );
  }

  private static getPeriodLambda(
    team: RawPredictionFeatures['home'],
    opponent: RawPredictionFeatures['away'],
    period: 'firstHalf' | 'secondHalf',
  ): number | null {
    const teamData = period === 'firstHalf' ? team.firstHalf : team.secondHalf;

    const opponentData =
      period === 'firstHalf' ? opponent.firstHalf : opponent.secondHalf;

    if (
      !teamData ||
      !opponentData ||
      teamData.sampleSize < MIN_PERIOD_SAMPLE ||
      opponentData.sampleSize < MIN_PERIOD_SAMPLE
    ) {
      return null;
    }

    const scoring = this.readNonNegative(teamData.averageGoalsScored);

    const conceding = this.readNonNegative(opponentData.averageGoalsConceded);

    if (scoring === null || conceding === null) {
      return null;
    }

    /*
     * Period-specific scoring expectation:
     *
     * team's historical period scoring
     * +
     * opponent's historical period conceding
     *
     * averaged between the two sources.
     */
    const lambda = (scoring + conceding) / 2;

    if (!Number.isFinite(lambda) || lambda <= 0) {
      return null;
    }

    return this.clamp(lambda, 0.01, 2.5);
  }

  private static buildPeriodProbabilityModel(
    homeLambda: number,
    awayLambda: number,
  ): Omit<GoalModelResult['halfTime'], 'available'> {
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

  private static unavailablePeriodModel(): {
    available: false;

    homeGoals: number[];

    awayGoals: number[];

    totalGoals: number[];

    homeWin: number;

    draw: number;

    awayWin: number;
  } {
    return {
      available: false,

      homeGoals: new Array<number>(MAX_GOALS + 1).fill(0),

      awayGoals: new Array<number>(MAX_GOALS + 1).fill(0),

      totalGoals: new Array<number>(MAX_GOALS * 2 + 1).fill(0),

      homeWin: 0,

      draw: 0,

      awayWin: 0,
    };
  }

  private static sampleReliability(sampleSize: number): number {
    if (!Number.isFinite(sampleSize) || sampleSize <= 0) {
      return 0;
    }

    /*
     * Diminishing returns:
     *
     * More observations increase reliability, but no finite sample
     * becomes mathematically perfect.
     */
    return this.clamp(1 - Math.exp(-sampleSize / 10), 0, 1);
  }

  private static normalize(values: number[]): number[] {
    const safe = values.map((value) => this.nonNegative(value));

    const total = this.sum(safe);

    if (total <= 0 || !Number.isFinite(total)) {
      return safe.map(() => (safe.length > 0 ? 1 / safe.length : 0));
    }

    return safe.map((value) => value / total);
  }

  private static sum(values: number[]): number {
    return values.reduce((sum, value) => sum + this.nonNegative(value), 0);
  }

  private static readNonNegative(value: unknown): number | null {
    const number = Number(value);

    if (!Number.isFinite(number) || number < 0) {
      return null;
    }

    return number;
  }

  private static safeNonNegative(value: unknown): number {
    return this.readNonNegative(value) ?? 0;
  }

  private static nonNegative(value: number): number {
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  private static clamp(
    value: number,
    minimum: number,
    maximum: number,
  ): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
