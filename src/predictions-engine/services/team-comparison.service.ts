// src/predictions-engine/services/team-comparison.service.ts

import { Injectable } from '@nestjs/common';

import { RawPredictionFeatures } from '../interfaces/raw-prediction-features.interface';

import {
  TeamComparisonDimension,
  TeamComparisonFeatures,
} from '../interfaces/team-comparison-features.interface';

@Injectable()
export class TeamComparisonService {
  build(input: {
    home: RawPredictionFeatures['home'];
    away: RawPredictionFeatures['away'];

    standings: RawPredictionFeatures['standings'];

    h2h: RawPredictionFeatures['h2h'];
  }): TeamComparisonFeatures {
    /*
     * ----------------------------------------------------------
     * TEAM-TO-TEAM EVIDENCE MAP
     * ----------------------------------------------------------
     *
     * Every dimension compares HOME against AWAY using the
     * underlying sports datasets already assembled by
     * RawPredictionFeatureService.
     *
     * Missing individual values are ignored rather than converted
     * into zero. No available dataset is replaced by another dataset.
     */

    const attack = this.buildDimension(
      this.attackScore(input.home, true),
      this.attackScore(input.away, false),
    );

    const defence = this.buildDimension(
      this.defenceScore(input.home, true),
      this.defenceScore(input.away, false),
    );

    const form = this.buildDimension(
      this.formScore(input.home),
      this.formScore(input.away),
    );

    const venue = this.buildDimension(
      this.venueScore(input.home, true),
      this.venueScore(input.away, false),
    );

    const standing = this.buildStandingDimension(input.standings);

    const overallStrength = this.buildDimension(
      this.overallStrengthScore(input.home, true),
      this.overallStrengthScore(input.away, false),
    );

    const goalProduction = this.buildDimension(
      this.goalProductionScore(input.home, true),
      this.goalProductionScore(input.away, false),
    );

    const goalPrevention = this.buildDimension(
      this.goalPreventionScore(input.home, true),
      this.goalPreventionScore(input.away, false),
    );

    const consistency = this.buildDimension(
      this.consistencyScore(input.home),
      this.consistencyScore(input.away),
    );

    /*
     * Venue advantage is based on the actual venue performance
     * datasets. It does not automatically assume that home is
     * stronger simply because the fixture is at home.
     */
    const homeVenuePoints = this.readNullableNumber(
      input.home.venue.pointsPerMatch,
    );

    const awayVenuePoints = this.readNullableNumber(
      input.away.venue.pointsPerMatch,
    );

    const homeAdvantage =
      homeVenuePoints !== null && awayVenuePoints !== null
        ? this.clamp(
            this.normalizeRate(homeVenuePoints, 3) -
              this.normalizeRate(awayVenuePoints, 3),
            -1,
            1,
          )
        : 0;

    const awayAdvantage =
      homeVenuePoints !== null && awayVenuePoints !== null
        ? this.clamp(
            this.normalizeRate(awayVenuePoints, 3) -
              this.normalizeRate(homeVenuePoints, 3),
            -1,
            1,
          )
        : 0;

    /*
     * ----------------------------------------------------------
     * DIRECTIONAL COMPARISON
     * ----------------------------------------------------------
     */
    const directionalHomeScore = this.clamp(
      attack.home * 0.16 +
        defence.home * 0.14 +
        form.home * 0.12 +
        venue.home * 0.14 +
        standing.home * 0.1 +
        overallStrength.home * 0.14 +
        goalProduction.home * 0.1 +
        goalPrevention.home * 0.1 +
        consistency.home * 0.05 +
        this.normalizeAdvantage(homeAdvantage) * 0.05,
    );

    const directionalAwayScore = this.clamp(
      attack.away * 0.16 +
        defence.away * 0.14 +
        form.away * 0.12 +
        venue.away * 0.14 +
        standing.away * 0.1 +
        overallStrength.away * 0.14 +
        goalProduction.away * 0.1 +
        goalPrevention.away * 0.1 +
        consistency.away * 0.05 +
        this.normalizeAdvantage(awayAdvantage) * 0.05,
    );

    /*
     * H2H is deliberately supplementary.
     */
    const h2hAdjustment = this.calculateH2HAdjustment(input.h2h);

    const adjustedHome = this.clamp(directionalHomeScore + h2hAdjustment);

    const adjustedAway = this.clamp(directionalAwayScore - h2hAdjustment);

    return {
      attack,

      defence,

      form,

      venue,

      standing,

      overallStrength,

      goalProduction,

      goalPrevention,

      consistency,

      homeAdvantage,

      awayAdvantage,

      directionalHomeScore: adjustedHome,

      directionalAwayScore: adjustedAway,

      directionalDifference: adjustedHome - adjustedAway,

      confidence: this.calculateComparisonConfidence(input),
    };
  }

  private attackScore(
    team: RawPredictionFeatures['home'],
    isHome: boolean,
  ): number {
    const stats = team.sourceData?.competitionStats;

    const profile = team.sourceData?.performanceProfile;

    return this.weightedMean([
      {
        value: this.normalizeGoals(team.averageGoalsScored),
        weight: 0.1,
      },

      {
        value: this.normalizeGoals(team.recent.averageGoalsScored),
        weight: 0.08,
      },

      {
        value: this.normalizeGoals(team.venue.averageGoalsScored),
        weight: 0.12,
      },

      {
        value: this.normalizeGoals(
          this.readNullableNumber(stats?.averageGoalsScored),
        ),
        weight: 0.1,
      },

      {
        value: this.normalizeGoals(
          isHome
            ? this.readNullableNumber(stats?.homeAverageGoalsScored)
            : this.readNullableNumber(stats?.awayAverageGoalsScored),
        ),
        weight: 0.16,
      },

      {
        value: this.normalizeGoals(
          this.readNullableNumber(profile?.averageGoalsScored),
        ),
        weight: 0.08,
      },

      {
        value: this.normalizeGoals(
          isHome
            ? this.readNullableNumber(profile?.homeAverageGoalsScored)
            : this.readNullableNumber(profile?.awayAverageGoalsScored),
        ),
        weight: 0.14,
      },

      {
        value: this.normalizeExpectedGoals(
          this.readNullableNumber(stats?.averageExpectedGoals),
        ),
        weight: 0.07,
      },

      {
        value: this.normalizeScore(
          this.readNullableNumber(profile?.attackingFormScore),
        ),
        weight: 0.15,
      },
    ]);
  }

  private defenceScore(
    team: RawPredictionFeatures['home'],
    isHome: boolean,
  ): number {
    const stats = team.sourceData?.competitionStats;

    const profile = team.sourceData?.performanceProfile;

    const base = this.weightedMean([
      {
        value: this.normalizeDefence(team.averageGoalsConceded),
        weight: 0.1,
      },

      {
        value: this.normalizeDefence(team.recent.averageGoalsConceded),
        weight: 0.08,
      },

      {
        value: this.normalizeDefence(team.venue.averageGoalsConceded),
        weight: 0.12,
      },

      {
        value: this.normalizeDefence(
          this.readNullableNumber(stats?.averageGoalsConceded),
        ),
        weight: 0.12,
      },

      {
        value: this.normalizeDefence(
          isHome
            ? this.readNullableNumber(stats?.homeAverageGoalsConceded)
            : this.readNullableNumber(stats?.awayAverageGoalsConceded),
        ),
        weight: 0.16,
      },

      {
        value: this.normalizeDefence(
          this.readNullableNumber(profile?.averageGoalsConceded),
        ),
        weight: 0.08,
      },

      {
        value: this.normalizeDefence(
          isHome
            ? this.readNullableNumber(profile?.homeAverageGoalsConceded)
            : this.readNullableNumber(profile?.awayAverageGoalsConceded),
        ),
        weight: 0.14,
      },

      {
        value: this.normalizeScore(
          this.readNullableNumber(profile?.defensiveFormScore),
        ),
        weight: 0.1,
      },

      {
        value: this.readNullableNumber(this.readRate(team.cleanSheetRate)),
        weight: 0.1,
      },
    ]);

    return this.clamp(base, 0, 1);
  }

  private formScore(team: RawPredictionFeatures['home']): number {
    const profile = team.sourceData?.performanceProfile;

    return this.weightedMean([
      {
        value: this.normalizeRate(team.recent.pointsPerMatch, 3),
        weight: 0.2,
      },

      {
        value: this.readRate(team.recent.winRate),
        weight: 0.1,
      },

      {
        value: this.normalizeRate(
          this.readNullableNumber(profile?.recentPointsPerMatch),
          3,
        ),
        weight: 0.2,
      },

      {
        value: this.readRate(this.readNullableNumber(profile?.recentWinRate)),
        weight: 0.15,
      },

      {
        value: this.normalizeScore(
          this.readNullableNumber(profile?.recentFormScore),
        ),
        weight: 0.15,
      },

      {
        value: this.normalizeScore(
          this.readNullableNumber(profile?.momentumScore),
        ),
        weight: 0.1,
      },

      {
        value: this.normalizeScore(
          this.readNullableNumber(profile?.overallPerformanceScore),
        ),
        weight: 0.1,
      },
    ]);
  }

  private venueScore(
    team: RawPredictionFeatures['home'],
    isHome: boolean,
  ): number {
    const stats = team.sourceData?.competitionStats;

    const profile = team.sourceData?.performanceProfile;

    return this.weightedMean([
      {
        value: this.normalizeRate(team.venue.pointsPerMatch, 3),
        weight: 0.2,
      },

      {
        value: this.readRate(team.venue.winRate),
        weight: 0.15,
      },

      /*
       * Draw rate is retained as venue evidence but contributes
       * only a small amount to the directional score.
       */
      {
        value: this.readRate(team.venue.drawRate),
        weight: 0.05,
      },

      {
        value: this.readRate(
          isHome
            ? this.readNullableNumber(stats?.homeWinRate)
            : this.readNullableNumber(stats?.awayWinRate),
        ),
        weight: 0.2,
      },

      {
        value: this.readRate(
          isHome
            ? this.readNullableNumber(profile?.homeWinRate)
            : this.readNullableNumber(profile?.awayWinRate),
        ),
        weight: 0.2,
      },

      {
        value: this.normalizeScore(
          isHome
            ? this.readNullableNumber(profile?.homeFormScore)
            : this.readNullableNumber(profile?.awayFormScore),
        ),
        weight: 0.2,
      },
    ]);
  }

  private buildStandingDimension(
    standings: RawPredictionFeatures['standings'],
  ): TeamComparisonDimension {
    if (!standings.home && !standings.away) {
      return this.buildDimension(0.5, 0.5);
    }

    const homeScore = standings.home ? this.standingScore(standings.home) : 0.5;

    const awayScore = standings.away ? this.standingScore(standings.away) : 0.5;

    return this.buildDimension(homeScore, awayScore);
  }

  private standingScore(standing: {
    rank: number;
    points: number;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
    form: string | null;
  }): number {
    const played = this.readNumber(standing.played);

    const points = this.readNumber(standing.points);

    const wins = this.readNumber(standing.wins);

    const goalDifference = this.readNumber(standing.goalDifference);

    const values: Array<{
      value: number | null;
      weight: number;
    }> = [
      {
        value: played > 0 ? this.clamp(points / played / 3, 0, 1) : null,
        weight: 0.45,
      },

      {
        value: played > 0 ? this.clamp(wins / played, 0, 1) : null,
        weight: 0.25,
      },

      {
        value:
          played > 0
            ? this.clamp(0.5 + (goalDifference / played / 4) * 0.5, 0, 1)
            : null,
        weight: 0.3,
      },
    ];

    return this.weightedMean(values);
  }

  private overallStrengthScore(
    team: RawPredictionFeatures['home'],
    isHome: boolean,
  ): number {
    const stats = team.sourceData?.competitionStats;

    const profile = team.sourceData?.performanceProfile;

    return this.weightedMean([
      {
        value: this.normalizeScore(
          this.readNullableNumber(
            isHome ? stats?.homeStrengthScore : stats?.awayStrengthScore,
          ),
        ),
        weight: 0.3,
      },

      {
        value: this.normalizeScore(
          this.readNullableNumber(stats?.overallStrengthScore),
        ),
        weight: 0.2,
      },

      {
        value: this.normalizeScore(
          this.readNullableNumber(profile?.overallPerformanceScore),
        ),
        weight: 0.2,
      },

      {
        value: this.normalizeScore(
          this.readNullableNumber(profile?.overallStrengthScore),
        ),
        weight: 0.1,
      },

      {
        value: this.normalizeScore(
          isHome
            ? this.readNullableNumber(profile?.homeFormScore)
            : this.readNullableNumber(profile?.awayFormScore),
        ),
        weight: 0.08,
      },

      {
        value: this.normalizeScore(
          this.readNullableNumber(profile?.recentFormScore),
        ),
        weight: 0.05,
      },

      {
        value: this.normalizeScore(
          this.readNullableNumber(profile?.momentumScore),
        ),
        weight: 0.02,
      },

      {
        value: this.normalizeGoals(team.averageGoalsScored),
        weight: 0.025,
      },

      {
        value: this.normalizeDefence(team.averageGoalsConceded),
        weight: 0.025,
      },
    ]);
  }

  private goalProductionScore(
    team: RawPredictionFeatures['home'],
    isHome: boolean,
  ): number {
    const stats = team.sourceData?.competitionStats;

    const profile = team.sourceData?.performanceProfile;

    return this.weightedMean([
      {
        value: this.normalizeGoals(team.averageGoalsScored),
        weight: 0.1,
      },

      {
        value: this.normalizeGoals(team.recent.averageGoalsScored),
        weight: 0.1,
      },

      {
        value: this.normalizeGoals(team.venue.averageGoalsScored),
        weight: 0.1,
      },

      {
        value: this.normalizeGoals(
          isHome
            ? this.readNullableNumber(stats?.homeAverageGoalsScored)
            : this.readNullableNumber(stats?.awayAverageGoalsScored),
        ),
        weight: 0.2,
      },

      {
        value: this.normalizeGoals(
          isHome
            ? this.readNullableNumber(profile?.homeAverageGoalsScored)
            : this.readNullableNumber(profile?.awayAverageGoalsScored),
        ),
        weight: 0.2,
      },

      {
        value: this.normalizeGoals(
          this.readNullableNumber(stats?.averageGoalsScored),
        ),
        weight: 0.1,
      },

      {
        value: this.normalizeGoals(
          this.readNullableNumber(profile?.averageGoalsScored),
        ),
        weight: 0.08,
      },

      {
        value: this.normalizeExpectedGoals(
          this.readNullableNumber(stats?.averageExpectedGoals),
        ),
        weight: 0.07,
      },

      {
        value: this.normalizeScore(
          this.readNullableNumber(profile?.attackingFormScore),
        ),
        weight: 0.05,
      },
    ]);
  }

  private goalPreventionScore(
    team: RawPredictionFeatures['home'],
    isHome: boolean,
  ): number {
    const stats = team.sourceData?.competitionStats;

    const profile = team.sourceData?.performanceProfile;

    return this.weightedMean([
      {
        value: this.normalizeDefence(team.averageGoalsConceded),
        weight: 0.1,
      },

      {
        value: this.normalizeDefence(team.recent.averageGoalsConceded),
        weight: 0.1,
      },

      {
        value: this.normalizeDefence(team.venue.averageGoalsConceded),
        weight: 0.1,
      },

      {
        value: this.normalizeDefence(
          isHome
            ? this.readNullableNumber(stats?.homeAverageGoalsConceded)
            : this.readNullableNumber(stats?.awayAverageGoalsConceded),
        ),
        weight: 0.2,
      },

      {
        value: this.normalizeDefence(
          isHome
            ? this.readNullableNumber(profile?.homeAverageGoalsConceded)
            : this.readNullableNumber(profile?.awayAverageGoalsConceded),
        ),
        weight: 0.2,
      },

      {
        value: this.readRate(team.cleanSheetRate),
        weight: 0.1,
      },

      {
        value: this.readRate(
          isHome
            ? this.readNullableNumber(profile?.homeCleanSheetRate)
            : this.readNullableNumber(profile?.awayCleanSheetRate),
        ),
        weight: 0.1,
      },

      {
        value: this.normalizeScore(
          this.readNullableNumber(profile?.defensiveFormScore),
        ),
        weight: 0.1,
      },
    ]);
  }

  private consistencyScore(team: RawPredictionFeatures['home']): number {
    const profile = team.sourceData?.performanceProfile;

    const scoringStreak = this.readNullableNumber(profile?.scoringStreak);

    const matchesAnalyzed = this.readNullableNumber(profile?.matchesAnalyzed);

    const scoringStreakRate =
      scoringStreak !== null && matchesAnalyzed !== null && matchesAnalyzed > 0
        ? this.clamp(scoringStreak / matchesAnalyzed, 0, 1)
        : null;

    return this.weightedMean([
      {
        value: this.invertRate(team.lossRate),
        weight: 0.2,
      },

      {
        value: this.invertRate(team.failedToScoreRate),
        weight: 0.2,
      },

      {
        value: this.readRate(team.cleanSheetRate),
        weight: 0.15,
      },

      {
        value: this.normalizeScore(
          this.readNullableNumber(profile?.overallPerformanceScore),
        ),
        weight: 0.15,
      },

      {
        value: this.normalizeScore(
          this.readNullableNumber(profile?.momentumScore),
        ),
        weight: 0.1,
      },

      {
        value: this.readRate(
          this.readNullableNumber(profile?.protectedLeadRate),
        ),
        weight: 0.1,
      },

      {
        value: scoringStreakRate,
        weight: 0.1,
      },
    ]);
  }

  private calculateH2HAdjustment(h2h: RawPredictionFeatures['h2h']): number {
    if (
      !h2h?.available ||
      !Number.isFinite(h2h.sampleSize) ||
      h2h.sampleSize <= 0
    ) {
      return 0;
    }

    const total = Math.max(h2h.sampleSize, 1);

    const homeWins = this.readNumber(h2h.homeWins);

    const awayWins = this.readNumber(h2h.awayWins);

    const homeShare = homeWins / total;

    const awayShare = awayWins / total;

    /*
     * dataReliability may be supplied either as 0-1 or 0-100.
     * readRate safely supports both representations.
     */
    const reliability =
      this.readRate(this.readNullableNumber(h2h.dataReliability)) ?? 0;

    return this.clamp(
      (homeShare - awayShare) * reliability * 0.05,
      -0.05,
      0.05,
    );
  }

  private calculateComparisonConfidence(input: {
    home: RawPredictionFeatures['home'];
    away: RawPredictionFeatures['away'];
    standings: RawPredictionFeatures['standings'];
    h2h: RawPredictionFeatures['h2h'];
  }): number {
    const homeCoverage = this.calculateTeamCoverage(input.home);

    const awayCoverage = this.calculateTeamCoverage(input.away);

    const standingCoverage =
      input.standings.home && input.standings.away ? 1 : 0;

    const h2hCoverage = input.h2h?.available
      ? this.clamp(this.readNumber(input.h2h.sampleSize) / 5, 0, 1)
      : 0;

    /*
     * All historical fixtures are retained by the data layer.
     * Confidence only measures how much usable history exists;
     * it does not discard older matches.
     */
    const historicalCoverage = this.clamp(
      Math.min(input.home.historical.length, input.away.historical.length) / 20,
      0,
      1,
    );

    /*
     * The comparison confidence itself remains 0-1.
     */
    return this.clamp(
      homeCoverage * 0.2 +
        awayCoverage * 0.2 +
        standingCoverage * 0.1 +
        historicalCoverage * 0.35 +
        h2hCoverage * 0.15,
      0,
      1,
    );
  }

  private calculateTeamCoverage(team: RawPredictionFeatures['home']): number {
    const availability = team.dataAvailability;

    const values = [
      availability?.historicalMatches,
      availability?.recentForm,
      availability?.venueMatches,
      availability?.competitionStats,
      availability?.performanceProfile,
    ];

    if (!availability) {
      return 0;
    }

    return values.filter(Boolean).length / values.length;
  }

  private buildDimension(home: number, away: number): TeamComparisonDimension {
    const safeHome = this.clamp(home, 0, 1);

    const safeAway = this.clamp(away, 0, 1);

    return {
      home: safeHome,

      away: safeAway,

      difference: safeHome - safeAway,

      strength: this.clamp(0.5 + (safeHome - safeAway) * 0.5, 0, 1),
    };
  }

  private weightedMean(
    values: Array<{
      value: number | null | undefined;
      weight: number;
    }>,
  ): number {
    let numerator = 0;

    let denominator = 0;

    for (const item of values) {
      if (
        item.value === null ||
        item.value === undefined ||
        !Number.isFinite(item.value) ||
        !Number.isFinite(item.weight) ||
        item.weight <= 0
      ) {
        continue;
      }

      const value = this.clamp(item.value, 0, 1);

      numerator += value * item.weight;

      denominator += item.weight;
    }

    /*
     * 0.5 is neutral only when no usable evidence exists for
     * this particular dimension. It does not replace available
     * datasets.
     */
    if (denominator <= 0) {
      return 0.5;
    }

    return this.clamp(numerator / denominator, 0, 1);
  }

  private normalizeGoals(value: number | null | undefined): number | null {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return null;
    }

    /*
     * Three goals represents a strong scoring rate. This converts
     * actual goal averages to the 0-1 comparison scale without
     * treating 2.4 goals as 2.4 probability.
     */
    return this.clamp(value / 3, 0, 1);
  }

  private normalizeDefence(value: number | null | undefined): number | null {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return null;
    }

    /*
     * Lower goals conceded = stronger defence.
     */
    return this.clamp(1 - value / 3, 0, 1);
  }

  private normalizeExpectedGoals(
    value: number | null | undefined,
  ): number | null {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return null;
    }

    return this.clamp(value / 3, 0, 1);
  }

  private normalizeScore(value: number | null | undefined): number | null {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return null;
    }

    /*
     * Scores from Sports schemas are normally already percentage
     * style values on a 0-100 scale, but tolerate 0-1 values too.
     */
    return value > 1 && value <= 100
      ? this.clamp(value / 100, 0, 1)
      : this.clamp(value, 0, 1);
  }

  private normalizeRate(
    value: number | null | undefined,
    maximum: number,
  ): number {
    if (
      value === null ||
      value === undefined ||
      !Number.isFinite(value) ||
      maximum <= 0
    ) {
      return 0;
    }

    return this.clamp(value / maximum, 0, 1);
  }

  private readRate(value: number | null | undefined): number | null {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return null;
    }

    if (value >= 0 && value <= 1) {
      return value;
    }

    if (value > 1 && value <= 100) {
      return value / 100;
    }

    return null;
  }

  private invertRate(value: number | null | undefined): number | null {
    const normalized = this.readRate(value);

    return normalized === null ? null : this.clamp(1 - normalized, 0, 1);
  }

  private readNumber(value: unknown): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }

    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : 0;
  }

  private readNullableNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  private normalizeAdvantage(value: number): number {
    return this.clamp(0.5 + value * 0.5, 0, 1);
  }

  private clamp(value: number, minimum = 0, maximum = 1): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
