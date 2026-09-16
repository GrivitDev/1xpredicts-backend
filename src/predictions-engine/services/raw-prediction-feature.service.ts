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
  RawTeamRecentFeatures,
  RawTeamVenueFeatures,
} from '../interfaces/raw-team-features.interface';

import { TeamComparisonService } from './team-comparison.service';

@Injectable()
export class RawPredictionFeatureService {
  constructor(private readonly teamComparisonService: TeamComparisonService) {}

  build(input: RawPredictionMatchInput): RawPredictionFeatures {
    const fixture = input.fixture;

    const homeTeamId = String(fixture.homeTeamId).trim();

    const awayTeamId = String(fixture.awayTeamId).trim();

    const homeHistorical = this.toHistoricalMatches(
      input.homeHistoricalFixtures,
    );

    const awayHistorical = this.toHistoricalMatches(
      input.awayHistoricalFixtures,
    );

    const home = this.buildTeamFeatures(
      homeTeamId,
      input.homeTeam?.name ?? homeTeamId,
      homeHistorical,
      true,
      input.homeTeamCompetitionStats,
      input.homeTeamPerformanceProfile,
    );

    const away = this.buildTeamFeatures(
      awayTeamId,
      input.awayTeam?.name ?? awayTeamId,
      awayHistorical,
      false,
      input.awayTeamCompetitionStats,
      input.awayTeamPerformanceProfile,
    );

    const standings = this.buildStandings(
      homeTeamId,
      input.homeStanding,
      awayTeamId,
      input.awayStanding,
    );

    const h2h = this.buildHeadToHead(input.headToHead, homeTeamId);

    /*
     * ----------------------------------------------------------
     * CENTRAL TEAM COMPARISON
     * ----------------------------------------------------------
     *
     * This is built once from the complete assembled sports data
     * and becomes the shared comparison layer for probability,
     * safety, confidence, ensemble and coherence.
     */
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
      homeHistorical.length,
      awayHistorical.length,
      home,
      away,
    );

    const sportsSourceQuality = this.calculateSportsSourceQuality(home, away);

    const overallDataQuality = this.clamp(
      dataCompleteness * 0.3 +
        historicalDataQuality * 0.5 +
        sportsSourceQuality * 0.2,
      0,
      100,
    );

    return {
      eventId: String(fixture.eventId),

      competitionId: String(fixture.leagueId).trim().toLowerCase(),

      season: Number(fixture.season),

      fixtureDate: new Date(fixture.fixtureDate),

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
  ): RawTeamFeatures {
    const sorted = [...historical].sort(
      (a, b) => b.fixtureDate.getTime() - a.fixtureDate.getTime(),
    );

    /*
     * Recent form is derived from the complete historical body.
     * It never replaces historical.
     */
    const recent = sorted.slice(0, 5);

    /*
     * Venue data is derived from the complete historical body.
     * Only fixtures played in the relevant venue orientation are
     * selected for this derived view.
     */
    const venueFixtures = sorted.filter((match) =>
      isHomeTeam ? match.homeTeamId === teamId : match.awayTeamId === teamId,
    );

    const overall = this.calculateAggregate(sorted, teamId);

    const recentFeatures = this.calculateRecent(recent, teamId);

    const venue = this.calculateVenue(venueFixtures, teamId);

    /*
     * ESPN historical fixture objects currently do not expose the
     * required half-time fields through this feature contract.
     *
     * Therefore no artificial half-time observations are generated.
     */
    const firstHalf = this.calculateHalf();

    const secondHalf = this.calculateHalf();

    const scoredFirstRate = this.calculateScoredFirstRate();

    const competitionStats = this.toPlainRecord(teamStats);

    const performanceProfile = this.toPlainRecord(performanceProfileData);

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

      sourceData: {
        competitionStats,
        performanceProfile,
      },

      /*
       * Complete usable historical dataset.
       */
      historical: sorted,

      dataAvailability: {
        historicalMatches: sorted.length > 0,

        recentForm: recent.length > 0,

        venueMatches: venue.sampleSize > 0,

        halfTimeData: firstHalf.sampleSize > 0 || secondHalf.sampleSize > 0,

        scoredFirstData: scoredFirstRate > 0,

        competitionStats: Object.keys(competitionStats).length > 0,

        performanceProfile: Object.keys(performanceProfile).length > 0,
      },
    };
  }

  private calculateAggregate(
    matches: RawHistoricalMatchFeatures[],
    teamId: string,
  ): RawTeamFeatures {
    const sampleSize = matches.length;

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

    for (const match of matches) {
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

  private calculateHalf(): RawTeamHalfFeatures {
    return {
      sampleSize: 0,

      goalsScored: 0,

      goalsConceded: 0,

      averageGoalsScored: 0,

      averageGoalsConceded: 0,
    };
  }

  private calculateScoredFirstRate(): number {
    return 0;
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

    const teamAValue = record['teamAId'] ?? record['homeTeamId'];

    const teamA =
      typeof teamAValue === 'string' || typeof teamAValue === 'number'
        ? String(teamAValue).trim()
        : '';

    const homeIsTeamA = teamA === homeTeamId;

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

    return {
      available: sampleSize > 0,

      sampleSize,

      homeWins,

      draws,

      awayWins,

      averageGoalsForHome: this.toNumber(
        homeIsTeamA
          ? (record['averageGoalsTeamA'] ?? record['averageGoalsHome'])
          : (record['averageGoalsTeamB'] ?? record['averageGoalsAway']),
      ),

      averageGoalsForAway: this.toNumber(
        homeIsTeamA
          ? (record['averageGoalsTeamB'] ?? record['averageGoalsAway'])
          : (record['averageGoalsTeamA'] ?? record['averageGoalsHome']),
      ),

      averageGoalsForTeam: this.toNumber(
        homeIsTeamA
          ? (record['averageGoalsTeamA'] ?? record['averageGoalsHome'])
          : (record['averageGoalsTeamB'] ?? record['averageGoalsAway']),
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

      dataReliability: this.readRate(record['dataReliability']),
    };
  }

  private toHistoricalMatches(
    fixtures: readonly unknown[],
  ): RawHistoricalMatchFeatures[] {
    /*
     * No age filter exists here.
     *
     * Every usable completed historical fixture supplied by the
     * data service is retained regardless of age.
     */
    return fixtures
      .filter(
        (fixture): fixture is Record<string, unknown> =>
          typeof fixture === 'object' &&
          fixture !== null &&
          (fixture as Record<string, unknown>)['completed'] === true &&
          Boolean((fixture as Record<string, unknown>)['fixtureDate']) &&
          Boolean((fixture as Record<string, unknown>)['homeTeamId']) &&
          Boolean((fixture as Record<string, unknown>)['awayTeamId']),
      )
      .map((fixture) => {
        const homeGoals = this.extractScore(fixture, true);

        const awayGoals = this.extractScore(fixture, false);

        if (homeGoals === null || awayGoals === null) {
          return null;
        }

        const fixtureDate = new Date(String(fixture['fixtureDate']));

        if (!Number.isFinite(fixtureDate.getTime())) {
          return null;
        }

        return {
          eventId: String(fixture['eventId']),

          fixtureDate,

          homeTeamId: String(fixture['homeTeamId']),

          awayTeamId: String(fixture['awayTeamId']),

          homeGoals,

          awayGoals,

          totalGoals: homeGoals + awayGoals,

          completed: true,
        };
      })
      .filter(
        (fixture): fixture is RawHistoricalMatchFeatures => fixture !== null,
      );
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
      const parsed = Number(value);

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
    const checks = [
      home.sampleSize > 0,
      away.sampleSize > 0,

      home.recent.sampleSize > 0,
      away.recent.sampleSize > 0,

      home.venue.sampleSize > 0,
      away.venue.sampleSize > 0,

      home.dataAvailability.competitionStats,

      away.dataAvailability.competitionStats,

      home.dataAvailability.performanceProfile,

      away.dataAvailability.performanceProfile,

      standings.home !== null,
      standings.away !== null,

      h2h?.available === true,
    ];

    const available = checks.filter(Boolean).length;

    return this.clamp((available / checks.length) * 100, 0, 100);
  }

  private calculateHistoricalDataQuality(
    homeHistoricalSample: number,
    awayHistoricalSample: number,
    home: RawTeamFeatures,
    away: RawTeamFeatures,
  ): number {
    /*
     * No historical age cutoff.
     *
     * Historical length is used only to measure available evidence,
     * never to remove or discard older fixtures.
     */
    const homeReliability = this.sampleReliability(homeHistoricalSample);

    const awayReliability = this.sampleReliability(awayHistoricalSample);

    const balanced = Math.min(homeReliability, awayReliability);

    const availability =
      (Number(home.dataAvailability.historicalMatches) +
        Number(away.dataAvailability.historicalMatches)) /
      2;

    return this.clamp((balanced * 0.8 + availability * 0.2) * 100, 0, 100);
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

    return this.clamp(
      (checks.filter(Boolean).length / checks.length) * 100,
      0,
      100,
    );
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
    const number = Number(value);

    return Number.isFinite(number) ? number : 0;
  }

  private readRate(value: unknown): number {
    const number = Number(value);

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
