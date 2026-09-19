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

    const opponentAdjustedStrength = this.buildDimension(
      this.opponentAdjustedStrengthScore(input.home),
      this.opponentAdjustedStrengthScore(input.away),
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
     * Home/away advantage is retained as a contextual comparison
     * signal only. Venue performance itself is already represented
     * by the venue dimension, so this signal has deliberately low
     * directional weight to avoid double-counting venue evidence.
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
     * All directional weights sum to exactly 1.
     *
     * Opponent-adjusted strength is kept as an independent dimension,
     * while overallStrength no longer embeds the same signal heavily.
     *
     * This prevents the same opponent-adjusted evidence from being
     * counted multiple times in the final comparison.
     */
    const directionalHomeScore = this.clamp(
      attack.home * 0.14 +
        defence.home * 0.13 +
        form.home * 0.11 +
        venue.home * 0.11 +
        standing.home * 0.09 +
        overallStrength.home * 0.12 +
        opponentAdjustedStrength.home * 0.12 +
        goalProduction.home * 0.08 +
        goalPrevention.home * 0.08 +
        consistency.home * 0.07 +
        this.normalizeAdvantage(homeAdvantage) * 0.05,
    );

    const directionalAwayScore = this.clamp(
      attack.away * 0.14 +
        defence.away * 0.13 +
        form.away * 0.11 +
        venue.away * 0.11 +
        standing.away * 0.09 +
        overallStrength.away * 0.12 +
        opponentAdjustedStrength.away * 0.12 +
        goalProduction.away * 0.08 +
        goalPrevention.away * 0.08 +
        consistency.away * 0.07 +
        this.normalizeAdvantage(awayAdvantage) * 0.05,
    );

    /*
     * H2H is supplementary evidence. It is not allowed to dominate
     * the comparison and does not replace current team evidence.
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

      opponentAdjustedStrength,

      goalProduction,

      goalPrevention,

      consistency,

      homeAdvantage,

      awayAdvantage,

      directionalHomeScore: adjustedHome,

      directionalAwayScore: adjustedAway,

      directionalDifference: adjustedHome - adjustedAway,

      /*
       * This is comparison-evidence reliability only.
       *
       * It is NOT prediction probability and is NOT the final
       * prediction confidence. The confidence engine remains the
       * authority for prediction confidence.
       */
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
        value: this.opponentAdjustedValue(team, (adjusted) =>
          this.normalizeGoals(adjusted.averageGoalsScored),
        ),
        weight: 0.24,
      },

      {
        value: this.normalizeGoals(team.averageGoalsScored),
        weight: 0.09,
      },

      {
        value: this.normalizeGoals(team.recent.averageGoalsScored),
        weight: 0.09,
      },

      {
        value: this.normalizeGoals(team.venue.averageGoalsScored),
        weight: 0.1,
      },

      {
        value: this.normalizeGoals(
          this.readNullableNumber(stats?.averageGoalsScored),
        ),
        weight: 0.08,
      },

      {
        value: this.normalizeGoals(
          isHome
            ? this.readNullableNumber(stats?.homeAverageGoalsScored)
            : this.readNullableNumber(stats?.awayAverageGoalsScored),
        ),
        weight: 0.1,
      },

      {
        value: this.normalizeGoals(
          this.readNullableNumber(profile?.averageGoalsScored),
        ),
        weight: 0.06,
      },

      {
        value: this.normalizeGoals(
          isHome
            ? this.readNullableNumber(profile?.homeAverageGoalsScored)
            : this.readNullableNumber(profile?.awayAverageGoalsScored),
        ),
        weight: 0.09,
      },

      {
        value: this.normalizeExpectedGoals(
          this.readNullableNumber(stats?.averageExpectedGoals),
        ),
        weight: 0.05,
      },

      {
        value: this.normalizeScore(
          this.readNullableNumber(profile?.attackingFormScore),
        ),
        weight: 0.1,
      },
    ]);
  }

  private defenceScore(
    team: RawPredictionFeatures['home'],
    isHome: boolean,
  ): number {
    const stats = team.sourceData?.competitionStats;

    const profile = team.sourceData?.performanceProfile;

    return this.weightedMean([
      {
        value: this.opponentAdjustedValue(team, (adjusted) =>
          this.normalizeDefence(adjusted.averageGoalsConceded),
        ),
        weight: 0.24,
      },

      {
        value: this.normalizeDefence(team.averageGoalsConceded),
        weight: 0.09,
      },

      {
        value: this.normalizeDefence(team.recent.averageGoalsConceded),
        weight: 0.09,
      },

      {
        value: this.normalizeDefence(team.venue.averageGoalsConceded),
        weight: 0.1,
      },

      {
        value: this.normalizeDefence(
          this.readNullableNumber(stats?.averageGoalsConceded),
        ),
        weight: 0.06,
      },

      {
        value: this.normalizeDefence(
          isHome
            ? this.readNullableNumber(stats?.homeAverageGoalsConceded)
            : this.readNullableNumber(stats?.awayAverageGoalsConceded),
        ),
        weight: 0.1,
      },

      {
        value: this.normalizeDefence(
          this.readNullableNumber(profile?.averageGoalsConceded),
        ),
        weight: 0.06,
      },

      {
        value: this.normalizeDefence(
          isHome
            ? this.readNullableNumber(profile?.homeAverageGoalsConceded)
            : this.readNullableNumber(profile?.awayAverageGoalsConceded),
        ),
        weight: 0.09,
      },

      {
        value: this.normalizeScore(
          this.readNullableNumber(profile?.defensiveFormScore),
        ),
        weight: 0.08,
      },

      {
        value: this.readRate(team.cleanSheetRate),
        weight: 0.09,
      },
    ]);
  }

  private formScore(team: RawPredictionFeatures['home']): number {
    const profile = team.sourceData?.performanceProfile;

    return this.weightedMean([
      {
        value: this.normalizeRate(team.recent.pointsPerMatch, 3),
        weight: 0.22,
      },

      {
        value: this.readRate(team.recent.winRate),
        weight: 0.11,
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
        weight: 0.14,
      },

      {
        value: this.normalizeScore(
          this.readNullableNumber(profile?.recentFormScore),
        ),
        weight: 0.14,
      },

      {
        value: this.normalizeScore(
          this.readNullableNumber(profile?.momentumScore),
        ),
        weight: 0.08,
      },

      {
        value: this.normalizeScore(
          this.readNullableNumber(profile?.overallPerformanceScore),
        ),
        weight: 0.11,
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

    return this.weightedMean([
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
    ]);
  }

  private opponentAdjustedStrengthScore(
    team: RawPredictionFeatures['home'],
  ): number {
    const adjusted = team.opponentAdjusted;

    if (!adjusted?.available || !Number.isFinite(adjusted.strengthRating)) {
      return 0.5;
    }

    return this.clamp(adjusted.strengthRating / 100, 0, 1);
  }

  private overallStrengthScore(
    team: RawPredictionFeatures['home'],
    isHome: boolean,
  ): number {
    const stats = team.sourceData?.competitionStats;

    const profile = team.sourceData?.performanceProfile;

    /*
     * Overall strength represents the current available strength
     * evidence. Opponent-adjusted strength is deliberately excluded
     * here because it has its own explicit comparison dimension.
     */
    return this.weightedMean([
      {
        value: this.normalizeScore(
          isHome
            ? this.readNullableNumber(stats?.homeStrengthScore)
            : this.readNullableNumber(stats?.awayStrengthScore),
        ),
        weight: 0.22,
      },

      {
        value: this.normalizeScore(
          this.readNullableNumber(stats?.overallStrengthScore),
        ),
        weight: 0.18,
      },

      {
        value: this.normalizeScore(
          this.readNullableNumber(profile?.overallPerformanceScore),
        ),
        weight: 0.16,
      },

      {
        value: this.normalizeScore(
          this.readNullableNumber(profile?.overallStrengthScore),
        ),
        weight: 0.12,
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
        weight: 0.07,
      },

      {
        value: this.normalizeScore(
          this.readNullableNumber(profile?.momentumScore),
        ),
        weight: 0.05,
      },

      {
        value: this.normalizeGoals(team.averageGoalsScored),
        weight: 0.06,
      },

      {
        value: this.normalizeDefence(team.averageGoalsConceded),
        weight: 0.06,
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
        value: this.opponentAdjustedValue(team, (adjusted) =>
          this.normalizeGoals(adjusted.averageGoalsScored),
        ),
        weight: 0.25,
      },

      {
        value: this.normalizeGoals(team.recent.averageGoalsScored),
        weight: 0.11,
      },

      {
        value: this.normalizeGoals(team.averageGoalsScored),
        weight: 0.06,
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
        weight: 0.14,
      },

      {
        value: this.normalizeGoals(
          isHome
            ? this.readNullableNumber(profile?.homeAverageGoalsScored)
            : this.readNullableNumber(profile?.awayAverageGoalsScored),
        ),
        weight: 0.13,
      },

      {
        value: this.normalizeGoals(
          this.readNullableNumber(stats?.averageGoalsScored),
        ),
        weight: 0.07,
      },

      {
        value: this.normalizeGoals(
          this.readNullableNumber(profile?.averageGoalsScored),
        ),
        weight: 0.06,
      },

      {
        value: this.normalizeExpectedGoals(
          this.readNullableNumber(stats?.averageExpectedGoals),
        ),
        weight: 0.08,
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
        value: this.opponentAdjustedValue(team, (adjusted) =>
          this.normalizeDefence(adjusted.averageGoalsConceded),
        ),
        weight: 0.25,
      },

      {
        value: this.normalizeDefence(team.recent.averageGoalsConceded),
        weight: 0.11,
      },

      {
        value: this.normalizeDefence(team.averageGoalsConceded),
        weight: 0.06,
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
        weight: 0.14,
      },

      {
        value: this.normalizeDefence(
          isHome
            ? this.readNullableNumber(profile?.homeAverageGoalsConceded)
            : this.readNullableNumber(profile?.awayAverageGoalsConceded),
        ),
        weight: 0.13,
      },

      {
        value: this.readRate(team.cleanSheetRate),
        weight: 0.08,
      },

      {
        value: this.readRate(
          isHome
            ? this.readNullableNumber(profile?.homeCleanSheetRate)
            : this.readNullableNumber(profile?.awayCleanSheetRate),
        ),
        weight: 0.07,
      },

      {
        value: this.normalizeScore(
          this.readNullableNumber(profile?.defensiveFormScore),
        ),
        weight: 0.06,
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

    const total = h2h.sampleSize;

    const homeWins = this.readNumber(h2h.homeWins);

    const awayWins = this.readNumber(h2h.awayWins);

    const homeShare = this.clamp(homeWins / total, 0, 1);

    const awayShare = this.clamp(awayWins / total, 0, 1);

    const reliabilityValue = this.readNullableNumber(h2h.dataReliability);

    /*
     * Missing H2H reliability must not become perfect reliability.
     * When unavailable, sample size provides only a limited reliability
     * signal.
     */
    const reliability =
      reliabilityValue !== null
        ? this.clamp(this.readRate(reliabilityValue) ?? 0, 0, 1)
        : this.sampleReliability(total);

    /*
     * H2H is intentionally capped at a small adjustment because it
     * is supplementary evidence and can contain stale historical
     * relationships between squads.
     */
    return this.clamp(
      (homeShare - awayShare) * reliability * 0.04,
      -0.04,
      0.04,
    );
  }

  private calculateComparisonConfidence(input: {
    home: RawPredictionFeatures['home'];
    away: RawPredictionFeatures['away'];
    standings: RawPredictionFeatures['standings'];
    h2h: RawPredictionFeatures['h2h'];
  }): number {
    const homeEvidence = this.calculateTeamEvidenceQuality(input.home);

    const awayEvidence = this.calculateTeamEvidenceQuality(input.away);

    const teamEvidence = (homeEvidence + awayEvidence) / 2;

    const standingEvidence =
      input.standings.home && input.standings.away
        ? this.calculateStandingEvidence(
            input.standings.home,
            input.standings.away,
          )
        : 0;

    const h2hEvidence = input.h2h?.available
      ? this.calculateH2HEvidence(input.h2h)
      : 0;

    /*
     * The comparison confidence measures whether the comparison has
     * enough reliable evidence behind it.
     *
     * It does not use directional score, probability, or confidence
     * thresholds from the prediction layer.
     */
    return this.clamp(
      teamEvidence * 0.7 + standingEvidence * 0.2 + h2hEvidence * 0.1,
      0,
      1,
    );
  }

  private calculateTeamEvidenceQuality(
    team: RawPredictionFeatures['home'],
  ): number {
    const availability = team.dataAvailability;

    if (!availability) {
      return 0;
    }

    const historicalMatches = this.readBoolean(availability.historicalMatches);

    const recentForm = this.readBoolean(availability.recentForm);

    const venueMatches = this.readBoolean(availability.venueMatches);

    const competitionStats = this.readBoolean(availability.competitionStats);

    const performanceProfile = this.readBoolean(
      availability.performanceProfile,
    );

    const opponentAdjustedData = this.readBoolean(
      availability.opponentAdjustedData,
    );

    const historicalSample = this.clamp(team.historical.length / 20, 0, 1);

    const opponentAdjustedSample =
      team.opponentAdjusted?.available &&
      Number.isFinite(team.opponentAdjusted.effectiveSampleSize)
        ? this.clamp(team.opponentAdjusted.effectiveSampleSize / 12, 0, 1)
        : 0;

    const sampleQuality =
      historicalSample * 0.55 + opponentAdjustedSample * 0.45;

    const availabilityQuality =
      (Number(historicalMatches) +
        Number(recentForm) +
        Number(venueMatches) +
        Number(competitionStats) +
        Number(performanceProfile) +
        Number(opponentAdjustedData)) /
      6;

    return this.clamp(availabilityQuality * 0.55 + sampleQuality * 0.45, 0, 1);
  }

  private calculateStandingEvidence(
    home: RawPredictionFeatures['standings']['home'],
    away: RawPredictionFeatures['standings']['away'],
  ): number {
    if (!home || !away) {
      return 0;
    }

    const homePlayed = this.readNumber(home.played);

    const awayPlayed = this.readNumber(away.played);

    const homeQuality = this.sampleReliability(homePlayed);

    const awayQuality = this.sampleReliability(awayPlayed);

    return (homeQuality + awayQuality) / 2;
  }

  private calculateH2HEvidence(
    h2h: NonNullable<RawPredictionFeatures['h2h']>,
  ): number {
    if (
      !h2h.available ||
      !Number.isFinite(h2h.sampleSize) ||
      h2h.sampleSize <= 0
    ) {
      return 0;
    }

    const sampleQuality = this.sampleReliability(h2h.sampleSize);

    const explicitReliability = this.readNullableNumber(h2h.dataReliability);

    const reliability =
      explicitReliability !== null
        ? this.clamp(this.readRate(explicitReliability) ?? 0, 0, 1)
        : sampleQuality;

    return this.clamp(sampleQuality * 0.5 + reliability * 0.5, 0, 1);
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

    if (denominator <= 0) {
      return 0.5;
    }

    return this.clamp(numerator / denominator, 0, 1);
  }

  private opponentAdjustedValue(
    team: RawPredictionFeatures['home'],
    selector: (
      adjusted: NonNullable<RawPredictionFeatures['home']['opponentAdjusted']>,
    ) => number | null,
  ): number | null {
    const adjusted = team.opponentAdjusted;

    /*
     * An unavailable opponent-adjusted dataset must be absent from
     * the weighted mean, not represented by zero or neutral fabricated
     * evidence.
     */
    if (!adjusted?.available) {
      return null;
    }

    return selector(adjusted);
  }

  private sampleReliability(sampleSize: number): number {
    if (!Number.isFinite(sampleSize) || sampleSize <= 0) {
      return 0;
    }

    /*
     * Smooth evidence accumulation rather than a hard threshold.
     * This represents diminishing returns from additional matches.
     */
    return this.clamp(1 - Math.exp(-sampleSize / 12), 0, 1);
  }

  private normalizeGoals(value: number | null | undefined): number | null {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return null;
    }

    return this.clamp(value / 3, 0, 1);
  }

  private normalizeDefence(value: number | null | undefined): number | null {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return null;
    }

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

  private readBoolean(value: unknown): boolean {
    return value === true;
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
