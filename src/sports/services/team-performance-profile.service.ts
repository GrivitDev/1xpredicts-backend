import { Injectable, Logger } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import {
  TeamPerformanceProfile,
  TeamPerformanceProfileDocument,
} from '../schemas/team-performance-profile.schema';

import {
  EspnFixture,
  EspnFixtureDocument,
} from '../schemas/espn/espn-fixture.schema';

import {
  EspnMatchEvent,
  EspnMatchEventDocument,
} from '../schemas/espn/espn-match-event.schema';

import {
  EspnMatchStatistics,
  EspnMatchStatisticsDocument,
} from '../schemas/espn/espn-match-statistics.schema';

import { EspnTeam, EspnTeamDocument } from '../schemas/espn/espn-team.schema';

interface TeamMatch {
  fixtureId: string;
  date: Date;
  competitionId: string;
  teamId: string;
  teamName: string;
  opponentId: string;
  opponentName: string;
  home: boolean;
  goalsFor: number;
  goalsAgainst: number;
  result: 'W' | 'D' | 'L';
}

interface MatchSummary {
  fixture: EspnFixtureDocument;
  teamMatch: TeamMatch;
  statistics?: EspnMatchStatisticsDocument;
  events: EspnMatchEventDocument[];
}

interface AggregateStats {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  goalsScored: number;
  goalsConceded: number;
  cleanSheets: number;
  failedToScore: number;
  btts: number;
  over15: number;
  over25: number;
  over35: number;

  possessionTotal: number;
  possessionCount: number;

  shotsTotal: number;
  shotsCount: number;

  shotsOnTargetTotal: number;
  shotsOnTargetCount: number;

  cornersTotal: number;
  cornersCount: number;

  foulsTotal: number;
  foulsCount: number;

  offsidesTotal: number;
  offsidesCount: number;

  yellowCardsTotal: number;
  yellowCardsCount: number;

  redCardsTotal: number;
  redCardsCount: number;

  savesTotal: number;
  savesCount: number;
}

interface TimingStats {
  firstHalfGoalsScored: number;
  firstHalfGoalsConceded: number;
  secondHalfGoalsScored: number;
  secondHalfGoalsConceded: number;

  scoredFirstCount: number;
  concededFirstCount: number;

  cameFromBehindCount: number;
  protectedLeadCount: number;
}

@Injectable()
export class TeamPerformanceProfileService {
  private readonly logger = new Logger(TeamPerformanceProfileService.name);

  private readonly completedStatuses = new Set([
    'FT',
    'AET',
    'PEN',
    'STATUS_FINAL',
    'FINAL',
    'FINISHED',
    'COMPLETED',
  ]);

  constructor(
    @InjectModel(TeamPerformanceProfile.name)
    private readonly profileModel: Model<TeamPerformanceProfileDocument>,

    @InjectModel(EspnFixture.name)
    private readonly fixtureModel: Model<EspnFixtureDocument>,

    @InjectModel(EspnMatchEvent.name)
    private readonly eventModel: Model<EspnMatchEventDocument>,

    @InjectModel(EspnMatchStatistics.name)
    private readonly statisticsModel: Model<EspnMatchStatisticsDocument>,

    @InjectModel(EspnTeam.name)
    private readonly teamModel: Model<EspnTeamDocument>,
  ) {}

  // ============================================================
  // REBUILD ONE COMPETITION
  // ============================================================

  async rebuildCompetition(
    competitionId: string,
    season: number,
  ): Promise<number> {
    const leagueId = competitionId.trim().toLowerCase();

    const fixtures = await this.fixtureModel
      .find({
        leagueId,
        season,
      })
      .sort({
        fixtureDate: -1,
      })
      .lean()
      .exec();

    const completedFixtures = fixtures.filter((fixture) =>
      this.isCompletedFixture(fixture),
    );

    if (completedFixtures.length === 0) {
      return 0;
    }

    const teamIds = new Set<string>();

    for (const fixture of completedFixtures) {
      if (fixture.homeTeamId) {
        teamIds.add(fixture.homeTeamId);
      }

      if (fixture.awayTeamId) {
        teamIds.add(fixture.awayTeamId);
      }
    }

    const teams = await this.getTeamNames([...teamIds]);

    const matchSummaries = await this.buildMatchSummaries(
      completedFixtures,
      teams,
    );

    let rebuilt = 0;

    for (const teamId of teamIds) {
      const teamMatches = matchSummaries
        .filter((match) => match.teamMatch.teamId === teamId)
        .sort(
          (a, b) => b.teamMatch.date.getTime() - a.teamMatch.date.getTime(),
        );

      if (teamMatches.length === 0) {
        continue;
      }

      await this.rebuildTeamProfile(leagueId, season, teamId, teamMatches);

      rebuilt += 1;
    }

    return rebuilt;
  }

  // ============================================================
  // REFRESH ONE TEAM
  // ============================================================

  async refreshForTeam(
    competitionId: string,
    season: number,
    teamId: string,
  ): Promise<boolean> {
    const leagueId = competitionId.trim().toLowerCase();

    const normalizedTeamId = teamId.trim();

    if (!normalizedTeamId) {
      return false;
    }

    const fixtures = await this.fixtureModel
      .find({
        leagueId,
        season,
        $or: [
          {
            homeTeamId: normalizedTeamId,
          },
          {
            awayTeamId: normalizedTeamId,
          },
        ],
      })
      .sort({
        fixtureDate: -1,
      })
      .lean()
      .exec();

    const completedFixtures = fixtures.filter((fixture) =>
      this.isCompletedFixture(fixture),
    );

    if (completedFixtures.length === 0) {
      return false;
    }

    const opponentIds = new Set<string>();

    for (const fixture of completedFixtures) {
      const opponentId =
        fixture.homeTeamId === normalizedTeamId
          ? fixture.awayTeamId
          : fixture.homeTeamId;

      if (opponentId) {
        opponentIds.add(opponentId);
      }
    }

    const teamNames = await this.getTeamNames([
      normalizedTeamId,
      ...opponentIds,
    ]);

    const summaries = await this.buildMatchSummaries(
      completedFixtures,
      teamNames,
      normalizedTeamId,
    );

    const teamMatches = summaries
      .filter((match) => match.teamMatch.teamId === normalizedTeamId)
      .sort((a, b) => b.teamMatch.date.getTime() - a.teamMatch.date.getTime());

    if (teamMatches.length === 0) {
      return false;
    }

    await this.rebuildTeamProfile(
      leagueId,
      season,
      normalizedTeamId,
      teamMatches,
    );

    return true;
  }

  // ============================================================
  // REFRESH FROM FIXTURE
  // ============================================================

  async refreshForFixture(fixtureId: string): Promise<number> {
    const fixture = await this.fixtureModel
      .findOne({
        eventId: fixtureId.trim(),
      })
      .lean()
      .exec();

    if (!fixture || !this.isCompletedFixture(fixture)) {
      return 0;
    }

    const teamIds = [fixture.homeTeamId, fixture.awayTeamId].filter(
      (value): value is string => Boolean(value),
    );

    let refreshed = 0;

    for (const teamId of teamIds) {
      const result = await this.refreshForTeam(
        fixture.leagueId,
        fixture.season,
        teamId,
      );

      if (result) {
        refreshed += 1;
      }
    }

    return refreshed;
  }

  // ============================================================
  // REBUILD TEAM
  // ============================================================

  private async rebuildTeamProfile(
    leagueId: string,
    season: number,
    teamId: string,
    matches: MatchSummary[],
  ): Promise<void> {
    const teamMatchRecords = matches.map((match) => match.teamMatch);

    const lastFive = teamMatchRecords.slice(0, 5);

    const lastTen = teamMatchRecords.slice(0, 10);

    const overall = this.createAggregateStats();

    const home = this.createAggregateStats();

    const away = this.createAggregateStats();

    for (const match of matches) {
      this.applyMatch(overall, match.teamMatch, match.statistics);

      if (match.teamMatch.home) {
        this.applyMatch(home, match.teamMatch, match.statistics);
      } else {
        this.applyMatch(away, match.teamMatch, match.statistics);
      }
    }

    const lastFiveStats = this.calculateWindowStats(matches, 5);

    const timing = this.calculateTimingStats(matches, teamId);

    const recentFormScore = this.calculateFormScore(lastFive);

    const attackingFormScore = this.calculateAttackingFormScore(lastFive);

    const defensiveFormScore = this.calculateDefensiveFormScore(lastFive);

    const homeFormScore = this.calculateFormScore(
      teamMatchRecords.filter((match) => match.home).slice(0, 5),
    );

    const awayFormScore = this.calculateFormScore(
      teamMatchRecords.filter((match) => !match.home).slice(0, 5),
    );

    const momentumScore = this.calculateMomentumScore(teamMatchRecords);

    const overallPerformanceScore = this.calculateOverallPerformanceScore(
      overall,
      recentFormScore,
      momentumScore,
    );

    const previousMatch = teamMatchRecords[0];

    const nextFixture = await this.getNextFixture(leagueId, season, teamId);

    const team = await this.teamModel
      .findOne({
        leagueId,
        teamId,
      })
      .lean()
      .exec();

    const teamName = team?.name ?? previousMatch?.teamName ?? `Team ${teamId}`;

    const teamLogo = team?.logo;

    const formLastFive = lastFive.map((match) => match.result);

    const formLastTen = lastTen.map((match) => match.result);

    const lastFivePoints = this.getFormPoints(lastFive);

    const lastTenPoints = this.getFormPoints(lastTen);

    const streaks = this.calculateStreaks(teamMatchRecords);

    const recentWins = lastFive.filter((match) => match.result === 'W').length;

    const recentDraws = lastFive.filter((match) => match.result === 'D').length;

    const recentLosses = lastFive.filter(
      (match) => match.result === 'L',
    ).length;

    const previousMatchDate = previousMatch?.date;

    const nextMatchDate = nextFixture?.fixtureDate;

    await this.profileModel
      .updateOne(
        {
          competitionId: leagueId,
          season,
          teamId,
        },
        {
          $set: {
            competitionId: leagueId,

            season,

            teamId,

            teamName,

            teamLogo,

            matchesAnalyzed: teamMatchRecords.length,

            matchesLastFive: lastFive.length,

            matchesLastTen: lastTen.length,

            formLastFive,

            formLastTen,

            lastFivePoints,

            lastTenPoints,

            currentWinStreak: streaks.currentWinStreak,

            currentDrawStreak: streaks.currentDrawStreak,

            currentLossStreak: streaks.currentLossStreak,

            unbeatenStreak: streaks.unbeatenStreak,

            winlessStreak: streaks.winlessStreak,

            scoringStreak: streaks.scoringStreak,

            cleanSheetStreak: streaks.cleanSheetStreak,

            recentWins,

            recentDraws,

            recentLosses,

            recentWinRate: this.rate(recentWins, lastFive.length),

            recentDrawRate: this.rate(recentDraws, lastFive.length),

            recentLossRate: this.rate(recentLosses, lastFive.length),

            recentPointsPerMatch: this.averageRate(
              lastFivePoints,
              lastFive.length,
            ),

            goalsScored: overall.goalsScored,

            goalsConceded: overall.goalsConceded,

            averageGoalsScored: this.average(
              overall.goalsScored,
              overall.played,
            ),

            averageGoalsConceded: this.average(
              overall.goalsConceded,
              overall.played,
            ),

            goalDifference: overall.goalsScored - overall.goalsConceded,

            averageGoalDifference: this.average(
              overall.goalsScored - overall.goalsConceded,
              overall.played,
            ),

            cleanSheets: overall.cleanSheets,

            cleanSheetRate: this.rate(overall.cleanSheets, overall.played),

            failedToScore: overall.failedToScore,

            failedToScoreRate: this.rate(overall.failedToScore, overall.played),

            bttsCount: overall.btts,

            bttsRate: this.rate(overall.btts, overall.played),

            over15Count: overall.over15,

            over15Rate: this.rate(overall.over15, overall.played),

            over25Count: overall.over25,

            over25Rate: this.rate(overall.over25, overall.played),

            over35Count: overall.over35,

            over35Rate: this.rate(overall.over35, overall.played),

            homeMatches: home.played,

            homeWins: home.wins,

            homeDraws: home.draws,

            homeLosses: home.losses,

            homePoints: home.points,

            homeWinRate: this.rate(home.wins, home.played),

            homeGoalsScored: home.goalsScored,

            homeGoalsConceded: home.goalsConceded,

            homeAverageGoalsScored: this.average(home.goalsScored, home.played),

            homeAverageGoalsConceded: this.average(
              home.goalsConceded,
              home.played,
            ),

            homeCleanSheetRate: this.rate(home.cleanSheets, home.played),

            homeFailedToScoreRate: this.rate(home.failedToScore, home.played),

            homeBttsRate: this.rate(home.btts, home.played),

            homeOver25Rate: this.rate(home.over25, home.played),

            awayMatches: away.played,

            awayWins: away.wins,

            awayDraws: away.draws,

            awayLosses: away.losses,

            awayPoints: away.points,

            awayWinRate: this.rate(away.wins, away.played),

            awayGoalsScored: away.goalsScored,

            awayGoalsConceded: away.goalsConceded,

            awayAverageGoalsScored: this.average(away.goalsScored, away.played),

            awayAverageGoalsConceded: this.average(
              away.goalsConceded,
              away.played,
            ),

            awayCleanSheetRate: this.rate(away.cleanSheets, away.played),

            awayFailedToScoreRate: this.rate(away.failedToScore, away.played),

            awayBttsRate: this.rate(away.btts, away.played),

            awayOver25Rate: this.rate(away.over25, away.played),

            averagePossession: this.optionalAverage(
              overall.possessionTotal,
              overall.possessionCount,
            ),

            averageShots: this.optionalAverage(
              overall.shotsTotal,
              overall.shotsCount,
            ),

            averageShotsOnTarget: this.optionalAverage(
              overall.shotsOnTargetTotal,
              overall.shotsOnTargetCount,
            ),

            averageCorners: this.optionalAverage(
              overall.cornersTotal,
              overall.cornersCount,
            ),

            averageFouls: this.optionalAverage(
              overall.foulsTotal,
              overall.foulsCount,
            ),

            averageOffsides: this.optionalAverage(
              overall.offsidesTotal,
              overall.offsidesCount,
            ),

            averageYellowCards: this.optionalAverage(
              overall.yellowCardsTotal,
              overall.yellowCardsCount,
            ),

            averageRedCards: this.optionalAverage(
              overall.redCardsTotal,
              overall.redCardsCount,
            ),

            averageSaves: this.optionalAverage(
              overall.savesTotal,
              overall.savesCount,
            ),

            lastFiveAveragePossession: this.optionalWindowAverage(
              lastFiveStats,
              'possession',
            ),

            lastFiveAverageShots: this.optionalWindowAverage(
              lastFiveStats,
              'shots',
            ),

            lastFiveAverageShotsOnTarget: this.optionalWindowAverage(
              lastFiveStats,
              'shotsOnTarget',
            ),

            lastFiveAverageCorners: this.optionalWindowAverage(
              lastFiveStats,
              'corners',
            ),

            lastFiveAverageFouls: this.optionalWindowAverage(
              lastFiveStats,
              'fouls',
            ),

            lastFiveAverageYellowCards: this.optionalWindowAverage(
              lastFiveStats,
              'yellowCards',
            ),

            lastFiveAverageRedCards: this.optionalWindowAverage(
              lastFiveStats,
              'redCards',
            ),

            firstHalfGoalsScored: timing.firstHalfGoalsScored,

            firstHalfGoalsConceded: timing.firstHalfGoalsConceded,

            secondHalfGoalsScored: timing.secondHalfGoalsScored,

            secondHalfGoalsConceded: timing.secondHalfGoalsConceded,

            averageFirstHalfGoalsScored: this.average(
              timing.firstHalfGoalsScored,
              overall.played,
            ),

            averageFirstHalfGoalsConceded: this.average(
              timing.firstHalfGoalsConceded,
              overall.played,
            ),

            averageSecondHalfGoalsScored: this.average(
              timing.secondHalfGoalsScored,
              overall.played,
            ),

            averageSecondHalfGoalsConceded: this.average(
              timing.secondHalfGoalsConceded,
              overall.played,
            ),

            scoredFirstCount: timing.scoredFirstCount,

            scoredFirstRate: this.rate(timing.scoredFirstCount, overall.played),

            concededFirstCount: timing.concededFirstCount,

            concededFirstRate: this.rate(
              timing.concededFirstCount,
              overall.played,
            ),

            cameFromBehindCount: timing.cameFromBehindCount,

            cameFromBehindRate: this.rate(
              timing.cameFromBehindCount,
              overall.played,
            ),

            protectedLeadCount: timing.protectedLeadCount,

            protectedLeadRate: this.rate(
              timing.protectedLeadCount,
              overall.played,
            ),

            recentFormScore,

            attackingFormScore,

            defensiveFormScore,

            homeFormScore,

            awayFormScore,

            momentumScore,

            overallPerformanceScore,

            previousMatchDate: previousMatchDate ?? null,

            daysSincePreviousMatch: previousMatchDate
              ? this.daysBetween(previousMatchDate, new Date())
              : 0,

            nextMatchDate: nextMatchDate ?? null,

            daysUntilNextMatch: nextMatchDate
              ? this.daysBetween(new Date(), nextMatchDate)
              : 0,

            calculatedAt: new Date(),
          },
        },
        {
          upsert: true,
        },
      )
      .exec();

    this.logger.debug(
      `Team performance profile rebuilt: ` + `${leagueId}/${season}/${teamId}`,
    );
  }

  // ============================================================
  // MATCH SUMMARIES
  // ============================================================

  private async buildMatchSummaries(
    fixtures: EspnFixtureDocument[],
    teamNames: Map<string, EspnTeamDocument>,
    onlyTeamId?: string,
  ): Promise<MatchSummary[]> {
    const summaries: MatchSummary[] = [];

    for (const fixture of fixtures) {
      const homeId = fixture.homeTeamId;

      const awayId = fixture.awayTeamId;

      if (!homeId || !awayId) {
        continue;
      }

      if (onlyTeamId && homeId !== onlyTeamId && awayId !== onlyTeamId) {
        continue;
      }

      if (fixture.homeScore === undefined || fixture.awayScore === undefined) {
        continue;
      }

      const events = await this.eventModel
        .find({
          eventId: fixture.eventId,
        })
        .sort({
          clock: 1,
        })
        .lean()
        .exec();

      const statistics = onlyTeamId
        ? await this.statisticsModel
            .findOne({
              eventId: fixture.eventId,

              teamId: onlyTeamId,
            })
            .lean()
            .exec()
        : undefined;

      const sides = [
        {
          teamId: homeId,

          opponentId: awayId,

          home: true,

          goalsFor: fixture.homeScore,

          goalsAgainst: fixture.awayScore,
        },
        {
          teamId: awayId,

          opponentId: homeId,

          home: false,

          goalsFor: fixture.awayScore,

          goalsAgainst: fixture.homeScore,
        },
      ];

      for (const side of sides) {
        if (onlyTeamId && side.teamId !== onlyTeamId) {
          continue;
        }

        const team = teamNames.get(side.teamId);

        const opponent = teamNames.get(side.opponentId);

        const result =
          side.goalsFor > side.goalsAgainst
            ? 'W'
            : side.goalsFor === side.goalsAgainst
              ? 'D'
              : 'L';

        summaries.push({
          fixture,

          teamMatch: {
            fixtureId: fixture.eventId,

            date: fixture.fixtureDate,

            competitionId: fixture.leagueId,

            teamId: side.teamId,

            teamName: team?.name ?? `Team ${side.teamId}`,

            opponentId: side.opponentId,

            opponentName: opponent?.name ?? `Team ${side.opponentId}`,

            home: side.home,

            goalsFor: side.goalsFor,

            goalsAgainst: side.goalsAgainst,

            result,
          },

          statistics: statistics ?? undefined,

          events,
        });
      }
    }

    return summaries;
  }

  // ============================================================
  // AGGREGATION
  // ============================================================

  private applyMatch(
    aggregate: AggregateStats,
    match: TeamMatch,
    statistics?: EspnMatchStatisticsDocument,
  ): void {
    aggregate.played += 1;

    aggregate.goalsScored += match.goalsFor;

    aggregate.goalsConceded += match.goalsAgainst;

    if (match.result === 'W') {
      aggregate.wins += 1;
      aggregate.points += 3;
    } else if (match.result === 'D') {
      aggregate.draws += 1;
      aggregate.points += 1;
    } else {
      aggregate.losses += 1;
    }

    if (match.goalsAgainst === 0) {
      aggregate.cleanSheets += 1;
    }

    if (match.goalsFor === 0) {
      aggregate.failedToScore += 1;
    }

    if (match.goalsFor > 0 && match.goalsAgainst > 0) {
      aggregate.btts += 1;
    }

    const totalGoals = match.goalsFor + match.goalsAgainst;

    if (totalGoals > 1) {
      aggregate.over15 += 1;
    }

    if (totalGoals > 2) {
      aggregate.over25 += 1;
    }

    if (totalGoals > 3) {
      aggregate.over35 += 1;
    }

    if (!statistics) {
      return;
    }

    if (statistics.possession !== undefined) {
      aggregate.possessionTotal += statistics.possession;

      aggregate.possessionCount += 1;
    }

    if (statistics.shots !== undefined) {
      aggregate.shotsTotal += statistics.shots;

      aggregate.shotsCount += 1;
    }

    if (statistics.shotsOnTarget !== undefined) {
      aggregate.shotsOnTargetTotal += statistics.shotsOnTarget;

      aggregate.shotsOnTargetCount += 1;
    }

    if (statistics.corners !== undefined) {
      aggregate.cornersTotal += statistics.corners;

      aggregate.cornersCount += 1;
    }

    if (statistics.fouls !== undefined) {
      aggregate.foulsTotal += statistics.fouls;

      aggregate.foulsCount += 1;
    }

    if (statistics.offsides !== undefined) {
      aggregate.offsidesTotal += statistics.offsides;

      aggregate.offsidesCount += 1;
    }

    if (statistics.yellowCards !== undefined) {
      aggregate.yellowCardsTotal += statistics.yellowCards;

      aggregate.yellowCardsCount += 1;
    }

    if (statistics.redCards !== undefined) {
      aggregate.redCardsTotal += statistics.redCards;

      aggregate.redCardsCount += 1;
    }

    if (statistics.saves !== undefined) {
      aggregate.savesTotal += statistics.saves;

      aggregate.savesCount += 1;
    }
  }

  // ============================================================
  // WINDOW STATS
  // ============================================================

  private calculateWindowStats(
    matches: MatchSummary[],
    limit: number,
  ): {
    matches: TeamMatch[];
    possessionTotal: number;
    possessionCount: number;
    shotsTotal: number;
    shotsCount: number;
    shotsOnTargetTotal: number;
    shotsOnTargetCount: number;
    cornersTotal: number;
    cornersCount: number;
    foulsTotal: number;
    foulsCount: number;
    yellowCardsTotal: number;
    yellowCardsCount: number;
    redCardsTotal: number;
    redCardsCount: number;
  } {
    const selected = matches.slice(0, limit);

    const result = {
      matches: selected.map((match) => match.teamMatch),

      possessionTotal: 0,
      possessionCount: 0,

      shotsTotal: 0,
      shotsCount: 0,

      shotsOnTargetTotal: 0,
      shotsOnTargetCount: 0,

      cornersTotal: 0,
      cornersCount: 0,

      foulsTotal: 0,
      foulsCount: 0,

      yellowCardsTotal: 0,
      yellowCardsCount: 0,

      redCardsTotal: 0,
      redCardsCount: 0,
    };

    for (const match of selected) {
      const statistics = match.statistics;

      if (!statistics) {
        continue;
      }

      if (statistics.possession !== undefined) {
        result.possessionTotal += statistics.possession;

        result.possessionCount += 1;
      }

      if (statistics.shots !== undefined) {
        result.shotsTotal += statistics.shots;

        result.shotsCount += 1;
      }

      if (statistics.shotsOnTarget !== undefined) {
        result.shotsOnTargetTotal += statistics.shotsOnTarget;

        result.shotsOnTargetCount += 1;
      }

      if (statistics.corners !== undefined) {
        result.cornersTotal += statistics.corners;

        result.cornersCount += 1;
      }

      if (statistics.fouls !== undefined) {
        result.foulsTotal += statistics.fouls;

        result.foulsCount += 1;
      }

      if (statistics.yellowCards !== undefined) {
        result.yellowCardsTotal += statistics.yellowCards;

        result.yellowCardsCount += 1;
      }

      if (statistics.redCards !== undefined) {
        result.redCardsTotal += statistics.redCards;

        result.redCardsCount += 1;
      }
    }

    return result;
  }

  // ============================================================
  // TIMING
  // ============================================================

  private calculateTimingStats(
    matches: MatchSummary[],
    teamId: string,
  ): TimingStats {
    const result: TimingStats = {
      firstHalfGoalsScored: 0,
      firstHalfGoalsConceded: 0,
      secondHalfGoalsScored: 0,
      secondHalfGoalsConceded: 0,
      scoredFirstCount: 0,
      concededFirstCount: 0,
      cameFromBehindCount: 0,
      protectedLeadCount: 0,
    };

    for (const match of matches) {
      const scoringEvents = match.events.filter(
        (event) => event.scoringPlay === true && Boolean(event.teamId),
      );

      if (scoringEvents.length === 0) {
        continue;
      }

      let teamScoredFirst = false;

      let opponentScoredFirst = false;

      let wentBehind = false;

      let hadLead = false;

      for (const event of scoringEvents) {
        const eventTeamId = event.teamId;

        const homeScore = event.homeScore;

        const awayScore = event.awayScore;

        if (typeof homeScore !== 'number' || typeof awayScore !== 'number') {
          continue;
        }

        const isTeamScoring = eventTeamId === teamId;

        if (!teamScoredFirst && !opponentScoredFirst) {
          if (isTeamScoring) {
            teamScoredFirst = true;
          } else {
            opponentScoredFirst = true;
          }
        }

        const teamScore = this.getTeamScore(
          match.fixture,
          teamId,
          homeScore,
          awayScore,
        );

        const opponentScore = this.getOpponentScore(
          match.fixture,
          teamId,
          homeScore,
          awayScore,
        );

        if (teamScore < opponentScore) {
          wentBehind = true;
        }

        if (teamScore > opponentScore) {
          hadLead = true;
        }

        const minute = this.extractMinute(event.clock, event.clockDisplay);

        if (!minute || minute <= 45) {
          if (isTeamScoring) {
            result.firstHalfGoalsScored += 1;
          } else {
            result.firstHalfGoalsConceded += 1;
          }
        } else {
          if (isTeamScoring) {
            result.secondHalfGoalsScored += 1;
          } else {
            result.secondHalfGoalsConceded += 1;
          }
        }
      }

      if (teamScoredFirst) {
        result.scoredFirstCount += 1;
      }

      if (opponentScoredFirst) {
        result.concededFirstCount += 1;
      }

      if (
        wentBehind &&
        match.teamMatch.goalsFor > match.teamMatch.goalsAgainst
      ) {
        result.cameFromBehindCount += 1;
      }

      if (hadLead && match.teamMatch.goalsFor > match.teamMatch.goalsAgainst) {
        result.protectedLeadCount += 1;
      }
    }

    return result;
  }

  // ============================================================
  // STREAKS
  // ============================================================

  private calculateStreaks(matches: TeamMatch[]): {
    currentWinStreak: number;
    currentDrawStreak: number;
    currentLossStreak: number;
    unbeatenStreak: number;
    winlessStreak: number;
    scoringStreak: number;
    cleanSheetStreak: number;
  } {
    let currentWinStreak = 0;
    let currentDrawStreak = 0;
    let currentLossStreak = 0;
    let unbeatenStreak = 0;
    let winlessStreak = 0;
    let scoringStreak = 0;
    let cleanSheetStreak = 0;

    for (const match of matches) {
      if (match.result === 'W' && currentWinStreak === matches.indexOf(match)) {
        currentWinStreak += 1;
      } else if (currentWinStreak > 0) {
        break;
      }
    }

    for (const match of matches) {
      if (match.result === 'D') {
        currentDrawStreak += 1;
      } else {
        break;
      }
    }

    for (const match of matches) {
      if (match.result === 'L') {
        currentLossStreak += 1;
      } else {
        break;
      }
    }

    for (const match of matches) {
      if (match.result === 'W' || match.result === 'D') {
        unbeatenStreak += 1;
      } else {
        break;
      }
    }

    for (const match of matches) {
      if (match.result === 'L' || match.result === 'D') {
        winlessStreak += 1;
      } else {
        break;
      }
    }

    for (const match of matches) {
      if (match.goalsFor > 0) {
        scoringStreak += 1;
      } else {
        break;
      }
    }

    for (const match of matches) {
      if (match.goalsAgainst === 0) {
        cleanSheetStreak += 1;
      } else {
        break;
      }
    }

    return {
      currentWinStreak,
      currentDrawStreak,
      currentLossStreak,
      unbeatenStreak,
      winlessStreak,
      scoringStreak,
      cleanSheetStreak,
    };
  }

  // ============================================================
  // FORM / DERIVED SCORES
  // ============================================================

  private calculateFormScore(matches: TeamMatch[]): number {
    if (matches.length === 0) {
      return 0;
    }

    const points = matches.reduce((total, match) => {
      if (match.result === 'W') {
        return total + 3;
      }

      if (match.result === 'D') {
        return total + 1;
      }

      return total;
    }, 0);

    return Number(((points / (matches.length * 3)) * 100).toFixed(2));
  }

  private calculateAttackingFormScore(matches: TeamMatch[]): number {
    if (matches.length === 0) {
      return 0;
    }

    const averageGoals = this.average(
      matches.reduce((total, match) => total + match.goalsFor, 0),
      matches.length,
    );

    return Number(Math.min(100, (averageGoals / 3) * 100).toFixed(2));
  }

  private calculateDefensiveFormScore(matches: TeamMatch[]): number {
    if (matches.length === 0) {
      return 0;
    }

    const averageGoalsConceded = this.average(
      matches.reduce((total, match) => total + match.goalsAgainst, 0),
      matches.length,
    );

    return Number(
      Math.max(
        0,
        Math.min(100, ((2.5 - averageGoalsConceded) / 2.5) * 100),
      ).toFixed(2),
    );
  }

  private calculateMomentumScore(matches: TeamMatch[]): number {
    if (matches.length === 0) {
      return 0;
    }

    const weights = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1];

    let weightedPoints = 0;
    let weightTotal = 0;

    matches.slice(0, 10).forEach((match, index) => {
      const weight = weights[index] ?? 0.1;

      const points = match.result === 'W' ? 3 : match.result === 'D' ? 1 : 0;

      weightedPoints += points * weight;

      weightTotal += 3 * weight;
    });

    if (weightTotal === 0) {
      return 0;
    }

    return Number(((weightedPoints / weightTotal) * 100).toFixed(2));
  }

  private calculateOverallPerformanceScore(
    stats: AggregateStats,
    formScore: number,
    momentumScore: number,
  ): number {
    if (stats.played === 0) {
      return 0;
    }

    const pointsPerMatch = stats.points / stats.played;

    const attack = stats.goalsScored / stats.played;

    const defence = stats.goalsConceded / stats.played;

    const base =
      pointsPerMatch * 20 +
      Math.min(30, attack * 10) +
      Math.max(0, 30 - defence * 10) +
      this.rate(stats.cleanSheets, stats.played) * 10 +
      this.rate(stats.btts, stats.played) * 10;

    return Number(
      Math.max(
        0,
        Math.min(100, base * 0.55 + formScore * 0.25 + momentumScore * 0.2),
      ).toFixed(2),
    );
  }

  // ============================================================
  // TEAM DATA
  // ============================================================

  private async getTeamNames(
    teamIds: string[],
  ): Promise<Map<string, EspnTeamDocument>> {
    const ids = [...new Set(teamIds.filter(Boolean))];

    const teams = await this.teamModel
      .find({
        teamId: {
          $in: ids,
        },
      })
      .lean()
      .exec();

    return new Map(teams.map((team) => [team.teamId, team]));
  }

  // ============================================================
  // NEXT FIXTURE
  // ============================================================

  private async getNextFixture(
    leagueId: string,
    season: number,
    teamId: string,
  ): Promise<EspnFixtureDocument | null> {
    return this.fixtureModel
      .findOne({
        leagueId: leagueId.trim().toLowerCase(),

        season,

        fixtureDate: {
          $gte: new Date(),
        },

        $or: [
          {
            homeTeamId: teamId,
          },
          {
            awayTeamId: teamId,
          },
        ],
      })
      .sort({
        fixtureDate: 1,
      })
      .lean()
      .exec();
  }

  // ============================================================
  // SCORE HELPERS
  // ============================================================

  private getTeamScore(
    fixture: EspnFixtureDocument,
    teamId: string,
    homeScore: number,
    awayScore: number,
  ): number {
    return fixture.homeTeamId === teamId ? homeScore : awayScore;
  }

  private getOpponentScore(
    fixture: EspnFixtureDocument,
    teamId: string,
    homeScore: number,
    awayScore: number,
  ): number {
    return fixture.homeTeamId === teamId ? awayScore : homeScore;
  }

  // ============================================================
  // CLOCK
  // ============================================================

  private extractMinute(clock?: number, clockDisplay?: string): number | null {
    if (typeof clockDisplay === 'string') {
      const match = clockDisplay.match(/^(\d+)/);

      if (match) {
        const minute = Number(match[1]);

        if (Number.isFinite(minute)) {
          return minute;
        }
      }
    }

    if (typeof clock === 'number' && Number.isFinite(clock)) {
      return clock;
    }

    return null;
  }

  // ============================================================
  // STATUS
  // ============================================================

  private isCompletedFixture(fixture: EspnFixtureDocument): boolean {
    if (fixture.completed === true) {
      return true;
    }

    return this.completedStatuses.has(fixture.status.trim().toUpperCase());
  }

  // ============================================================
  // STATS FACTORY
  // ============================================================

  private createAggregateStats(): AggregateStats {
    return {
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0,

      goalsScored: 0,
      goalsConceded: 0,

      cleanSheets: 0,
      failedToScore: 0,

      btts: 0,

      over15: 0,
      over25: 0,
      over35: 0,

      possessionTotal: 0,
      possessionCount: 0,

      shotsTotal: 0,
      shotsCount: 0,

      shotsOnTargetTotal: 0,
      shotsOnTargetCount: 0,

      cornersTotal: 0,
      cornersCount: 0,

      foulsTotal: 0,
      foulsCount: 0,

      offsidesTotal: 0,
      offsidesCount: 0,

      yellowCardsTotal: 0,
      yellowCardsCount: 0,

      redCardsTotal: 0,
      redCardsCount: 0,

      savesTotal: 0,
      savesCount: 0,
    };
  }

  // ============================================================
  // RATES
  // ============================================================

  private rate(numerator: number, denominator: number): number {
    if (denominator <= 0) {
      return 0;
    }

    return Number((numerator / denominator).toFixed(3));
  }

  private average(total: number, count: number): number {
    if (count <= 0) {
      return 0;
    }

    return Number((total / count).toFixed(3));
  }

  private averageRate(total: number, count: number): number {
    return this.average(total, count);
  }

  private optionalAverage(total: number, count: number): number | undefined {
    if (count <= 0) {
      return undefined;
    }

    return this.average(total, count);
  }

  private optionalWindowAverage(
    data: {
      possessionTotal: number;
      possessionCount: number;
      shotsTotal: number;
      shotsCount: number;
      shotsOnTargetTotal: number;
      shotsOnTargetCount: number;
      cornersTotal: number;
      cornersCount: number;
      foulsTotal: number;
      foulsCount: number;
      yellowCardsTotal: number;
      yellowCardsCount: number;
      redCardsTotal: number;
      redCardsCount: number;
    },
    metric:
      | 'possession'
      | 'shots'
      | 'shotsOnTarget'
      | 'corners'
      | 'fouls'
      | 'yellowCards'
      | 'redCards',
  ): number | undefined {
    switch (metric) {
      case 'possession':
        return this.optionalAverage(data.possessionTotal, data.possessionCount);

      case 'shots':
        return this.optionalAverage(data.shotsTotal, data.shotsCount);

      case 'shotsOnTarget':
        return this.optionalAverage(
          data.shotsOnTargetTotal,
          data.shotsOnTargetCount,
        );

      case 'corners':
        return this.optionalAverage(data.cornersTotal, data.cornersCount);

      case 'fouls':
        return this.optionalAverage(data.foulsTotal, data.foulsCount);

      case 'yellowCards':
        return this.optionalAverage(
          data.yellowCardsTotal,
          data.yellowCardsCount,
        );

      case 'redCards':
        return this.optionalAverage(data.redCardsTotal, data.redCardsCount);
    }
  }

  // ============================================================
  // FORM
  // ============================================================

  private getFormPoints(matches: TeamMatch[]): number {
    return matches.reduce((total, match) => {
      if (match.result === 'W') {
        return total + 3;
      }

      if (match.result === 'D') {
        return total + 1;
      }

      return total;
    }, 0);
  }

  // ============================================================
  // DATE
  // ============================================================

  private daysBetween(from: Date, to: Date): number {
    return Math.max(
      0,
      Math.floor((to.getTime() - from.getTime()) / 86_400_000),
    );
  }
}
