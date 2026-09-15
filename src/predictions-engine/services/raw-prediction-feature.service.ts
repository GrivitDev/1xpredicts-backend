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
  async build(input: RawPredictionMatchInput): Promise<RawPredictionFeatures> {
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
    /*
     * Prediction calculations are based on historical
     * fixtures. Stored sports statistics are used only
     * where they represent historical descriptive data.
     *
     * They are not treated as prediction probabilities.
     */
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

    const firstHalf = this.calculateHalf(sorted, teamId, true);

    const secondHalf = this.calculateHalf(sorted, teamId, false);

    const scoredFirstRate = this.calculateScoredFirstRate(sorted, teamId);

    /*
     * Stored descriptive statistics can fill genuine
     * historical data gaps, but never overwrite a
     * sufficiently populated fixture-derived sample.
     */
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

      const total = match.totalGoals;

      if (total > 0) over05++;
      if (total > 1) over15++;
      if (total > 2) over25++;
      if (total > 3) over35++;
      if (total > 4) over45++;
      if (total > 5) over55++;
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

  private calculateHalf(
    matches: RawHistoricalMatchFeatures[],
    teamId: string,
    firstHalf: boolean,
  ): RawTeamHalfFeatures {
    /*
     * The fixture schema currently does not expose
     * guaranteed half-time scores in the historical
     * feature contract used here.
     *
     * Therefore this layer does not invent half-time
     * information. The probability model can use the
     * resulting full-match fallback when timing data
     * is unavailable.
     */
    return {
      sampleSize: 0,

      goalsScored: 0,
      goalsConceded: 0,

      averageGoalsScored: 0,
      averageGoalsConceded: 0,
    };
  }

  private calculateScoredFirstRate(
    matches: RawHistoricalMatchFeatures[],
    teamId: string,
  ): number {
    /*
     * No scoring-event sequence is available in the
     * current ESPN fixture dataset.
     *
     * Returning zero prevents fabricated first-score
     * information from entering the model.
     */
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

    return {
      teamId,

      rank: this.toNumber(standing.rank),

      points: this.toNumber(standing.points),

      played: this.toNumber(standing.played),

      wins: this.toNumber(standing.wins),

      draws: this.toNumber(standing.draws),

      losses: this.toNumber(standing.losses),

      goalsFor: this.toNumber(standing.goalsFor ?? standing.gf),

      goalsAgainst: this.toNumber(standing.goalsAgainst ?? standing.ga),

      goalDifference: this.toNumber(standing.goalDifference ?? standing.gd),

      form: typeof standing.form === 'string' ? standing.form : null,
    };
  }

  private buildHeadToHead(
    headToHead: any,
    homeTeamId: string,
  ): RawHeadToHeadFeatures | null {
    if (!headToHead) {
      return null;
    }

    const teamA = String(
      headToHead.teamAId ?? headToHead.homeTeamId ?? '',
    ).trim();

    const homeIsTeamA = teamA === homeTeamId;

    const homeWins = homeIsTeamA
      ? this.toNumber(headToHead.teamAWins ?? headToHead.homeWins)
      : this.toNumber(headToHead.teamBWins ?? headToHead.awayWins);

    const awayWins = homeIsTeamA
      ? this.toNumber(headToHead.teamBWins ?? headToHead.awayWins)
      : this.toNumber(headToHead.teamAWins ?? headToHead.homeWins);

    const draws = this.toNumber(headToHead.draws);

    const sampleSize = this.toNumber(
      headToHead.sampleSize ?? headToHead.totalMeetings,
    );

    return {
      available: sampleSize > 0,

      sampleSize,

      homeWins,
      draws,
      awayWins,

      averageGoalsForHome: this.toNumber(
        homeIsTeamA
          ? (headToHead.averageGoalsTeamA ?? headToHead.averageGoalsHome)
          : (headToHead.averageGoalsTeamB ?? headToHead.averageGoalsAway),
      ),

      averageGoalsForAway: this.toNumber(
        homeIsTeamA
          ? (headToHead.averageGoalsTeamB ?? headToHead.averageGoalsAway)
          : (headToHead.averageGoalsTeamA ?? headToHead.averageGoalsHome),
      ),

      averageGoalsForTeam: this.toNumber(
        homeIsTeamA
          ? (headToHead.averageGoalsTeamA ?? headToHead.averageGoalsHome)
          : (headToHead.averageGoalsTeamB ?? headToHead.averageGoalsAway),
      ),

      averageTotalGoals: this.toNumber(headToHead.averageTotalGoals),

      bttsRate: this.readRate(headToHead.bttsRate),

      cleanSheetHomeRate: this.readRate(
        homeIsTeamA
          ? (headToHead.cleanSheetTeamARate ?? headToHead.cleanSheetHomeRate)
          : (headToHead.cleanSheetTeamBRate ?? headToHead.cleanSheetAwayRate),
      ),

      cleanSheetAwayRate: this.readRate(
        homeIsTeamA
          ? (headToHead.cleanSheetTeamBRate ?? headToHead.cleanSheetAwayRate)
          : (headToHead.cleanSheetTeamARate ?? headToHead.cleanSheetHomeRate),
      ),

      failedToScoreHomeRate: this.readRate(
        homeIsTeamA
          ? headToHead.failedToScoreTeamARate
          : headToHead.failedToScoreTeamBRate,
      ),

      failedToScoreAwayRate: this.readRate(
        homeIsTeamA
          ? headToHead.failedToScoreTeamBRate
          : headToHead.failedToScoreTeamARate,
      ),

      over05Rate: this.readRate(headToHead.over05Rate),

      over15Rate: this.readRate(headToHead.over15Rate),

      over25Rate: this.readRate(headToHead.over25Rate),

      over35Rate: this.readRate(headToHead.over35Rate),

      over45Rate: this.readRate(headToHead.over45Rate),

      over55Rate: this.readRate(headToHead.over55Rate),

      homeScoredFirstRate: this.readRate(
        homeIsTeamA
          ? headToHead.teamAScoredFirstRate
          : headToHead.teamBScoredFirstRate,
      ),

      awayScoredFirstRate: this.readRate(
        homeIsTeamA
          ? headToHead.teamBScoredFirstRate
          : headToHead.teamAScoredFirstRate,
      ),

      dataReliability: this.clamp(
        this.toNumber(headToHead.dataReliability),
        0,
        1,
      ),
    };
  }

  private toHistoricalMatches(fixtures: any[]): RawHistoricalMatchFeatures[] {
    return fixtures
      .filter(
        (fixture) =>
          fixture?.completed === true &&
          fixture?.fixtureDate &&
          fixture?.homeTeamId &&
          fixture?.awayTeamId,
      )
      .map((fixture) => {
        const homeGoals = this.extractScore(fixture, true);

        const awayGoals = this.extractScore(fixture, false);

        return {
          eventId: String(fixture.eventId),

          fixtureDate: new Date(fixture.fixtureDate),

          homeTeamId: String(fixture.homeTeamId),

          awayTeamId: String(fixture.awayTeamId),

          homeGoals,
          awayGoals,

          totalGoals: homeGoals + awayGoals,

          completed: true,
        };
      })
      .filter((fixture) => Number.isFinite(fixture.fixtureDate.getTime()));
  }

  private extractScore(fixture: any, home: boolean): number {
    const direct = home ? fixture.homeScore : fixture.awayScore;

    if (typeof direct === 'number' && Number.isFinite(direct)) {
      return Math.max(Math.round(direct), 0);
    }

    const nested = home
      ? (fixture.home?.score ?? fixture.scores?.home)
      : (fixture.away?.score ?? fixture.scores?.away);

    if (typeof nested === 'number' && Number.isFinite(nested)) {
      return Math.max(Math.round(nested), 0);
    }

    return 0;
  }

  private getHistoricalFallbackStats(
    teamStats: any,
    performanceProfile: any,
  ): Partial<RawTeamFeatures> {
    const source = teamStats ?? performanceProfile;

    if (!source) {
      return {};
    }

    return {
      sampleSize: this.toNumber(source.sampleSize ?? source.matchesPlayed),

      wins: this.toNumber(source.wins ?? source.overall?.wins),

      draws: this.toNumber(source.draws ?? source.overall?.draws),

      losses: this.toNumber(source.losses ?? source.overall?.losses),

      goalsScored: this.toNumber(
        source.goalsScored ?? source.overall?.goalsScored,
      ),

      goalsConceded: this.toNumber(
        source.goalsConceded ?? source.overall?.goalsConceded,
      ),

      averageGoalsScored: this.toNumber(
        source.averageGoalsScored ?? source.overall?.averageGoalsScored,
      ),

      averageGoalsConceded: this.toNumber(
        source.averageGoalsConceded ?? source.overall?.averageGoalsConceded,
      ),

      winRate: this.readRate(source.winRate ?? source.overall?.winRate),

      drawRate: this.readRate(source.drawRate ?? source.overall?.drawRate),

      lossRate: this.readRate(source.lossRate ?? source.overall?.lossRate),

      bttsRate: this.readRate(source.bttsRate ?? source.overall?.bttsRate),

      cleanSheetRate: this.readRate(
        source.cleanSheetRate ?? source.overall?.cleanSheetRate,
      ),

      failedToScoreRate: this.readRate(
        source.failedToScoreRate ?? source.overall?.failedToScoreRate,
      ),

      over05Rate: this.readRate(
        source.over05Rate ?? source.overall?.over05Rate,
      ),

      over15Rate: this.readRate(
        source.over15Rate ?? source.overall?.over15Rate,
      ),

      over25Rate: this.readRate(
        source.over25Rate ?? source.overall?.over25Rate,
      ),

      over35Rate: this.readRate(
        source.over35Rate ?? source.overall?.over35Rate,
      ),

      over45Rate: this.readRate(
        source.over45Rate ?? source.overall?.over45Rate,
      ),

      over55Rate: this.readRate(
        source.over55Rate ?? source.overall?.over55Rate,
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

    return {
      ...calculated,

      sampleSize:
        completedSample > 0
          ? calculated.sampleSize
          : this.toNumber(fallback.sampleSize),

      wins:
        completedSample > 0 ? calculated.wins : this.toNumber(fallback.wins),

      draws:
        completedSample > 0 ? calculated.draws : this.toNumber(fallback.draws),

      losses:
        completedSample > 0
          ? calculated.losses
          : this.toNumber(fallback.losses),

      goalsScored:
        completedSample > 0
          ? calculated.goalsScored
          : this.toNumber(fallback.goalsScored),

      goalsConceded:
        completedSample > 0
          ? calculated.goalsConceded
          : this.toNumber(fallback.goalsConceded),

      averageGoalsScored:
        completedSample > 0
          ? calculated.averageGoalsScored
          : this.toNumber(fallback.averageGoalsScored),

      averageGoalsConceded:
        completedSample > 0
          ? calculated.averageGoalsConceded
          : this.toNumber(fallback.averageGoalsConceded),

      winRate:
        completedSample > 0
          ? calculated.winRate
          : this.readRate(fallback.winRate),

      drawRate:
        completedSample > 0
          ? calculated.drawRate
          : this.readRate(fallback.drawRate),

      lossRate:
        completedSample > 0
          ? calculated.lossRate
          : this.readRate(fallback.lossRate),

      bttsRate:
        completedSample > 0
          ? calculated.bttsRate
          : this.readRate(fallback.bttsRate),

      cleanSheetRate:
        completedSample > 0
          ? calculated.cleanSheetRate
          : this.readRate(fallback.cleanSheetRate),

      failedToScoreRate:
        completedSample > 0
          ? calculated.failedToScoreRate
          : this.readRate(fallback.failedToScoreRate),

      over05Rate:
        completedSample > 0
          ? calculated.over05Rate
          : this.readRate(fallback.over05Rate),

      over15Rate:
        completedSample > 0
          ? calculated.over15Rate
          : this.readRate(fallback.over15Rate),

      over25Rate:
        completedSample > 0
          ? calculated.over25Rate
          : this.readRate(fallback.over25Rate),

      over35Rate:
        completedSample > 0
          ? calculated.over35Rate
          : this.readRate(fallback.over35Rate),

      over45Rate:
        completedSample > 0
          ? calculated.over45Rate
          : this.readRate(fallback.over45Rate),

      over55Rate:
        completedSample > 0
          ? calculated.over55Rate
          : this.readRate(fallback.over55Rate),

      points:
        completedSample > 0
          ? calculated.points
          : this.toNumber(fallback.points),

      pointsPerMatch:
        completedSample > 0
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
    const checks = [
      home.sampleSize > 0,
      away.sampleSize > 0,

      home.recent.sampleSize > 0,
      away.recent.sampleSize > 0,

      home.venue.sampleSize > 0,
      away.venue.sampleSize > 0,

      standings.home !== null,
      standings.away !== null,

      h2h?.available === true,
    ];

    const available = checks.filter(Boolean).length;

    return (available / checks.length) * 100;
  }

  private calculateHistoricalDataQuality(
    homeHistoricalSample: number,
    awayHistoricalSample: number,
    home: RawTeamFeatures,
    away: RawTeamFeatures,
  ): number {
    const homeSample = Math.min(homeHistoricalSample / 30, 1);

    const awaySample = Math.min(awayHistoricalSample / 30, 1);

    const teamAvailability =
      home.dataAvailability.historicalMatches &&
      away.dataAvailability.historicalMatches
        ? 1
        : 0;

    return this.clamp(
      (homeSample * 0.4 + awaySample * 0.4 + teamAvailability * 0.2) * 100,
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
    const number = this.toNumber(value);

    if (number < 0) {
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
