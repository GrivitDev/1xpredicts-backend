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

@Injectable()
export class RawPredictionFeatureService {
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

    const overallDataQuality = this.clamp(
      dataCompleteness * 0.4 + historicalDataQuality * 0.6,
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
    teamStats: any,
    performanceProfile: any,
  ): RawTeamFeatures {
    const sorted = [...historical].sort(
      (a, b) => b.fixtureDate.getTime() - a.fixtureDate.getTime(),
    );

    const recent = sorted.slice(0, 5);

    const overall = this.calculateAggregate(sorted, teamId);

    const recentFeatures = this.calculateRecent(recent, teamId);

    const venueFixtures = sorted.filter((match) =>
      isHomeTeam ? match.homeTeamId === teamId : match.awayTeamId === teamId,
    );

    const venue = this.calculateVenue(venueFixtures, teamId);

    /*
     * Half-time and first-score data are left unavailable
     * until the historical ESPN data actually provides those
     * fields. No values are fabricated here.
     */
    const firstHalf = this.calculateHalf();

    const secondHalf = this.calculateHalf();

    const scoredFirstRate = this.calculateScoredFirstRate();

    const completedSample = sorted.length;

    const fallbackStats = this.getHistoricalFallbackStats(
      teamStats,
      performanceProfile,
    );

    const mergedOverall = this.mergeHistoricalStats(
      overall,
      fallbackStats,
      completedSample,
    );

    return {
      teamId,

      teamName,

      sampleSize: mergedOverall.sampleSize,

      wins: mergedOverall.wins,

      draws: mergedOverall.draws,

      losses: mergedOverall.losses,

      points: mergedOverall.points,

      pointsPerMatch: mergedOverall.pointsPerMatch,

      goalsScored: mergedOverall.goalsScored,

      goalsConceded: mergedOverall.goalsConceded,

      averageGoalsScored: mergedOverall.averageGoalsScored,

      averageGoalsConceded: mergedOverall.averageGoalsConceded,

      winRate: mergedOverall.winRate,

      drawRate: mergedOverall.drawRate,

      lossRate: mergedOverall.lossRate,

      bttsRate: mergedOverall.bttsRate,

      cleanSheetRate: mergedOverall.cleanSheetRate,

      failedToScoreRate: mergedOverall.failedToScoreRate,

      over05Rate: mergedOverall.over05Rate,

      over15Rate: mergedOverall.over15Rate,

      over25Rate: mergedOverall.over25Rate,

      over35Rate: mergedOverall.over35Rate,

      over45Rate: mergedOverall.over45Rate,

      over55Rate: mergedOverall.over55Rate,

      firstHalf,

      secondHalf,

      scoredFirstRate,

      recent: recentFeatures,

      venue,

      historical: sorted,

      dataAvailability: {
        historicalMatches: sorted.length > 0,

        recentForm: recent.length > 0,

        venueMatches: venue.sampleSize > 0,

        halfTimeData: firstHalf.sampleSize > 0 || secondHalf.sampleSize > 0,

        scoredFirstData: scoredFirstRate > 0,
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
    homeStanding: any,
    awayTeamId: string,
    awayStanding: any,
  ): RawStandingFeatures {
    return {
      home: this.toStandingFeatures(homeTeamId, homeStanding),

      away: this.toStandingFeatures(awayTeamId, awayStanding),
    };
  }

  private toStandingFeatures(
    teamId: string,
    standing: any,
  ): RawStandingTeamFeatures | null {
    if (!standing) {
      return null;
    }

    const standingRecord = standing as Record<string, unknown>;

    return {
      teamId,

      rank: this.toNumber(standingRecord['rank']),

      points: this.toNumber(standingRecord['points']),

      played: this.toNumber(standingRecord['played']),

      wins: this.toNumber(standingRecord['wins']),

      draws: this.toNumber(standingRecord['draws']),

      losses: this.toNumber(standingRecord['losses']),

      goalsFor: this.toNumber(
        standingRecord['goalsFor'] ?? standingRecord['gf'],
      ),

      goalsAgainst: this.toNumber(
        standingRecord['goalsAgainst'] ?? standingRecord['ga'],
      ),

      goalDifference: this.toNumber(
        standingRecord['goalDifference'] ?? standingRecord['gd'],
      ),

      form:
        typeof standingRecord['form'] === 'string'
          ? String(standingRecord['form'])
          : null,
    };
  }

  private buildHeadToHead(
    headToHead: any,
    homeTeamId: string,
  ): RawHeadToHeadFeatures | null {
    if (!headToHead) {
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

      dataReliability: this.clamp(
        this.toNumber(record['dataReliability']),
        0,
        1,
      ),
    };
  }

  private toHistoricalMatches(
    fixtures: readonly unknown[],
  ): RawHistoricalMatchFeatures[] {
    return fixtures
      .filter((fixture: unknown): fixture is Record<string, unknown> => {
        if (typeof fixture !== 'object' || fixture === null) {
          return false;
        }

        const candidate = fixture as Record<string, unknown>;

        return (
          candidate['completed'] === true &&
          Boolean(candidate['fixtureDate']) &&
          Boolean(candidate['homeTeamId']) &&
          Boolean(candidate['awayTeamId'])
        );
      })
      .map((fixture) => {
        const homeGoals = this.extractScore(fixture, true);

        const awayGoals = this.extractScore(fixture, false);

        /*
         * Missing scores are NOT converted to 0.
         *
         * A historical fixture is only usable for
         * prediction statistics when both scores are
         * genuinely available.
         */
        if (homeGoals === null || awayGoals === null) {
          return null;
        }

        const fixtureDate = new Date(String(fixture.fixtureDate));

        if (!Number.isFinite(fixtureDate.getTime())) {
          return null;
        }

        return {
          eventId: String(fixture.eventId),

          fixtureDate,

          homeTeamId: String(fixture.homeTeamId),

          awayTeamId: String(fixture.awayTeamId),

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

  private extractScore(fixture: unknown, home: boolean): number | null {
    const fixtureRecord = fixture as Record<string, unknown>;
    const direct = home ? fixtureRecord.homeScore : fixtureRecord.awayScore;

    const directScore = this.readScoreValue(direct);

    if (directScore !== null) {
      return directScore;
    }

    const nested = home
      ? (this.readNestedScore(fixtureRecord.home) ??
        this.readNestedScore(fixtureRecord.scores, 'home'))
      : (this.readNestedScore(fixtureRecord.away) ??
        this.readNestedScore(fixtureRecord.scores, 'away'));

    const nestedScore = this.readScoreValue(nested);

    if (nestedScore !== null) {
      return nestedScore;
    }

    const teamScore = home
      ? this.readNestedScore(fixtureRecord.homeTeam)
      : this.readNestedScore(fixtureRecord.awayTeam);

    const teamScoreValue = this.readScoreValue(teamScore);

    if (teamScoreValue !== null) {
      return teamScoreValue;
    }

    return null;
  }

  private readNestedScore(value: unknown, key = 'score'): unknown {
    if (typeof value !== 'object' || value === null) {
      return undefined;
    }

    return (value as Record<string, unknown>)[key];
  }

  private readScoreValue(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(Math.round(value), 0);
    }

    if (typeof value === 'string') {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return Math.max(Math.round(parsed), 0);
      }
    }

    return null;
  }

  private getHistoricalFallbackStats(
    teamStats: unknown,
    performanceProfile: unknown,
  ): Partial<RawTeamFeatures> {
    type HistoricalFallbackSource = Record<string, unknown> & {
      overall?: Record<string, unknown>;
    };

    const sources = [teamStats, performanceProfile].filter(
      (source): source is HistoricalFallbackSource =>
        typeof source === 'object' && source !== null,
    );

    if (!sources.length) {
      return {};
    }

    /*
     * TeamCompetitionStats takes precedence for fields that
     * exist there. PerformanceProfile fills fields that the
     * first source does not provide.
     */
    const source = sources[0] ?? {};

    const secondary = sources[1] ?? {};

    return {
      sampleSize: this.firstNumber(
        source.sampleSize,
        source.matchesPlayed,
        secondary.sampleSize,
        secondary.matchesPlayed,
      ),

      wins: this.firstNumber(
        source.wins,
        source.overall?.wins,
        secondary.wins,
        secondary.overall?.wins,
      ),

      draws: this.firstNumber(
        source.draws,
        source.overall?.draws,
        secondary.draws,
        secondary.overall?.draws,
      ),

      losses: this.firstNumber(
        source.losses,
        source.overall?.losses,
        secondary.losses,
        secondary.overall?.losses,
      ),

      goalsScored: this.firstNumber(
        source.goalsScored,
        source.overall?.goalsScored,
        secondary.goalsScored,
        secondary.overall?.goalsScored,
      ),

      goalsConceded: this.firstNumber(
        source.goalsConceded,
        source.overall?.goalsConceded,
        secondary.goalsConceded,
        secondary.overall?.goalsConceded,
      ),

      averageGoalsScored: this.firstNumber(
        source.averageGoalsScored,
        source.overall?.averageGoalsScored,
        secondary.averageGoalsScored,
        secondary.overall?.averageGoalsScored,
      ),

      averageGoalsConceded: this.firstNumber(
        source.averageGoalsConceded,
        source.overall?.averageGoalsConceded,
        secondary.averageGoalsConceded,
        secondary.overall?.averageGoalsConceded,
      ),

      winRate: this.firstRate(
        source.winRate,
        source.overall?.winRate,
        secondary.winRate,
        secondary.overall?.winRate,
      ),

      drawRate: this.firstRate(
        source.drawRate,
        source.overall?.drawRate,
        secondary.drawRate,
        secondary.overall?.drawRate,
      ),

      lossRate: this.firstRate(
        source.lossRate,
        source.overall?.lossRate,
        secondary.lossRate,
        secondary.overall?.lossRate,
      ),

      bttsRate: this.firstRate(
        source.bttsRate,
        source.overall?.bttsRate,
        secondary.bttsRate,
        secondary.overall?.bttsRate,
      ),

      cleanSheetRate: this.firstRate(
        source.cleanSheetRate,
        source.overall?.cleanSheetRate,
        secondary.cleanSheetRate,
        secondary.overall?.cleanSheetRate,
      ),

      failedToScoreRate: this.firstRate(
        source.failedToScoreRate,
        source.overall?.failedToScoreRate,
        secondary.failedToScoreRate,
        secondary.overall?.failedToScoreRate,
      ),

      over05Rate: this.firstRate(
        source.over05Rate,
        source.overall?.over05Rate,
        secondary.over05Rate,
        secondary.overall?.over05Rate,
      ),

      over15Rate: this.firstRate(
        source.over15Rate,
        source.overall?.over15Rate,
        secondary.over15Rate,
        secondary.overall?.over15Rate,
      ),

      over25Rate: this.firstRate(
        source.over25Rate,
        source.overall?.over25Rate,
        secondary.over25Rate,
        secondary.overall?.over25Rate,
      ),

      over35Rate: this.firstRate(
        source.over35Rate,
        source.overall?.over35Rate,
        secondary.over35Rate,
        secondary.overall?.over35Rate,
      ),

      over45Rate: this.firstRate(
        source.over45Rate,
        source.overall?.over45Rate,
        secondary.over45Rate,
        secondary.over45Rate,
        secondary.over45Rate,
      ),

      over55Rate: this.firstRate(
        source.over55Rate,
        source.overall?.over55Rate,
        secondary.over55Rate,
        secondary.overall?.over55Rate,
      ),
    };
  }

  private mergeHistoricalStats(
    calculated: RawTeamFeatures,
    fallback: Partial<RawTeamFeatures>,
    completedSample: number,
  ): RawTeamFeatures {
    if (completedSample >= 5) {
      return calculated;
    }

    const useCalculated = completedSample > 0;

    return {
      ...calculated,

      sampleSize: useCalculated
        ? calculated.sampleSize
        : this.toNumber(fallback.sampleSize),

      wins: useCalculated ? calculated.wins : this.toNumber(fallback.wins),

      draws: useCalculated ? calculated.draws : this.toNumber(fallback.draws),

      losses: useCalculated
        ? calculated.losses
        : this.toNumber(fallback.losses),

      goalsScored: useCalculated
        ? calculated.goalsScored
        : this.toNumber(fallback.goalsScored),

      goalsConceded: useCalculated
        ? calculated.goalsConceded
        : this.toNumber(fallback.goalsConceded),

      averageGoalsScored: useCalculated
        ? calculated.averageGoalsScored
        : this.toNumber(fallback.averageGoalsScored),

      averageGoalsConceded: useCalculated
        ? calculated.averageGoalsConceded
        : this.toNumber(fallback.averageGoalsConceded),

      winRate: useCalculated
        ? calculated.winRate
        : this.readRate(fallback.winRate),

      drawRate: useCalculated
        ? calculated.drawRate
        : this.readRate(fallback.drawRate),

      lossRate: useCalculated
        ? calculated.lossRate
        : this.readRate(fallback.lossRate),

      bttsRate: useCalculated
        ? calculated.bttsRate
        : this.readRate(fallback.bttsRate),

      cleanSheetRate: useCalculated
        ? calculated.cleanSheetRate
        : this.readRate(fallback.cleanSheetRate),

      failedToScoreRate: useCalculated
        ? calculated.failedToScoreRate
        : this.readRate(fallback.failedToScoreRate),

      over05Rate: useCalculated
        ? calculated.over05Rate
        : this.readRate(fallback.over05Rate),

      over15Rate: useCalculated
        ? calculated.over15Rate
        : this.readRate(fallback.over15Rate),

      over25Rate: useCalculated
        ? calculated.over25Rate
        : this.readRate(fallback.over25Rate),

      over35Rate: useCalculated
        ? calculated.over35Rate
        : this.readRate(fallback.over35Rate),

      over45Rate: useCalculated
        ? calculated.over45Rate
        : this.readRate(fallback.over45Rate),

      over55Rate: useCalculated
        ? calculated.over55Rate
        : this.readRate(fallback.over55Rate),

      points: useCalculated
        ? calculated.points
        : this.toNumber(fallback.points),

      pointsPerMatch: useCalculated
        ? calculated.pointsPerMatch
        : this.toNumber(fallback.pointsPerMatch),
    };
  }

  private calculateDataCompleteness(
    home: RawTeamFeatures,
    away: RawTeamFeatures,
    standings: RawStandingFeatures,
    h2h: RawHeadToHeadFeatures | null,
  ): number {
    /*
     * Core evidence carries the majority of the completeness
     * score. H2H is supplementary and should not damage the
     * overall score simply because no historical meeting exists.
     */
    const coreChecks = [
      home.sampleSize > 0,
      away.sampleSize > 0,

      home.recent.sampleSize > 0,
      away.recent.sampleSize > 0,

      home.venue.sampleSize > 0,
      away.venue.sampleSize > 0,

      standings.home !== null,
      standings.away !== null,
    ];

    const coreAvailable = coreChecks.filter(Boolean).length;

    const coreCompleteness = (coreAvailable / coreChecks.length) * 100;

    const h2hSupplement = h2h?.available === true ? 5 : 0;

    return this.clamp(coreCompleteness * 0.95 + h2hSupplement, 0, 100);
  }

  private calculateHistoricalDataQuality(
    homeHistoricalSample: number,
    awayHistoricalSample: number,
    home: RawTeamFeatures,
    away: RawTeamFeatures,
  ): number {
    const homeSample = Math.min(Math.max(homeHistoricalSample, 0) / 30, 1);

    const awaySample = Math.min(Math.max(awayHistoricalSample, 0) / 30, 1);

    const homeAvailability = home.dataAvailability.historicalMatches ? 1 : 0;

    const awayAvailability = away.dataAvailability.historicalMatches ? 1 : 0;

    const balancedSample = Math.min(homeSample, awaySample);

    const availability = (homeAvailability + awayAvailability) / 2;

    /*
     * Balanced samples are more important than having one
     * team with a large history and the other with almost none.
     */
    return this.clamp(balancedSample * 0.7 + availability * 0.3, 0, 1) * 100;
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

      historical: [],

      dataAvailability: {
        historicalMatches: false,
        recentForm: false,
        venueMatches: false,
        halfTimeData: false,
        scoredFirstData: false,
      },
    };
  }

  private firstNumber(...values: unknown[]): number {
    for (const value of values) {
      const number = Number(value);

      if (Number.isFinite(number)) {
        return number;
      }
    }

    return 0;
  }

  private firstRate(...values: unknown[]): number {
    for (const value of values) {
      if (value === null || value === undefined) {
        continue;
      }

      const number = Number(value);

      if (!Number.isFinite(number) || number < 0) {
        continue;
      }

      return number > 1
        ? this.clamp(number / 100, 0, 1)
        : this.clamp(number, 0, 1);
    }

    return 0;
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

  private clamp(value: number, minimum: number, maximum: number): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
