// src/predictions-engine/services/raw-prediction-feature.service.ts

import { Injectable } from '@nestjs/common';

import { RawHistoricalMatchFeatures } from '../interfaces/raw-historical-match-features.interface';
import { RawHeadToHeadFeatures } from '../interfaces/raw-head-to-head-features.interface';
import { RawPredictionFeatures } from '../interfaces/raw-prediction-features.interface';
import { RawPredictionMatchInput } from '../interfaces/raw-prediction-match.interface';

import {
  RawStandingFeatures,
  RawStandingTeamFeatures,
} from '../interfaces/raw-standing-features.interface';

import {
  RawTeamFeatures,
  RawTeamHalfFeatures,
  RawTeamOpponentAdjustedFeatures,
  RawTeamRecentFeatures,
  RawTeamVenueFeatures,
} from '../interfaces/raw-team-features.interface';

import { TeamComparisonService } from './team-comparison.service';

interface CompetitionRatingState {
  rating: number;
  played: number;
}

interface CompetitionRatingSnapshot {
  homeRating: number;
  awayRating: number;
  homeStrength: number;
  awayStrength: number;
}

interface CompetitionStrength {
  snapshots: Map<string, CompetitionRatingSnapshot>;
  finalRatings: Map<string, number>;
  finalStrengths: Map<string, number>;
}

@Injectable()
export class RawPredictionFeatureService {
  private static readonly DEFAULT_ELO_RATING = 1500;

  private static readonly ELO_K_FACTOR = 24;

  private static readonly HOME_ADVANTAGE_RATING = 60;

  /*
   * True recency half-life.
   *
   * At 365 days old, otherwise identical evidence has 50%
   * of the weight of current evidence.
   */
  private static readonly RECENCY_HALF_LIFE_DAYS = 365;

  /*
   * Opponent-strength normalization.
   *
   * 50 = neutral opponent strength.
   *
   * The square-root transformation deliberately moderates the
   * adjustment so opponent quality matters without allowing a
   * single extreme rating to dominate historical performance.
   *
   * Final factor is bounded to prevent unstable adjustments.
   */
  private static readonly OPPONENT_ADJUSTMENT_MIN = 0.75;

  private static readonly OPPONENT_ADJUSTMENT_MAX = 1.333333;

  private static readonly COMPLETED_STATUSES = [
    'completed',
    'complete',
    'finished',
    'final',
    'ft',
    'full_time',
    'full-time',
  ];

  constructor(private readonly teamComparisonService: TeamComparisonService) {}

  build(input: RawPredictionMatchInput): RawPredictionFeatures {
    const fixture = input.fixture;

    const homeTeamId = this.readString(fixture.homeTeamId);

    const awayTeamId = this.readString(fixture.awayTeamId);

    const fixtureDate = new Date(fixture.fixtureDate);

    const homeHistorical = this.toHistoricalMatches(
      input.homeHistoricalFixtures,
    );

    const awayHistorical = this.toHistoricalMatches(
      input.awayHistoricalFixtures,
    );

    const competitionHistorical = this.toHistoricalMatches(
      input.competitionHistoricalFixtures,
    );

    const competitionStrength = this.calculateCompetitionStrength(
      competitionHistorical,
    );

    const home = this.buildTeamFeatures(
      homeTeamId,
      input.homeTeam?.name ?? homeTeamId,
      homeHistorical,
      true,
      input.homeTeamCompetitionStats,
      input.homeTeamPerformanceProfile,
      competitionStrength,
      fixtureDate,
    );

    const away = this.buildTeamFeatures(
      awayTeamId,
      input.awayTeam?.name ?? awayTeamId,
      awayHistorical,
      false,
      input.awayTeamCompetitionStats,
      input.awayTeamPerformanceProfile,
      competitionStrength,
      fixtureDate,
    );

    const standings = this.buildStandings(
      homeTeamId,
      input.homeStanding,
      awayTeamId,
      input.awayStanding,
    );

    const h2h = this.buildHeadToHead(input.headToHead, homeTeamId);

    const comparison = this.teamComparisonService.build({
      home,
      away,
      standings,
      h2h,
    });

    const overallSampleSize = Math.min(home.sampleSize, away.sampleSize);

    const dataCompleteness = this.calculateDataCompleteness(
      home,
      away,
      standings,
      h2h,
    );

    const historicalDataQuality = this.calculateHistoricalDataQuality(
      homeHistorical,
      awayHistorical,
      home,
      away,
      fixtureDate,
    );

    const sportsSourceQuality = this.calculateSportsSourceQuality(home, away);

    const overallDataQuality = this.clamp(
      dataCompleteness * 0.25 +
        historicalDataQuality * 0.45 +
        sportsSourceQuality * 0.2 +
        this.calculateOpponentAdjustmentQuality(home, away) * 0.1,
      0,
      100,
    );

    return {
      eventId: this.readString(fixture.eventId),

      competitionId: this.readString(fixture.leagueId).toLowerCase(),

      season: this.toNumber(fixture.season),

      fixtureDate,

      homeTeamId,

      awayTeamId,

      homeTeamName: home.teamName,

      awayTeamName: away.teamName,

      home,

      away,

      standings,

      h2h,

      comparison,

      overallSampleSize,

      dataCompleteness,

      historicalDataQuality,

      overallDataQuality,

      generatedAt: new Date(),
    };
  }

  private buildTeamFeatures(
    teamId: string,
    teamName: string,
    historical: RawHistoricalMatchFeatures[],
    isHomeTeam: boolean,
    teamStats: unknown,
    performanceProfileData: unknown,
    competitionStrength: CompetitionStrength,
    fixtureDate: Date,
  ): RawTeamFeatures {
    const sorted = [...historical]
      .filter((match) => this.isValidHistoricalMatch(match))
      .filter((match) => match.fixtureDate.getTime() < fixtureDate.getTime())
      .sort((a, b) => b.fixtureDate.getTime() - a.fixtureDate.getTime());

    const recent = sorted.slice(0, 5);

    const venueFixtures = sorted.filter((match) =>
      isHomeTeam ? match.homeTeamId === teamId : match.awayTeamId === teamId,
    );

    const overall = this.calculateAggregate(sorted, teamId);

    const recentFeatures = this.calculateRecent(recent, teamId);

    const venue = this.calculateVenue(venueFixtures, teamId);

    /*
     * ESPN fixture history supplied to this layer does not guarantee
     * half-time score or scoring-event timing.
     *
     * Never manufacture these values from full-time scores.
     */
    const firstHalf = this.calculateHalf();

    const secondHalf = this.calculateHalf();

    const scoredFirstRate = this.calculateScoredFirstRate();

    const competitionStats = this.toPlainRecord(teamStats);

    const performanceProfile = this.toPlainRecord(performanceProfileData);

    const opponentAdjusted = this.calculateOpponentAdjustedFeatures(
      sorted,
      teamId,
      competitionStrength.snapshots,
      competitionStrength.finalRatings,
      competitionStrength.finalStrengths,
      fixtureDate,
    );

    return {
      teamId,

      teamName,

      sampleSize: overall.sampleSize,

      wins: overall.wins,

      draws: overall.draws,

      losses: overall.losses,

      points: overall.points,

      pointsPerMatch: overall.pointsPerMatch,

      goalsScored: overall.goalsScored,

      goalsConceded: overall.goalsConceded,

      averageGoalsScored: overall.averageGoalsScored,

      averageGoalsConceded: overall.averageGoalsConceded,

      winRate: overall.winRate,

      drawRate: overall.drawRate,

      lossRate: overall.lossRate,

      bttsRate: overall.bttsRate,

      cleanSheetRate: overall.cleanSheetRate,

      failedToScoreRate: overall.failedToScoreRate,

      over05Rate: overall.over05Rate,

      over15Rate: overall.over15Rate,

      over25Rate: overall.over25Rate,

      over35Rate: overall.over35Rate,

      over45Rate: overall.over45Rate,

      over55Rate: overall.over55Rate,

      firstHalf,

      secondHalf,

      scoredFirstRate,

      recent: recentFeatures,

      venue,

      opponentAdjusted,

      sourceData: {
        competitionStats,

        performanceProfile,
      },

      /*
       * This historical array is intentionally preserved.
       *
       * Phase 2 probability models use these actual historical
       * observations as the underlying evidence set.
       */
      historical: sorted,

      dataAvailability: {
        historicalMatches: sorted.length > 0,

        recentForm: recent.length > 0,

        venueMatches: venue.sampleSize > 0,

        halfTimeData: firstHalf.sampleSize > 0 || secondHalf.sampleSize > 0,

        /*
         * Scoring-first data is unavailable in this layer.
         *
         * 0 therefore means unavailable, not measured 0%.
         */
        scoredFirstData: false,

        competitionStats: Object.keys(competitionStats).length > 0,

        performanceProfile: Object.keys(performanceProfile).length > 0,

        opponentAdjustedData: opponentAdjusted.available,
      },
    };
  }

  private calculateAggregate(
    matches: RawHistoricalMatchFeatures[],
    teamId: string,
  ): RawTeamFeatures {
    const validMatches = matches.filter(
      (match) =>
        this.isValidHistoricalMatch(match) &&
        (match.homeTeamId === teamId || match.awayTeamId === teamId),
    );

    const sampleSize = validMatches.length;

    let wins = 0;

    let draws = 0;

    let losses = 0;

    let goalsScored = 0;

    let goalsConceded = 0;

    let btts = 0;

    let cleanSheets = 0;

    let failedToScore = 0;

    let over05 = 0;

    let over15 = 0;

    let over25 = 0;

    let over35 = 0;

    let over45 = 0;

    let over55 = 0;

    for (const match of validMatches) {
      const teamIsHome = match.homeTeamId === teamId;

      const scored = teamIsHome ? match.homeGoals : match.awayGoals;

      const conceded = teamIsHome ? match.awayGoals : match.homeGoals;

      if (scored > conceded) {
        wins++;
      } else if (scored === conceded) {
        draws++;
      } else {
        losses++;
      }

      goalsScored += Math.max(scored, 0);

      goalsConceded += Math.max(conceded, 0);

      if (scored > 0 && conceded > 0) {
        btts++;
      }

      if (conceded === 0) {
        cleanSheets++;
      }

      if (scored === 0) {
        failedToScore++;
      }

      const total = Math.max(match.totalGoals, 0);

      if (total > 0) {
        over05++;
      }

      if (total > 1) {
        over15++;
      }

      if (total > 2) {
        over25++;
      }

      if (total > 3) {
        over35++;
      }

      if (total > 4) {
        over45++;
      }

      if (total > 5) {
        over55++;
      }
    }

    const points = wins * 3 + draws;

    return {
      ...this.emptyTeamFeatures(teamId, teamId),

      sampleSize,

      wins,

      draws,

      losses,

      points,

      pointsPerMatch: this.safeDivide(points, sampleSize),

      goalsScored,

      goalsConceded,

      averageGoalsScored: this.safeDivide(goalsScored, sampleSize),

      averageGoalsConceded: this.safeDivide(goalsConceded, sampleSize),

      winRate: this.safeDivide(wins, sampleSize),

      drawRate: this.safeDivide(draws, sampleSize),

      lossRate: this.safeDivide(losses, sampleSize),

      bttsRate: this.safeDivide(btts, sampleSize),

      cleanSheetRate: this.safeDivide(cleanSheets, sampleSize),

      failedToScoreRate: this.safeDivide(failedToScore, sampleSize),

      over05Rate: this.safeDivide(over05, sampleSize),

      over15Rate: this.safeDivide(over15, sampleSize),

      over25Rate: this.safeDivide(over25, sampleSize),

      over35Rate: this.safeDivide(over35, sampleSize),

      over45Rate: this.safeDivide(over45, sampleSize),

      over55Rate: this.safeDivide(over55, sampleSize),
    };
  }

  private calculateRecent(
    matches: RawHistoricalMatchFeatures[],
    teamId: string,
  ): RawTeamRecentFeatures {
    const base = this.calculateAggregate(matches, teamId);

    return {
      sampleSize: base.sampleSize,

      wins: base.wins,

      draws: base.draws,

      losses: base.losses,

      points: base.points,

      pointsPerMatch: base.pointsPerMatch,

      goalsScored: base.goalsScored,

      goalsConceded: base.goalsConceded,

      averageGoalsScored: base.averageGoalsScored,

      averageGoalsConceded: base.averageGoalsConceded,

      winRate: base.winRate,

      drawRate: base.drawRate,

      lossRate: base.lossRate,

      bttsRate: base.bttsRate,

      cleanSheetRate: base.cleanSheetRate,

      failedToScoreRate: base.failedToScoreRate,

      over05Rate: base.over05Rate,

      over15Rate: base.over15Rate,

      over25Rate: base.over25Rate,

      over35Rate: base.over35Rate,

      over45Rate: base.over45Rate,

      over55Rate: base.over55Rate,
    };
  }

  private calculateVenue(
    matches: RawHistoricalMatchFeatures[],
    teamId: string,
  ): RawTeamVenueFeatures {
    const base = this.calculateAggregate(matches, teamId);

    return {
      sampleSize: base.sampleSize,

      wins: base.wins,

      draws: base.draws,

      losses: base.losses,

      points: base.points,

      pointsPerMatch: base.pointsPerMatch,

      goalsScored: base.goalsScored,

      goalsConceded: base.goalsConceded,

      averageGoalsScored: base.averageGoalsScored,

      averageGoalsConceded: base.averageGoalsConceded,

      winRate: base.winRate,

      drawRate: base.drawRate,

      lossRate: base.lossRate,

      bttsRate: base.bttsRate,

      cleanSheetRate: base.cleanSheetRate,

      failedToScoreRate: base.failedToScoreRate,

      over05Rate: base.over05Rate,

      over15Rate: base.over15Rate,

      over25Rate: base.over25Rate,

      over35Rate: base.over35Rate,

      over45Rate: base.over45Rate,

      over55Rate: base.over55Rate,
    };
  }

  private calculateOpponentAdjustedFeatures(
    matches: RawHistoricalMatchFeatures[],
    teamId: string,
    snapshots: Map<string, CompetitionRatingSnapshot>,
    finalRatings: Map<string, number>,
    finalStrengths: Map<string, number>,
    fixtureDate: Date,
  ): RawTeamOpponentAdjustedFeatures {
    if (!matches.length) {
      return this.emptyOpponentAdjusted();
    }

    let totalWeight = 0;

    let totalOpponentStrength = 0;

    let weightedGoalsScored = 0;

    let weightedGoalsConceded = 0;

    let weightedPoints = 0;

    let weightedWins = 0;

    let weightedLosses = 0;

    let usable = 0;

    /*
     * Only historical matches with a PRE-MATCH opponent rating
     * are eligible for opponent-adjusted evidence.
     *
     * This is essential for preventing temporal leakage.
     */
    for (const match of matches) {
      if (!this.isValidHistoricalMatch(match)) {
        continue;
      }

      if (match.homeTeamId !== teamId && match.awayTeamId !== teamId) {
        continue;
      }

      const snapshot = snapshots.get(match.eventId);

      if (!snapshot) {
        /*
         * The ordinary historical/venue/recent features still retain
         * this match. It is simply excluded from opponent-adjusted
         * evidence because the historical opponent strength cannot
         * be established safely.
         */
        continue;
      }

      const teamIsHome = match.homeTeamId === teamId;

      const opponentId = teamIsHome ? match.awayTeamId : match.homeTeamId;

      if (!opponentId || opponentId === teamId) {
        continue;
      }

      const scored = teamIsHome ? match.homeGoals : match.awayGoals;

      const conceded = teamIsHome ? match.awayGoals : match.homeGoals;

      const opponentStrength = this.getSnapshotOpponentStrength(
        match,
        snapshot,
        opponentId,
      );

      if (opponentStrength === null) {
        continue;
      }

      const recencyWeight = this.calculateRecencyWeight(
        match.fixtureDate,
        fixtureDate,
      );

      if (!Number.isFinite(recencyWeight) || recencyWeight <= 0) {
        continue;
      }

      /*
       * Convert opponent strength into a neutral-opponent difficulty
       * factor.
       *
       * 50 strength = neutral => factor 1.
       *
       * Stronger opponent:
       *   - scoring is harder, so observed goals scored receive
       *     a positive normalization.
       *   - conceding is less damaging, so observed goals conceded
       *     receive a downward normalization.
       *
       * We use sqrt rather than a linear transformation to avoid
       * exaggerated corrections.
       */
      const opponentAdjustmentFactor =
        this.calculateOpponentAdjustmentFactor(opponentStrength);

      const adjustedGoalsScored = scored * opponentAdjustmentFactor;

      const adjustedGoalsConceded = conceded / opponentAdjustmentFactor;

      /*
       * The adjusted result is derived from the normalized scoring
       * performance rather than simply copying the actual W/D/L.
       *
       * This means the opponent-adjusted win/draw/loss rates describe
       * performance after neutralizing opponent difficulty.
       */
      const adjustedResult =
        adjustedGoalsScored > adjustedGoalsConceded
          ? 'win'
          : adjustedGoalsScored < adjustedGoalsConceded
            ? 'loss'
            : 'draw';

      const adjustedPoints =
        adjustedResult === 'win' ? 3 : adjustedResult === 'draw' ? 1 : 0;

      totalWeight += recencyWeight;

      totalOpponentStrength += opponentStrength * recencyWeight;

      weightedGoalsScored += adjustedGoalsScored * recencyWeight;

      weightedGoalsConceded += adjustedGoalsConceded * recencyWeight;

      weightedPoints += adjustedPoints * recencyWeight;

      if (adjustedResult === 'win') {
        weightedWins += recencyWeight;
      } else if (adjustedResult !== 'draw') {
        weightedLosses += recencyWeight;
      }

      usable += 1;
    }

    if (totalWeight <= 0 || usable <= 0) {
      return this.emptyOpponentAdjusted();
    }

    /*
     * Final strength/rating is current-state diagnostic information.
     *
     * It is deliberately NOT used to evaluate historical opponents.
     * Historical opponent strength above comes exclusively from the
     * corresponding pre-match snapshot.
     */
    const strengthRating =
      finalStrengths.get(teamId) ??
      this.ratingToStrength(
        finalRatings.get(teamId) ??
          RawPredictionFeatureService.DEFAULT_ELO_RATING,
      );

    return {
      available: true,

      sampleSize: usable,

      effectiveSampleSize: Number(totalWeight.toFixed(4)),

      scheduleStrength: this.clamp(totalOpponentStrength / totalWeight, 0, 100),

      strengthRating: this.clamp(strengthRating, 0, 100),

      averageGoalsScored: Math.max(weightedGoalsScored / totalWeight, 0),

      averageGoalsConceded: Math.max(weightedGoalsConceded / totalWeight, 0),

      pointsPerMatch: this.clamp(weightedPoints / totalWeight, 0, 3),

      winRate: this.clamp(weightedWins / totalWeight, 0, 1),

      lossRate: this.clamp(weightedLosses / totalWeight, 0, 1),
    };
  }

  private calculateOpponentAdjustmentFactor(opponentStrength: number): number {
    if (!Number.isFinite(opponentStrength)) {
      return 1;
    }

    const normalizedStrength = this.clamp(
      opponentStrength / 50,
      0.5625,
      1.777777,
    );

    return this.clamp(
      Math.sqrt(normalizedStrength),
      RawPredictionFeatureService.OPPONENT_ADJUSTMENT_MIN,
      RawPredictionFeatureService.OPPONENT_ADJUSTMENT_MAX,
    );
  }

  private getSnapshotOpponentStrength(
    match: RawHistoricalMatchFeatures,
    snapshot: CompetitionRatingSnapshot,
    opponentId: string,
  ): number | null {
    let strength: number;

    if (match.homeTeamId === opponentId) {
      strength = snapshot.homeStrength;
    } else if (match.awayTeamId === opponentId) {
      strength = snapshot.awayStrength;
    } else {
      return null;
    }

    if (!Number.isFinite(strength)) {
      return null;
    }

    return this.clamp(strength, 0, 100);
  }

  private calculateRecencyWeight(matchDate: Date, fixtureDate: Date): number {
    const matchTime = matchDate.getTime();

    const fixtureTime = fixtureDate.getTime();

    if (!Number.isFinite(matchTime) || !Number.isFinite(fixtureTime)) {
      return 0;
    }

    /*
     * Historical records should always be before the prediction
     * fixture. Defensive handling prevents future records from
     * receiving an inflated weight.
     */
    const ageDays = Math.max(0, (fixtureTime - matchTime) / 86_400_000);

    return this.clamp(
      Math.pow(
        0.5,
        ageDays / RawPredictionFeatureService.RECENCY_HALF_LIFE_DAYS,
      ),
      0,
      1,
    );
  }

  private calculateCompetitionStrength(
    fixtures: RawHistoricalMatchFeatures[],
  ): CompetitionStrength {
    const snapshots = new Map<string, CompetitionRatingSnapshot>();

    const ratings = new Map<string, CompetitionRatingState>();

    const sorted = [...fixtures]
      .filter((fixture) => this.isValidHistoricalMatch(fixture))
      .sort((a, b) => a.fixtureDate.getTime() - b.fixtureDate.getTime());

    for (const fixture of sorted) {
      const homeTeamId = fixture.homeTeamId;

      const awayTeamId = fixture.awayTeamId;

      if (!homeTeamId || !awayTeamId || homeTeamId === awayTeamId) {
        continue;
      }

      const homeState = ratings.get(homeTeamId) ?? {
        rating: RawPredictionFeatureService.DEFAULT_ELO_RATING,
        played: 0,
      };

      const awayState = ratings.get(awayTeamId) ?? {
        rating: RawPredictionFeatureService.DEFAULT_ELO_RATING,
        played: 0,
      };

      /*
       * PRE-MATCH snapshot.
       *
       * The match being evaluated cannot influence the opponent
       * strength used for that same match.
       */
      snapshots.set(fixture.eventId, {
        homeRating: homeState.rating,

        awayRating: awayState.rating,

        homeStrength: this.ratingToStrength(homeState.rating),

        awayStrength: this.ratingToStrength(awayState.rating),
      });

      const expectedHome = this.eloExpectedScore(
        homeState.rating + RawPredictionFeatureService.HOME_ADVANTAGE_RATING,
        awayState.rating,
      );

      const actualHome =
        fixture.homeGoals > fixture.awayGoals
          ? 1
          : fixture.homeGoals === fixture.awayGoals
            ? 0.5
            : 0;

      const goalDifference = Math.abs(fixture.homeGoals - fixture.awayGoals);

      const goalMultiplier =
        goalDifference > 1 ? 1 + Math.log1p(goalDifference) * 0.45 : 1;

      const effectiveK =
        RawPredictionFeatureService.ELO_K_FACTOR * goalMultiplier;

      const homeChange = effectiveK * (actualHome - expectedHome);

      const awayChange = -homeChange;

      homeState.rating += homeChange;

      awayState.rating += awayChange;

      homeState.played += 1;

      awayState.played += 1;

      ratings.set(homeTeamId, homeState);

      ratings.set(awayTeamId, awayState);
    }

    const finalRatings = new Map<string, number>();

    const finalStrengths = new Map<string, number>();

    for (const [teamId, state] of ratings.entries()) {
      /*
       * Early-season ratings are shrunk toward neutral.
       *
       * This controls instability caused by very small samples.
       */
      const sampleReliability = this.clamp(
        1 - Math.exp(-state.played / 8),
        0,
        1,
      );

      const shrunkRating =
        RawPredictionFeatureService.DEFAULT_ELO_RATING +
        (state.rating - RawPredictionFeatureService.DEFAULT_ELO_RATING) *
          sampleReliability;

      finalRatings.set(teamId, shrunkRating);

      finalStrengths.set(teamId, this.ratingToStrength(shrunkRating));
    }

    return {
      snapshots,

      finalRatings,

      finalStrengths,
    };
  }

  private eloExpectedScore(homeRating: number, awayRating: number): number {
    const difference = awayRating - homeRating;

    return 1 / (1 + Math.pow(10, difference / 400));
  }

  private ratingToStrength(rating: number): number {
    if (!Number.isFinite(rating)) {
      return 50;
    }

    /*
     * Internal strength scale only.
     *
     * 1500 Elo = 50 strength.
     *
     * This is NOT a probability.
     */
    return this.clamp(
      50 + (rating - RawPredictionFeatureService.DEFAULT_ELO_RATING) / 8,
      0,
      100,
    );
  }

  private calculateOpponentAdjustmentQuality(
    home: RawTeamFeatures,
    away: RawTeamFeatures,
  ): number {
    const homeQuality = home.opponentAdjusted.available
      ? this.calculateOpponentEvidenceQuality(
          home.opponentAdjusted.sampleSize,
          home.opponentAdjusted.effectiveSampleSize,
        )
      : 0;

    const awayQuality = away.opponentAdjusted.available
      ? this.calculateOpponentEvidenceQuality(
          away.opponentAdjusted.sampleSize,
          away.opponentAdjusted.effectiveSampleSize,
        )
      : 0;

    return ((homeQuality + awayQuality) / 2) * 100;
  }

  private calculateOpponentEvidenceQuality(
    sampleSize: number,
    effectiveSampleSize: number,
  ): number {
    if (
      !Number.isFinite(sampleSize) ||
      sampleSize <= 0 ||
      !Number.isFinite(effectiveSampleSize) ||
      effectiveSampleSize <= 0
    ) {
      return 0;
    }

    /*
     * Actual usable observations and effective recency-weighted
     * observations both contribute.
     */
    const sampleQuality = this.sampleReliability(sampleSize);

    const effectiveQuality = this.sampleReliability(effectiveSampleSize);

    return this.clamp(sampleQuality * 0.5 + effectiveQuality * 0.5, 0, 1);
  }

  private calculateScoredFirstRate(): number {
    /*
     * Scoring-event timing is not guaranteed by the historical
     * fixture documents available to this layer.
     *
     * Zero therefore represents unavailable data.
     *
     * dataAvailability.scoredFirstData remains false.
     */
    return 0;
  }

  private calculateHalf(): RawTeamHalfFeatures {
    /*
     * No half-time score is fabricated from full-time scores.
     */
    return {
      sampleSize: 0,

      goalsScored: 0,

      goalsConceded: 0,

      averageGoalsScored: 0,

      averageGoalsConceded: 0,
    };
  }

  private buildStandings(
    homeTeamId: string,
    homeStanding: unknown,
    awayTeamId: string,
    awayStanding: unknown,
  ): RawStandingFeatures {
    return {
      home: this.toStandingFeatures(homeTeamId, homeStanding),

      away: this.toStandingFeatures(awayTeamId, awayStanding),
    };
  }

  private toStandingFeatures(
    teamId: string,
    standing: unknown,
  ): RawStandingTeamFeatures | null {
    if (!standing || typeof standing !== 'object') {
      return null;
    }

    const record = standing as Record<string, unknown>;

    return {
      teamId,

      rank: this.toNumber(record['rank']),

      points: this.toNumber(record['points']),

      played: this.toNumber(record['played']),

      wins: this.toNumber(record['wins']),

      draws: this.toNumber(record['draws']),

      losses: this.toNumber(record['losses']),

      goalsFor: this.toNumber(record['goalsFor'] ?? record['gf']),

      goalsAgainst: this.toNumber(record['goalsAgainst'] ?? record['ga']),

      goalDifference: this.toNumber(record['goalDifference'] ?? record['gd']),

      form: typeof record['form'] === 'string' ? record['form'] : null,
    };
  }

  private buildHeadToHead(
    headToHead: unknown,
    homeTeamId: string,
  ): RawHeadToHeadFeatures | null {
    if (!headToHead || typeof headToHead !== 'object') {
      return null;
    }

    const record = headToHead as Record<string, unknown>;

    /*
     * If the actual meeting array exists, it is authoritative.
     *
     * This prevents stale aggregate values from surviving after
     * future or invalid meetings have been removed.
     */
    if (Array.isArray(record['meetings'])) {
      return this.buildHeadToHeadFromMeetings(
        record['meetings'],
        homeTeamId,
        record,
      );
    }

    /*
     * Aggregate-only H2H documents remain supported.
     *
     * Missing reliability is estimated from sample size rather
     * than treated as complete evidence.
     */
    const teamAValue = record['teamAId'] ?? record['homeTeamId'];

    const teamA = this.readString(teamAValue);

    const homeIsTeamA = teamA !== '' && teamA === homeTeamId;

    const homeWins = homeIsTeamA
      ? this.toNumber(record['teamAWins'] ?? record['homeWins'])
      : this.toNumber(record['teamBWins'] ?? record['awayWins']);

    const awayWins = homeIsTeamA
      ? this.toNumber(record['teamBWins'] ?? record['awayWins'])
      : this.toNumber(record['teamAWins'] ?? record['homeWins']);

    const draws = this.toNumber(record['draws']);

    const sampleSize = this.toNumber(
      record['sampleSize'] ?? record['totalMeetings'],
    );

    if (sampleSize <= 0) {
      return null;
    }

    const explicitReliability =
      record['dataReliability'] ?? record['dataCompletenessScore'];

    const dataReliability =
      explicitReliability !== undefined
        ? this.readRate(explicitReliability)
        : this.sampleReliability(sampleSize);

    return {
      available: true,

      sampleSize,

      homeWins,

      draws,

      awayWins,

      averageGoalsForHome: this.toNumber(
        homeIsTeamA
          ? (record['averageGoalsTeamA'] ??
              record['averageTeamAGoals'] ??
              record['averageGoalsHome'])
          : (record['averageGoalsTeamB'] ??
              record['averageTeamBGoals'] ??
              record['averageGoalsAway']),
      ),

      averageGoalsForAway: this.toNumber(
        homeIsTeamA
          ? (record['averageGoalsTeamB'] ??
              record['averageTeamBGoals'] ??
              record['averageGoalsAway'])
          : (record['averageGoalsTeamA'] ??
              record['averageTeamAGoals'] ??
              record['averageGoalsHome']),
      ),

      averageGoalsForTeam: this.toNumber(
        homeIsTeamA
          ? (record['averageGoalsTeamA'] ??
              record['averageTeamAGoals'] ??
              record['averageGoalsHome'])
          : (record['averageGoalsTeamB'] ??
              record['averageTeamBGoals'] ??
              record['averageGoalsAway']),
      ),

      averageTotalGoals: this.toNumber(record['averageTotalGoals']),

      bttsRate: this.readRate(record['bttsRate']),

      cleanSheetHomeRate: this.readRate(
        homeIsTeamA
          ? (record['cleanSheetTeamARate'] ?? record['cleanSheetHomeRate'])
          : (record['cleanSheetTeamBRate'] ?? record['cleanSheetAwayRate']),
      ),

      cleanSheetAwayRate: this.readRate(
        homeIsTeamA
          ? (record['cleanSheetTeamBRate'] ?? record['cleanSheetAwayRate'])
          : (record['cleanSheetTeamARate'] ?? record['cleanSheetHomeRate']),
      ),

      failedToScoreHomeRate: this.readRate(
        homeIsTeamA
          ? record['failedToScoreTeamARate']
          : record['failedToScoreTeamBRate'],
      ),

      failedToScoreAwayRate: this.readRate(
        homeIsTeamA
          ? record['failedToScoreTeamBRate']
          : record['failedToScoreTeamARate'],
      ),

      over05Rate: this.readRate(record['over05Rate']),

      over15Rate: this.readRate(record['over15Rate']),

      over25Rate: this.readRate(record['over25Rate']),

      over35Rate: this.readRate(record['over35Rate']),

      over45Rate: this.readRate(record['over45Rate']),

      over55Rate: this.readRate(record['over55Rate']),

      homeScoredFirstRate: this.readRate(
        homeIsTeamA
          ? record['teamAScoredFirstRate']
          : record['teamBScoredFirstRate'],
      ),

      awayScoredFirstRate: this.readRate(
        homeIsTeamA
          ? record['teamBScoredFirstRate']
          : record['teamAScoredFirstRate'],
      ),

      dataReliability: this.clamp(dataReliability, 0, 1),
    };
  }

  private buildHeadToHeadFromMeetings(
    meetings: unknown[],
    homeTeamId: string,
    parent: Record<string, unknown>,
  ): RawHeadToHeadFeatures {
    let homeWins = 0;

    let draws = 0;

    let awayWins = 0;

    let homeGoals = 0;

    let awayGoals = 0;

    let btts = 0;

    let homeCleanSheets = 0;

    let awayCleanSheets = 0;

    let homeFailedToScore = 0;

    let awayFailedToScore = 0;

    let over05 = 0;

    let over15 = 0;

    let over25 = 0;

    let over35 = 0;

    let over45 = 0;

    let over55 = 0;

    let homeScoredFirst = 0;

    let awayScoredFirst = 0;

    let validMeetings = 0;

    for (const meeting of meetings) {
      if (!meeting || typeof meeting !== 'object') {
        continue;
      }

      const record = meeting as Record<string, unknown>;

      const homeId = this.readString(record['homeTeamId']);

      const awayId = this.readString(record['awayTeamId']);

      const homeScore = this.readScoreValue(record['homeGoals']);

      const awayScore = this.readScoreValue(record['awayGoals']);

      const meetingDate = this.readDate(
        record['fixtureDate'] ?? record['date'] ?? record['matchDate'],
      );

      if (
        !homeId ||
        !awayId ||
        homeId === awayId ||
        homeScore === null ||
        awayScore === null
      ) {
        continue;
      }

      if (!meetingDate) {
        continue;
      }

      if (homeId !== homeTeamId && awayId !== homeTeamId) {
        continue;
      }

      validMeetings += 1;

      /*
       * Re-orient the historical meeting so the current prediction
       * home team remains the H2H home side.
       */
      const currentHomeGoals = homeId === homeTeamId ? homeScore : awayScore;

      const currentAwayGoals = homeId === homeTeamId ? awayScore : homeScore;

      homeGoals += currentHomeGoals;

      awayGoals += currentAwayGoals;

      if (currentHomeGoals > currentAwayGoals) {
        homeWins += 1;
      } else if (currentHomeGoals < currentAwayGoals) {
        awayWins += 1;
      } else {
        draws += 1;
      }

      if (currentHomeGoals > 0 && currentAwayGoals > 0) {
        btts += 1;
      }

      if (currentAwayGoals === 0) {
        homeCleanSheets += 1;
      }

      if (currentHomeGoals === 0) {
        awayCleanSheets += 1;
      }

      if (currentHomeGoals === 0) {
        homeFailedToScore += 1;
      }

      if (currentAwayGoals === 0) {
        awayFailedToScore += 1;
      }

      const total = currentHomeGoals + currentAwayGoals;

      if (total > 0) {
        over05 += 1;
      }

      if (total > 1) {
        over15 += 1;
      }

      if (total > 2) {
        over25 += 1;
      }

      if (total > 3) {
        over35 += 1;
      }

      if (total > 4) {
        over45 += 1;
      }

      if (total > 5) {
        over55 += 1;
      }

      const homeFirst = record['homeScoredFirst'];

      const awayFirst = record['awayScoredFirst'];

      /*
       * Only explicit boolean observations are accepted.
       */
      if (homeId === homeTeamId) {
        if (homeFirst === true) {
          homeScoredFirst += 1;
        } else if (awayFirst === true) {
          awayScoredFirst += 1;
        }
      } else {
        if (awayFirst === true) {
          homeScoredFirst += 1;
        } else if (homeFirst === true) {
          awayScoredFirst += 1;
        }
      }
    }

    const sampleSize = validMeetings;

    if (sampleSize <= 0) {
      return {
        available: false,

        sampleSize: 0,

        homeWins: 0,

        draws: 0,

        awayWins: 0,

        averageGoalsForHome: 0,

        averageGoalsForAway: 0,

        averageGoalsForTeam: 0,

        averageTotalGoals: 0,

        bttsRate: 0,

        cleanSheetHomeRate: 0,

        cleanSheetAwayRate: 0,

        failedToScoreHomeRate: 0,

        failedToScoreAwayRate: 0,

        over05Rate: 0,

        over15Rate: 0,

        over25Rate: 0,

        over35Rate: 0,

        over45Rate: 0,

        over55Rate: 0,

        homeScoredFirstRate: 0,

        awayScoredFirstRate: 0,

        dataReliability: 0,
      };
    }

    const explicitReliability =
      parent['dataReliability'] ?? parent['dataCompletenessScore'];

    const dataReliability =
      explicitReliability !== undefined
        ? this.readRate(explicitReliability)
        : this.sampleReliability(sampleSize);

    return {
      available: true,

      sampleSize,

      homeWins,

      draws,

      awayWins,

      averageGoalsForHome: this.safeDivide(homeGoals, sampleSize),

      averageGoalsForAway: this.safeDivide(awayGoals, sampleSize),

      averageGoalsForTeam: this.safeDivide(homeGoals, sampleSize),

      averageTotalGoals: this.safeDivide(homeGoals + awayGoals, sampleSize),

      bttsRate: this.safeDivide(btts, sampleSize),

      cleanSheetHomeRate: this.safeDivide(homeCleanSheets, sampleSize),

      cleanSheetAwayRate: this.safeDivide(awayCleanSheets, sampleSize),

      failedToScoreHomeRate: this.safeDivide(homeFailedToScore, sampleSize),

      failedToScoreAwayRate: this.safeDivide(awayFailedToScore, sampleSize),

      over05Rate: this.safeDivide(over05, sampleSize),

      over15Rate: this.safeDivide(over15, sampleSize),

      over25Rate: this.safeDivide(over25, sampleSize),

      over35Rate: this.safeDivide(over35, sampleSize),

      over45Rate: this.safeDivide(over45, sampleSize),

      over55Rate: this.safeDivide(over55, sampleSize),

      homeScoredFirstRate: this.safeDivide(homeScoredFirst, sampleSize),

      awayScoredFirstRate: this.safeDivide(awayScoredFirst, sampleSize),

      dataReliability: this.clamp(dataReliability, 0, 1),
    };
  }

  private toHistoricalMatches(
    fixtures: readonly unknown[],
  ): RawHistoricalMatchFeatures[] {
    if (!Array.isArray(fixtures)) {
      return [];
    }

    const results: RawHistoricalMatchFeatures[] = [];

    for (const fixture of fixtures) {
      if (!fixture || typeof fixture !== 'object') {
        continue;
      }

      const record = fixture as Record<string, unknown>;

      const homeTeamId = this.readString(record['homeTeamId']);

      const awayTeamId = this.readString(record['awayTeamId']);

      const eventId = this.readString(record['eventId']);

      const fixtureDate = this.readDate(record['fixtureDate']);

      if (
        !eventId ||
        !homeTeamId ||
        !awayTeamId ||
        homeTeamId === awayTeamId ||
        !fixtureDate
      ) {
        continue;
      }

      if (!this.isCompletedFixture(record)) {
        continue;
      }

      const homeGoals = this.extractScore(record, true);

      const awayGoals = this.extractScore(record, false);

      if (homeGoals === null || awayGoals === null) {
        continue;
      }

      results.push({
        eventId,

        fixtureDate,

        homeTeamId,

        awayTeamId,

        homeGoals,

        awayGoals,

        totalGoals: homeGoals + awayGoals,

        completed: true,
      });
    }

    return results;
  }

  private isCompletedFixture(fixture: Record<string, unknown>): boolean {
    if (fixture['completed'] === true) {
      return true;
    }

    const status = this.readString(fixture['status']).toLowerCase();

    return RawPredictionFeatureService.COMPLETED_STATUSES.includes(status);
  }

  private isValidHistoricalMatch(match: RawHistoricalMatchFeatures): boolean {
    if (!match) {
      return false;
    }

    if (
      !this.readString(match.eventId) ||
      !this.readString(match.homeTeamId) ||
      !this.readString(match.awayTeamId)
    ) {
      return false;
    }

    if (match.homeTeamId === match.awayTeamId) {
      return false;
    }

    if (!Number.isFinite(match.fixtureDate?.getTime())) {
      return false;
    }

    if (
      !Number.isFinite(match.homeGoals) ||
      !Number.isFinite(match.awayGoals) ||
      match.homeGoals < 0 ||
      match.awayGoals < 0
    ) {
      return false;
    }

    return match.completed === true;
  }

  private extractScore(
    fixture: Record<string, unknown>,
    home: boolean,
  ): number | null {
    const direct = home ? fixture['homeScore'] : fixture['awayScore'];

    const directScore = this.readScoreValue(direct);

    if (directScore !== null) {
      return directScore;
    }

    const nested = home
      ? (this.readNestedScore(fixture['home']) ??
        this.readNestedScore(fixture['scores'], 'home'))
      : (this.readNestedScore(fixture['away']) ??
        this.readNestedScore(fixture['scores'], 'away'));

    const nestedScore = this.readScoreValue(nested);

    if (nestedScore !== null) {
      return nestedScore;
    }

    const teamScore = home
      ? this.readNestedScore(fixture['homeTeam'])
      : this.readNestedScore(fixture['awayTeam']);

    return this.readScoreValue(teamScore);
  }

  private readNestedScore(value: unknown, key = 'score'): unknown {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    return (value as Record<string, unknown>)[key];
  }

  private readScoreValue(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(Math.round(value), 0);
    }

    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value.trim());

      if (Number.isFinite(parsed)) {
        return Math.max(Math.round(parsed), 0);
      }
    }

    return null;
  }

  private calculateDataCompleteness(
    home: RawTeamFeatures,
    away: RawTeamFeatures,
    standings: RawStandingFeatures,
    h2h: RawHeadToHeadFeatures | null,
  ): number {
    const dimensions = [
      Number(home.sampleSize > 0),

      Number(away.sampleSize > 0),

      Number(home.recent.sampleSize > 0),

      Number(away.recent.sampleSize > 0),

      Number(home.venue.sampleSize > 0),

      Number(away.venue.sampleSize > 0),

      Number(home.dataAvailability.competitionStats),

      Number(away.dataAvailability.competitionStats),

      Number(home.dataAvailability.performanceProfile),

      Number(away.dataAvailability.performanceProfile),

      Number(standings.home !== null),

      Number(standings.away !== null),

      Number(h2h?.available === true),

      Number(home.dataAvailability.opponentAdjustedData),

      Number(away.dataAvailability.opponentAdjustedData),
    ];

    const total = dimensions.reduce((sum, value) => sum + value, 0);

    return this.clamp(this.safeDivide(total, dimensions.length) * 100, 0, 100);
  }

  private calculateHistoricalDataQuality(
    homeHistorical: RawHistoricalMatchFeatures[],
    awayHistorical: RawHistoricalMatchFeatures[],
    home: RawTeamFeatures,
    away: RawTeamFeatures,
    fixtureDate: Date,
  ): number {
    const homeReliability = this.sampleReliability(homeHistorical.length);

    const awayReliability = this.sampleReliability(awayHistorical.length);

    /*
     * One team's large sample cannot compensate for the other
     * team's weak sample.
     */
    const balancedSampleQuality = Math.min(homeReliability, awayReliability);

    const homeRecencyQuality = this.calculateHistoricalRecencyQuality(
      homeHistorical,
      fixtureDate,
    );

    const awayRecencyQuality = this.calculateHistoricalRecencyQuality(
      awayHistorical,
      fixtureDate,
    );

    const balancedRecencyQuality =
      (homeRecencyQuality + awayRecencyQuality) / 2;

    const opponentAdjustedCoverage =
      (this.calculateOpponentEvidenceQuality(
        home.opponentAdjusted.sampleSize,
        home.opponentAdjusted.effectiveSampleSize,
      ) +
        this.calculateOpponentEvidenceQuality(
          away.opponentAdjusted.sampleSize,
          away.opponentAdjusted.effectiveSampleSize,
        )) /
      2;

    const historicalAvailability =
      (Number(home.dataAvailability.historicalMatches) +
        Number(away.dataAvailability.historicalMatches)) /
      2;

    return this.clamp(
      (balancedSampleQuality * 0.35 +
        historicalAvailability * 0.15 +
        balancedRecencyQuality * 0.25 +
        opponentAdjustedCoverage * 0.25) *
        100,
      0,
      100,
    );
  }

  private calculateHistoricalRecencyQuality(
    matches: RawHistoricalMatchFeatures[],
    fixtureDate: Date,
  ): number {
    if (!matches.length) {
      return 0;
    }

    let totalWeight = 0;

    for (const match of matches) {
      const weight = this.calculateRecencyWeight(
        match.fixtureDate,
        fixtureDate,
      );

      if (Number.isFinite(weight) && weight > 0) {
        totalWeight += weight;
      }
    }

    return this.clamp(this.sampleReliability(totalWeight), 0, 1);
  }

  private calculateSportsSourceQuality(
    home: RawTeamFeatures,
    away: RawTeamFeatures,
  ): number {
    const checks = [
      home.dataAvailability.competitionStats,

      away.dataAvailability.competitionStats,

      home.dataAvailability.performanceProfile,

      away.dataAvailability.performanceProfile,
    ];

    const available = checks.filter(Boolean).length;

    return this.clamp(this.safeDivide(available, checks.length) * 100, 0, 100);
  }

  private emptyOpponentAdjusted(): RawTeamOpponentAdjustedFeatures {
    return {
      available: false,

      sampleSize: 0,

      effectiveSampleSize: 0,

      scheduleStrength: 50,

      strengthRating: 50,

      averageGoalsScored: 0,

      averageGoalsConceded: 0,

      pointsPerMatch: 0,

      winRate: 0,

      lossRate: 0,
    };
  }

  private emptyTeamFeatures(teamId: string, teamName: string): RawTeamFeatures {
    return {
      teamId,

      teamName,

      sampleSize: 0,

      wins: 0,

      draws: 0,

      losses: 0,

      points: 0,

      pointsPerMatch: 0,

      goalsScored: 0,

      goalsConceded: 0,

      averageGoalsScored: 0,

      averageGoalsConceded: 0,

      winRate: 0,

      drawRate: 0,

      lossRate: 0,

      bttsRate: 0,

      cleanSheetRate: 0,

      failedToScoreRate: 0,

      over05Rate: 0,

      over15Rate: 0,

      over25Rate: 0,

      over35Rate: 0,

      over45Rate: 0,

      over55Rate: 0,

      firstHalf: {
        sampleSize: 0,

        goalsScored: 0,

        goalsConceded: 0,

        averageGoalsScored: 0,

        averageGoalsConceded: 0,
      },

      secondHalf: {
        sampleSize: 0,

        goalsScored: 0,

        goalsConceded: 0,

        averageGoalsScored: 0,

        averageGoalsConceded: 0,
      },

      scoredFirstRate: 0,

      recent: {
        sampleSize: 0,

        wins: 0,

        draws: 0,

        losses: 0,

        points: 0,

        pointsPerMatch: 0,

        goalsScored: 0,

        goalsConceded: 0,

        averageGoalsScored: 0,

        averageGoalsConceded: 0,

        winRate: 0,

        drawRate: 0,

        lossRate: 0,

        bttsRate: 0,

        cleanSheetRate: 0,

        failedToScoreRate: 0,

        over05Rate: 0,

        over15Rate: 0,

        over25Rate: 0,

        over35Rate: 0,

        over45Rate: 0,

        over55Rate: 0,
      },

      venue: {
        sampleSize: 0,

        wins: 0,

        draws: 0,

        losses: 0,

        points: 0,

        pointsPerMatch: 0,

        goalsScored: 0,

        goalsConceded: 0,

        averageGoalsScored: 0,

        averageGoalsConceded: 0,

        winRate: 0,

        drawRate: 0,

        lossRate: 0,

        bttsRate: 0,

        cleanSheetRate: 0,

        failedToScoreRate: 0,

        over05Rate: 0,

        over15Rate: 0,

        over25Rate: 0,

        over35Rate: 0,

        over45Rate: 0,

        over55Rate: 0,
      },

      opponentAdjusted: this.emptyOpponentAdjusted(),

      sourceData: {
        competitionStats: {},

        performanceProfile: {},
      },

      historical: [],

      dataAvailability: {
        historicalMatches: false,

        recentForm: false,

        venueMatches: false,

        halfTimeData: false,

        scoredFirstData: false,

        competitionStats: false,

        performanceProfile: false,

        opponentAdjustedData: false,
      },
    };
  }

  private toPlainRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object') {
      return {};
    }

    const candidate = value as {
      toObject?: () => unknown;
    };

    if (typeof candidate.toObject === 'function') {
      const result = candidate.toObject();

      return result && typeof result === 'object'
        ? {
            ...(result as Record<string, unknown>),
          }
        : {};
    }

    return {
      ...(value as Record<string, unknown>),
    };
  }

  private readDate(value: unknown): Date | null {
    if (value instanceof Date) {
      return Number.isFinite(value.getTime())
        ? new Date(value.getTime())
        : null;
    }

    if (typeof value !== 'string' && typeof value !== 'number') {
      return null;
    }

    const date = new Date(value);

    return Number.isFinite(date.getTime()) ? date : null;
  }

  private safeDivide(numerator: number, denominator: number): number {
    if (
      !Number.isFinite(numerator) ||
      !Number.isFinite(denominator) ||
      denominator <= 0
    ) {
      return 0;
    }

    return numerator / denominator;
  }

  private toNumber(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim() !== '') {
      const number = Number(value.trim());

      return Number.isFinite(number) ? number : 0;
    }

    return 0;
  }

  private readString(value: unknown): string {
    if (typeof value !== 'string' && typeof value !== 'number') {
      return '';
    }

    return String(value).trim();
  }

  private readRate(value: unknown): number {
    const number = this.toNumber(value);

    if (!Number.isFinite(number) || number < 0) {
      return 0;
    }

    return number > 1
      ? this.clamp(number / 100, 0, 1)
      : this.clamp(number, 0, 1);
  }

  private sampleReliability(sampleSize: number): number {
    if (!Number.isFinite(sampleSize) || sampleSize <= 0) {
      return 0;
    }

    return this.clamp(1 - Math.exp(-sampleSize / 25), 0, 1);
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
