import { Injectable, Logger } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import {
  ApiFootballFixture,
  ApiFootballFixtureDocument,
} from '../schemas/api-football/api-football-fixture.schema';

import {
  ApiFootballStanding,
  ApiFootballStandingDocument,
} from '../schemas/api-football/api-football-standing.schema';

import {
  ActiveCompetition,
  ActiveCompetitionDocument,
} from '../schemas/active-competition.schema';

import {
  TeamCompetitionStats,
  TeamCompetitionStatsDocument,
} from '../schemas/team-competition-stats.schema';

interface FixtureTeam {
  id?: number;
  name?: string;
}

interface FixtureData {
  fixture?: {
    id?: number;
    date?: string;
    status?: {
      short?: string;
    };
  };

  teams?: {
    home?: FixtureTeam;
    away?: FixtureTeam;
  };

  goals?: {
    home?: number | null;
    away?: number | null;
  };
}

interface MatchStats {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  cleanSheets: number;
  failedToScore: number;
}

interface RecentMatch {
  date: Date;
  competitionId: string;
  opponentId: number;
  opponentName: string;
  home: boolean;
  goalsFor: number;
  goalsAgainst: number;
  result: 'W' | 'D' | 'L';
}

@Injectable()
export class TeamCompetitionStatsService {
  private readonly logger = new Logger(TeamCompetitionStatsService.name);

  private readonly completedStatuses = new Set(['FT', 'AET', 'PEN']);

  constructor(
    @InjectModel(ApiFootballFixture.name)
    private readonly fixtureModel: Model<ApiFootballFixtureDocument>,

    @InjectModel(ApiFootballStanding.name)
    private readonly standingModel: Model<ApiFootballStandingDocument>,

    @InjectModel(ActiveCompetition.name)
    private readonly activeCompetitionModel: Model<ActiveCompetitionDocument>,

    @InjectModel(TeamCompetitionStats.name)
    private readonly statsModel: Model<TeamCompetitionStatsDocument>,
  ) {}

  async rebuildCompetition(leagueId: number, season: number): Promise<number> {
    const competition = await this.activeCompetitionModel
      .findOne({
        apiFootballLeagueId: leagueId,
        season,
      })
      .lean()
      .exec();

    if (!competition) {
      return 0;
    }

    const fixtures = await this.fixtureModel
      .find({
        leagueId,
        season,
      })
      .lean()
      .exec();

    const completedFixtures = fixtures.filter((fixture) =>
      this.isCompletedFixture(fixture.payload),
    );

    const standings = await this.standingModel
      .find({
        leagueId,
        season,
      })
      .lean()
      .exec();

    const teams = new Map<number, string>();

    for (const standing of standings) {
      const payload = standing.payload as any;

      const teamId = standing.teamId ?? payload?.team?.id;

      if (typeof teamId !== 'number') {
        continue;
      }

      teams.set(teamId, payload?.team?.name ?? `Team ${teamId}`);
    }

    for (const fixture of completedFixtures) {
      const payload = fixture.payload as FixtureData;

      const home = payload.teams?.home;

      const away = payload.teams?.away;

      if (typeof home?.id === 'number') {
        teams.set(home.id, home.name ?? `Team ${home.id}`);
      }

      if (typeof away?.id === 'number') {
        teams.set(away.id, away.name ?? `Team ${away.id}`);
      }
    }

    for (const [teamId, teamName] of teams) {
      await this.rebuildTeam(
        competition.competitionId,
        leagueId,
        season,
        teamId,
        teamName,
        completedFixtures,
        standings,
      );
    }

    return teams.size;
  }

  async refreshForFixture(
    leagueId: number,
    season: number,
    fixtureId: number,
  ): Promise<number> {
    const competition = await this.activeCompetitionModel
      .findOne({
        apiFootballLeagueId: leagueId,
        season,
      })
      .lean()
      .exec();

    if (!competition) {
      return 0;
    }

    const fixture = await this.fixtureModel
      .findOne({
        fixtureId,
        leagueId,
        season,
      })
      .lean()
      .exec();

    if (!fixture || !this.isCompletedFixture(fixture.payload)) {
      return 0;
    }

    const payload = fixture.payload as FixtureData;

    const home = payload.teams?.home;

    const away = payload.teams?.away;

    const teamIds = [home?.id, away?.id].filter(
      (id): id is number => typeof id === 'number',
    );

    if (teamIds.length === 0) {
      return 0;
    }

    const fixtures = await this.fixtureModel
      .find({
        leagueId,
        season,
      })
      .lean()
      .exec();

    const completedFixtures = fixtures.filter((item) =>
      this.isCompletedFixture(item.payload),
    );

    const standings = await this.standingModel
      .find({
        leagueId,
        season,
      })
      .lean()
      .exec();

    for (const teamId of teamIds) {
      const teamName =
        teamId === home?.id
          ? (home?.name ?? `Team ${teamId}`)
          : (away?.name ?? `Team ${teamId}`);

      await this.rebuildTeam(
        competition.competitionId,
        leagueId,
        season,
        teamId,
        teamName,
        completedFixtures,
        standings,
      );
    }

    return teamIds.length;
  }

  private async rebuildTeam(
    competitionId: string,
    leagueId: number,
    season: number,
    teamId: number,
    teamName: string,
    fixtures: ApiFootballFixtureDocument[],
    standings: ApiFootballStandingDocument[],
  ): Promise<void> {
    const overall = this.emptyStats();

    const home = this.emptyStats();

    const away = this.emptyStats();

    const recentMatches: RecentMatch[] = [];

    for (const fixture of fixtures) {
      const payload = fixture.payload as FixtureData;

      const fixtureHome = payload.teams?.home;

      const fixtureAway = payload.teams?.away;

      if (
        typeof fixtureHome?.id !== 'number' ||
        typeof fixtureAway?.id !== 'number'
      ) {
        continue;
      }

      const isHome = fixtureHome.id === teamId;

      const isAway = fixtureAway.id === teamId;

      if (!isHome && !isAway) {
        continue;
      }

      const goalsHome = this.toNumber(payload.goals?.home);

      const goalsAway = this.toNumber(payload.goals?.away);

      const goalsFor = isHome ? goalsHome : goalsAway;

      const goalsAgainst = isHome ? goalsAway : goalsHome;

      const result =
        goalsFor > goalsAgainst ? 'W' : goalsFor === goalsAgainst ? 'D' : 'L';

      this.applyMatch(overall, goalsFor, goalsAgainst);

      this.applyMatch(isHome ? home : away, goalsFor, goalsAgainst);

      const date = this.getFixtureDate(payload, fixture.fixtureDate);

      recentMatches.push({
        date,

        competitionId,

        opponentId: isHome ? fixtureAway.id : fixtureHome.id,

        opponentName: isHome
          ? (fixtureAway.name ?? `Team ${fixtureAway.id}`)
          : (fixtureHome.name ?? `Team ${fixtureHome.id}`),

        home: isHome,

        goalsFor,

        goalsAgainst,

        result,
      });
    }

    recentMatches.sort((a, b) => b.date.getTime() - a.date.getTime());

    const lastFive = recentMatches.slice(0, 5);

    const standing = this.getTeamStanding(standings, teamId);

    const averages = this.calculateAverages(overall);

    const homeAverages = this.calculateAverages(home);

    const awayAverages = this.calculateAverages(away);

    const bttsRate = this.calculateRate(
      recentMatches,
      (match) => match.goalsFor > 0 && match.goalsAgainst > 0,
    );

    const over15Rate = this.calculateRate(
      recentMatches,
      (match) => match.goalsFor + match.goalsAgainst > 1,
    );

    const over25Rate = this.calculateRate(
      recentMatches,
      (match) => match.goalsFor + match.goalsAgainst > 2,
    );

    const over35Rate = this.calculateRate(
      recentMatches,
      (match) => match.goalsFor + match.goalsAgainst > 3,
    );

    const recentFormScore = this.calculateFormScore(lastFive);

    const homeStrengthScore = this.calculateStrengthScore(home);

    const awayStrengthScore = this.calculateStrengthScore(away);

    const overallStrengthScore = this.calculateOverallStrength(
      overall,
      recentFormScore,
    );

    const previousMatch = recentMatches[0];

    const nextFixture = await this.getNextFixture(leagueId, season, teamId);

    await this.statsModel.updateOne(
      {
        competitionId,
        season,
        teamId,
      },
      {
        $set: {
          competitionId,
          season,
          teamId,
          teamName,

          position: standing?.rank ?? 0,

          points: standing?.points ?? overall.points,

          played: standing?.played ?? overall.played,

          wins: standing?.wins ?? overall.wins,

          draws: standing?.draws ?? overall.draws,

          losses: standing?.losses ?? overall.losses,

          goalsFor: standing?.goalsFor ?? overall.goalsFor,

          goalsAgainst: standing?.goalsAgainst ?? overall.goalsAgainst,

          goalDifference: standing?.goalDifference ?? overall.goalDifference,

          averageGoalsFor: averages.goalsFor,

          averageGoalsAgainst: averages.goalsAgainst,

          pointsPerGame: averages.pointsPerGame,

          bttsRate,

          over15Rate,

          over25Rate,

          over35Rate,

          cleanSheetRate: this.calculateSimpleRate(
            overall.cleanSheets,
            overall.played,
          ),

          failedToScoreRate: this.calculateSimpleRate(
            overall.failedToScore,
            overall.played,
          ),

          homePlayed: home.played,

          homeWins: home.wins,

          homeDraws: home.draws,

          homeLosses: home.losses,

          homeGoalsFor: home.goalsFor,

          homeGoalsAgainst: home.goalsAgainst,

          homeAverageGoalsFor: homeAverages.goalsFor,

          homeAverageGoalsAgainst: homeAverages.goalsAgainst,

          awayPlayed: away.played,

          awayWins: away.wins,

          awayDraws: away.draws,

          awayLosses: away.losses,

          awayGoalsFor: away.goalsFor,

          awayGoalsAgainst: away.goalsAgainst,

          awayAverageGoalsFor: awayAverages.goalsFor,

          awayAverageGoalsAgainst: awayAverages.goalsAgainst,

          lastFive: lastFive.map(
            (match) => `${match.competitionId}:${match.result}`,
          ),

          lastFivePoints: this.getFormPoints(lastFive),

          lastFiveWins: lastFive.filter((match) => match.result === 'W').length,

          lastFiveDraws: lastFive.filter((match) => match.result === 'D')
            .length,

          lastFiveLosses: lastFive.filter((match) => match.result === 'L')
            .length,

          lastFiveGoalsFor: lastFive.reduce(
            (sum, match) => sum + match.goalsFor,
            0,
          ),

          lastFiveGoalsAgainst: lastFive.reduce(
            (sum, match) => sum + match.goalsAgainst,
            0,
          ),

          previousMatchDate: previousMatch?.date ?? null,

          daysSincePreviousMatch: previousMatch
            ? this.daysBetween(previousMatch.date, new Date())
            : null,

          nextMatchDate: nextFixture?.fixtureDate ?? null,

          daysUntilNextMatch: nextFixture
            ? this.daysBetween(new Date(), nextFixture.fixtureDate)
            : null,

          recentFormScore,

          homeStrengthScore,

          awayStrengthScore,

          overallStrengthScore,

          calculatedAt: new Date(),
        },
      },
      {
        upsert: true,
      },
    );
  }

  private async getNextFixture(
    leagueId: number,
    season: number,
    teamId: number,
  ): Promise<ApiFootballFixtureDocument | null> {
    return this.fixtureModel
      .findOne({
        leagueId,
        season,
        fixtureDate: {
          $gte: new Date(),
        },
        statusShort: {
          $nin: ['FT', 'AET', 'PEN'],
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

  private getTeamStanding(
    standings: ApiFootballStandingDocument[],
    teamId: number,
  ): {
    rank: number | null;
    points: number;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
  } | null {
    for (const standing of standings) {
      const payload = standing.payload as any;

      const payloadTeamId = payload?.team?.id;

      if (standing.teamId !== teamId && payloadTeamId !== teamId) {
        continue;
      }

      return {
        rank: this.toNullableNumber(standing.rank ?? payload?.rank),

        points: this.toNumber(payload?.points),

        played: this.toNumber(payload?.all?.played),

        wins: this.toNumber(payload?.all?.win),

        draws: this.toNumber(payload?.all?.draw),

        losses: this.toNumber(payload?.all?.lose),

        goalsFor: this.toNumber(payload?.all?.goals?.for),

        goalsAgainst: this.toNumber(payload?.all?.goals?.against),

        goalDifference: this.toNumber(payload?.goalsDiff),
      };
    }

    return null;
  }

  private applyMatch(
    stats: MatchStats,
    goalsFor: number,
    goalsAgainst: number,
  ): void {
    stats.played += 1;

    stats.goalsFor += goalsFor;

    stats.goalsAgainst += goalsAgainst;

    stats.goalDifference = stats.goalsFor - stats.goalsAgainst;

    if (goalsFor > goalsAgainst) {
      stats.wins += 1;
      stats.points += 3;
    } else if (goalsFor === goalsAgainst) {
      stats.draws += 1;
      stats.points += 1;
    } else {
      stats.losses += 1;
    }

    if (goalsAgainst === 0) {
      stats.cleanSheets += 1;
    }

    if (goalsFor === 0) {
      stats.failedToScore += 1;
    }
  }

  private calculateAverages(stats: MatchStats): {
    goalsFor: number;
    goalsAgainst: number;
    pointsPerGame: number;
  } {
    if (stats.played === 0) {
      return {
        goalsFor: 0,
        goalsAgainst: 0,
        pointsPerGame: 0,
      };
    }

    return {
      goalsFor: Number((stats.goalsFor / stats.played).toFixed(3)),

      goalsAgainst: Number((stats.goalsAgainst / stats.played).toFixed(3)),

      pointsPerGame: Number((stats.points / stats.played).toFixed(3)),
    };
  }

  private calculateRate(
    matches: RecentMatch[],
    predicate: (match: RecentMatch) => boolean,
  ): number {
    if (matches.length === 0) {
      return 0;
    }

    const count = matches.filter(predicate).length;

    return Number((count / matches.length).toFixed(3));
  }

  private calculateSimpleRate(numerator: number, denominator: number): number {
    if (denominator <= 0) {
      return 0;
    }

    return Number((numerator / denominator).toFixed(3));
  }

  private calculateFormScore(matches: RecentMatch[]): number {
    return Number((this.getFormPoints(matches) / 15).toFixed(3));
  }

  private calculateStrengthScore(stats: MatchStats): number {
    if (stats.played === 0) {
      return 0;
    }

    const pointsPerGame = stats.points / stats.played;

    const attack = stats.goalsFor / stats.played;

    const defence = stats.goalsAgainst / stats.played;

    const score =
      pointsPerGame * 30 +
      attack * 20 +
      Math.max(0, 2.5 - defence) * 20 +
      this.calculateSimpleRate(stats.cleanSheets, stats.played) * 15 +
      this.calculateSimpleRate(stats.failedToScore, stats.played) * -10;

    return Number(Math.max(0, Math.min(100, score)).toFixed(2));
  }

  private calculateOverallStrength(
    stats: MatchStats,
    formScore: number,
  ): number {
    if (stats.played === 0) {
      return 0;
    }

    const base = this.calculateStrengthScore(stats);

    return Number(
      Math.max(0, Math.min(100, base * 0.75 + formScore * 100 * 0.25)).toFixed(
        2,
      ),
    );
  }

  private getFormPoints(matches: RecentMatch[]): number {
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

  private emptyStats(): MatchStats {
    return {
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      cleanSheets: 0,
      failedToScore: 0,
    };
  }

  private isCompletedFixture(payload: unknown): boolean {
    const fixture = payload as FixtureData;

    return this.completedStatuses.has(fixture.fixture?.status?.short ?? '');
  }

  private getFixtureDate(payload: FixtureData, fallback: Date): Date {
    const value = payload.fixture?.date;

    if (!value) {
      return fallback;
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? fallback : date;
  }

  private daysBetween(from: Date, to: Date): number {
    return Math.max(
      0,
      Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)),
    );
  }

  private toNumber(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value)
      ? value
      : Number.isFinite(Number(value))
        ? Number(value)
        : 0;
  }

  private toNullableNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }
}
