import { Injectable } from '@nestjs/common';

import { FixtureAnalysis } from '../../interfaces/fixture-analysis.interface';

import {
  ExpectedGoals,
  StatisticalModelOutput,
} from '../../interfaces/statistical-model.interface';

import {
  GoalProbabilityDistribution,
  ScorelineProbability,
} from '../../interfaces/prediction-probability.interface';

import {
  clamp,
  normalizeDistribution,
  round,
} from '../../utils/statistical-validation.util';

@Injectable()
export class GoalModelEngine {
  private readonly maximumGoals = 12;

  private readonly minimumExpectedGoals = 0.05;

  private readonly maximumExpectedGoals = 5;

  build(fixtureAnalysis: FixtureAnalysis): StatisticalModelOutput {
    const expectedGoals = this.calculateExpectedGoals(fixtureAnalysis);

    const goalDistribution = this.buildGoalDistribution(expectedGoals);

    const matchProbability = this.calculateMatchProbability(goalDistribution);

    const dataQuality = this.calculateDataQuality(fixtureAnalysis);

    const sampleQuality = this.calculateSampleQuality(fixtureAnalysis);

    const reasonCodes = this.buildReasonCodes(fixtureAnalysis, expectedGoals);

    return {
      expectedGoals,

      matchProbability,

      goalDistribution,

      dataQuality,

      sampleQuality,

      reasonCodes,

      generatedAt: new Date(),
    };
  }

  private calculateExpectedGoals(
    fixtureAnalysis: FixtureAnalysis,
  ): ExpectedGoals {
    const homeStats = fixtureAnalysis.homeTeamStats;

    const awayStats = fixtureAnalysis.awayTeamStats;

    if (!homeStats || !awayStats) {
      return {
        home: 1,
        away: 1,
        total: 2,
      };
    }

    const homeAttack =
      this.safeMetric(homeStats.homeAverageGoalsScored) ||
      this.safeMetric(homeStats.averageGoalsScored);

    const homeDefence =
      this.safeMetric(homeStats.homeAverageGoalsConceded) ||
      this.safeMetric(homeStats.averageGoalsConceded);

    const awayAttack =
      this.safeMetric(awayStats.awayAverageGoalsScored) ||
      this.safeMetric(awayStats.averageGoalsScored);

    const awayDefence =
      this.safeMetric(awayStats.awayAverageGoalsConceded) ||
      this.safeMetric(awayStats.averageGoalsConceded);

    let homeExpected = (homeAttack + awayDefence) / 2;

    let awayExpected = (awayAttack + homeDefence) / 2;

    homeExpected = this.applyRecentFormAdjustment(
      homeExpected,
      homeStats.recentFormScore,
    );

    awayExpected = this.applyRecentFormAdjustment(
      awayExpected,
      awayStats.recentFormScore,
    );

    homeExpected = this.applyH2HAdjustment(homeExpected, fixtureAnalysis, true);

    awayExpected = this.applyH2HAdjustment(
      awayExpected,
      fixtureAnalysis,
      false,
    );

    /**
     * Conservative shrinkage prevents extreme expected-goal
     * values when the available sample is limited.
     */
    const homeSampleFactor = this.getSampleShrinkage(
      Math.max(homeStats.homePlayed, homeStats.played),
    );

    const awaySampleFactor = this.getSampleShrinkage(
      Math.max(awayStats.awayPlayed, awayStats.played),
    );

    homeExpected = this.shrinkExpectedGoals(
      homeExpected,
      1.35,
      homeSampleFactor,
    );

    awayExpected = this.shrinkExpectedGoals(
      awayExpected,
      1.1,
      awaySampleFactor,
    );

    homeExpected = clamp(
      homeExpected,
      this.minimumExpectedGoals,
      this.maximumExpectedGoals,
    );

    awayExpected = clamp(
      awayExpected,
      this.minimumExpectedGoals,
      this.maximumExpectedGoals,
    );

    return {
      home: round(homeExpected, 3),
      away: round(awayExpected, 3),
      total: round(homeExpected + awayExpected, 3),
    };
  }

  private buildGoalDistribution(
    expectedGoals: ExpectedGoals,
  ): GoalProbabilityDistribution {
    const homeGoalsDistribution = this.buildPoissonDistribution(
      expectedGoals.home,
    );

    const awayGoalsDistribution = this.buildPoissonDistribution(
      expectedGoals.away,
    );

    const scorelines: ScorelineProbability[] = [];

    for (let homeGoals = 0; homeGoals <= this.maximumGoals; homeGoals += 1) {
      for (let awayGoals = 0; awayGoals <= this.maximumGoals; awayGoals += 1) {
        const homeProbability = homeGoalsDistribution[homeGoals] ?? 0;

        const awayProbability = awayGoalsDistribution[awayGoals] ?? 0;

        scorelines.push({
          homeGoals,

          awayGoals,

          probability: homeProbability * awayProbability,
        });
      }
    }

    const scorelineTotal = scorelines.reduce(
      (sum, scoreline) => sum + scoreline.probability,
      0,
    );

    const normalizedScorelines =
      scorelineTotal > 0
        ? scorelines.map((scoreline) => ({
            ...scoreline,
            probability: scoreline.probability / scorelineTotal,
          }))
        : scorelines;

    const totalGoals: Record<number, number> = {};

    const homeGoals: Record<number, number> = {};

    const awayGoals: Record<number, number> = {};

    for (const scoreline of normalizedScorelines) {
      homeGoals[scoreline.homeGoals] =
        (homeGoals[scoreline.homeGoals] ?? 0) + scoreline.probability;

      awayGoals[scoreline.awayGoals] =
        (awayGoals[scoreline.awayGoals] ?? 0) + scoreline.probability;

      const total = scoreline.homeGoals + scoreline.awayGoals;

      totalGoals[total] = (totalGoals[total] ?? 0) + scoreline.probability;
    }

    return {
      homeExpectedGoals: expectedGoals.home,

      awayExpectedGoals: expectedGoals.away,

      totalExpectedGoals: expectedGoals.total,

      scorelines: normalizedScorelines,

      homeGoals: normalizeDistribution(homeGoals),

      awayGoals: normalizeDistribution(awayGoals),

      totalGoals: normalizeDistribution(totalGoals),
    };
  }

  private buildPoissonDistribution(lambda: number): Record<number, number> {
    const distribution: Record<number, number> = {};

    const safeLambda = clamp(
      lambda,
      this.minimumExpectedGoals,
      this.maximumExpectedGoals,
    );

    let probability = Math.exp(-safeLambda);

    distribution[0] = probability;

    for (let goals = 1; goals <= this.maximumGoals; goals += 1) {
      probability = probability * (safeLambda / goals);

      distribution[goals] = probability;
    }

    return normalizeDistribution(distribution);
  }

  private calculateMatchProbability(
    distribution: GoalProbabilityDistribution,
  ): {
    home: number;
    draw: number;
    away: number;
  } {
    let home = 0;

    let draw = 0;

    let away = 0;

    for (const scoreline of distribution.scorelines) {
      if (scoreline.homeGoals > scoreline.awayGoals) {
        home += scoreline.probability;
      } else if (scoreline.homeGoals === scoreline.awayGoals) {
        draw += scoreline.probability;
      } else {
        away += scoreline.probability;
      }
    }

    const total = home + draw + away;

    if (total <= 0) {
      return {
        home: 1 / 3,
        draw: 1 / 3,
        away: 1 / 3,
      };
    }

    return {
      home: home / total,
      draw: draw / total,
      away: away / total,
    };
  }

  private applyRecentFormAdjustment(
    expectedGoals: number,
    recentFormScore: number,
  ): number {
    if (!Number.isFinite(recentFormScore) || recentFormScore <= 0) {
      return expectedGoals;
    }

    const normalizedForm = clamp(recentFormScore, 0, 1);

    const adjustment = (normalizedForm - 0.5) * 0.12;

    return expectedGoals * (1 + adjustment);
  }

  private applyH2HAdjustment(
    expectedGoals: number,
    fixtureAnalysis: FixtureAnalysis,
    homeTeam: boolean,
  ): number {
    const h2h = fixtureAnalysis.headToHead;

    if (!h2h || h2h.totalMeetings < 3) {
      return expectedGoals;
    }

    const relevantTeamId = homeTeam
      ? fixtureAnalysis.fixture.homeTeam.teamId
      : fixtureAnalysis.fixture.awayTeam.teamId;

    let wins = 0;

    let goalsFor = 0;

    for (const meeting of h2h.meetings) {
      if (String(meeting.homeTeamId) === String(relevantTeamId)) {
        goalsFor += meeting.homeGoals;

        if (meeting.homeGoals > meeting.awayGoals) {
          wins += 1;
        }
      } else if (String(meeting.awayTeamId) === String(relevantTeamId)) {
        goalsFor += meeting.awayGoals;

        if (meeting.awayGoals > meeting.homeGoals) {
          wins += 1;
        }
      }
    }

    if (h2h.meetings.length === 0) {
      return expectedGoals;
    }

    const h2hAverageGoals = goalsFor / h2h.meetings.length;

    const currentFormReference = expectedGoals;

    const averageDifference = clamp(
      (h2hAverageGoals - currentFormReference) /
        Math.max(currentFormReference, 0.5),
      -0.15,
      0.15,
    );

    const winRate = wins / h2h.meetings.length;

    /**
     * H2H is deliberately low-weight evidence because
     * older meetings may have little predictive relevance.
     */
    const h2hAdjustment = averageDifference * 0.08 + (winRate - 0.5) * 0.04;

    return expectedGoals * (1 + h2hAdjustment);
  }

  private calculateDataQuality(fixtureAnalysis: FixtureAnalysis): number {
    let score = 0;

    const homeStats = fixtureAnalysis.homeTeamStats;

    const awayStats = fixtureAnalysis.awayTeamStats;

    if (homeStats) {
      score += 32;
    }

    if (awayStats) {
      score += 32;
    }

    if (fixtureAnalysis.headToHead) {
      score += 12;
    }

    if (fixtureAnalysis.odds) {
      score += 8;
    }

    if (fixtureAnalysis.fixture.payload) {
      score += 10;
    }

    return clamp(score, 0, 100);
  }

  private calculateSampleQuality(fixtureAnalysis: FixtureAnalysis): number {
    const homePlayed = fixtureAnalysis.homeTeamStats?.played ?? 0;

    const awayPlayed = fixtureAnalysis.awayTeamStats?.played ?? 0;

    const homeSample = clamp(homePlayed / 10, 0, 1);

    const awaySample = clamp(awayPlayed / 10, 0, 1);

    return round(((homeSample + awaySample) / 2) * 100, 2);
  }

  private buildReasonCodes(
    fixtureAnalysis: FixtureAnalysis,
    expectedGoals: ExpectedGoals,
  ): string[] {
    const reasons: string[] = [];

    if (expectedGoals.total >= 2.75) {
      reasons.push('HIGH_EXPECTED_GOALS');
    }

    if (expectedGoals.total <= 2) {
      reasons.push('LOW_EXPECTED_GOALS');
    }

    if (
      fixtureAnalysis.homeTeamStats &&
      fixtureAnalysis.homeTeamStats.homeAverageGoalsScored >= 1.5
    ) {
      reasons.push('STRONG_HOME_ATTACK');
    }

    if (
      fixtureAnalysis.awayTeamStats &&
      fixtureAnalysis.awayTeamStats.awayAverageGoalsScored >= 1.5
    ) {
      reasons.push('STRONG_AWAY_ATTACK');
    }

    if (
      fixtureAnalysis.headToHead &&
      fixtureAnalysis.headToHead.totalMeetings >= 3
    ) {
      reasons.push('H2H_AVAILABLE');
    }

    if (fixtureAnalysis.odds) {
      reasons.push('MARKET_ODDS_AVAILABLE');
    }

    return reasons;
  }

  private getSampleShrinkage(sampleSize: number): number {
    return clamp(sampleSize / 10, 0.2, 1);
  }

  private shrinkExpectedGoals(
    value: number,
    baseline: number,
    sampleFactor: number,
  ): number {
    return value * sampleFactor + baseline * (1 - sampleFactor);
  }

  private safeMetric(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0
      ? value
      : 0;
  }
}
