import { Injectable, Logger } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import {
  EspnFixture,
  EspnFixtureDocument,
} from '../schemas/espn/espn-fixture.schema';

import {
  EspnStanding,
  EspnStandingDocument,
} from '../schemas/espn/espn-standing.schema';

import {
  ActiveCompetition,
  ActiveCompetitionDocument,
} from '../schemas/active-competition.schema';

import {
  TeamCompetitionStats,
  TeamCompetitionStatsDocument,
} from '../schemas/team-competition-stats.schema';

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

  opponentId: string;

  opponentName: string;

  home: boolean;

  goalsFor: number;

  goalsAgainst: number;

  result: 'W' | 'D' | 'L';
}

@Injectable()
export class TeamCompetitionStatsService {
  private readonly logger = new Logger(TeamCompetitionStatsService.name);

  private readonly completedStatuses = new Set([
    'FT',
    'AET',
    'PEN',
    'STATUS_FINAL',
    'FINAL',
    'FINISHED',
  ]);

  constructor(
    @InjectModel(EspnFixture.name)
    private readonly fixtureModel: Model<EspnFixtureDocument>,

    @InjectModel(EspnStanding.name)
    private readonly standingModel: Model<EspnStandingDocument>,

    @InjectModel(ActiveCompetition.name)
    private readonly activeCompetitionModel: Model<ActiveCompetitionDocument>,

    @InjectModel(TeamCompetitionStats.name)
    private readonly statsModel: Model<TeamCompetitionStatsDocument>,
  ) {}

  // ============================================================
  // REBUILD COMPETITION
  // ============================================================

  async rebuildCompetition(leagueId: string, season: number): Promise<number> {
    const competition = await this.activeCompetitionModel
      .findOne({
        competitionId: leagueId.trim().toLowerCase(),

        season,
      })
      .lean()
      .exec();

    if (!competition) {
      return 0;
    }

    const fixtures = await this.fixtureModel
      .find({
        leagueId: leagueId.trim().toLowerCase(),

        season,
      })
      .lean()
      .exec();

    const completedFixtures = fixtures.filter((fixture) =>
      this.isCompletedFixture(fixture),
    );

    const standings = await this.standingModel
      .find({
        leagueId: leagueId.trim().toLowerCase(),

        season,
      })
      .lean()
      .exec();

    const teams = new Map<string, string>();

    for (const standing of standings) {
      const teamId = standing.teamId;

      if (!teamId) {
        continue;
      }

      const name = this.extractStandingTeamName(standing, teamId);

      teams.set(teamId, name);
    }

    for (const fixture of completedFixtures) {
      if (fixture.homeTeamId) {
        teams.set(
          fixture.homeTeamId,
          this.extractFixtureTeamName(fixture, 'home'),
        );
      }

      if (fixture.awayTeamId) {
        teams.set(
          fixture.awayTeamId,
          this.extractFixtureTeamName(fixture, 'away'),
        );
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

  // ============================================================
  // REFRESH FOR FIXTURE
  // ============================================================

  async refreshForFixture(
    leagueId: string,
    season: number,
    fixtureId: string,
  ): Promise<number> {
    const competition = await this.activeCompetitionModel
      .findOne({
        competitionId: leagueId.trim().toLowerCase(),

        season,
      })
      .lean()
      .exec();

    if (!competition) {
      return 0;
    }

    const fixture = await this.fixtureModel
      .findOne({
        eventId: fixtureId.trim(),

        leagueId: leagueId.trim().toLowerCase(),

        season,
      })
      .lean()
      .exec();

    if (!fixture || !this.isCompletedFixture(fixture)) {
      return 0;
    }

    const teamIds = [fixture.homeTeamId, fixture.awayTeamId].filter(
      (id): id is string => Boolean(id),
    );

    if (teamIds.length === 0) {
      return 0;
    }

    const fixtures = await this.fixtureModel
      .find({
        leagueId: leagueId.trim().toLowerCase(),

        season,
      })
      .lean()
      .exec();

    const completedFixtures = fixtures.filter((item) =>
      this.isCompletedFixture(item),
    );

    const standings = await this.standingModel
      .find({
        leagueId: leagueId.trim().toLowerCase(),

        season,
      })
      .lean()
      .exec();

    for (const teamId of teamIds) {
      const teamName =
        teamId === fixture.homeTeamId
          ? this.extractFixtureTeamName(fixture, 'home')
          : this.extractFixtureTeamName(fixture, 'away');

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

  // ============================================================
  // REBUILD TEAM
  // ============================================================

  private async rebuildTeam(
    competitionId: string,
    leagueId: string,
    season: number,
    teamId: string,
    teamName: string,
    fixtures: EspnFixtureDocument[],
    standings: EspnStandingDocument[],
  ): Promise<void> {
    const overall = this.emptyStats();

    const home = this.emptyStats();

    const away = this.emptyStats();

    const recentMatches: RecentMatch[] = [];

    for (const fixture of fixtures) {
      const isHome = fixture.homeTeamId === teamId;

      const isAway = fixture.awayTeamId === teamId;

      if (!isHome && !isAway) {
        continue;
      }

      if (fixture.homeScore === undefined || fixture.awayScore === undefined) {
        continue;
      }

      const goalsFor = isHome ? fixture.homeScore : fixture.awayScore;

      const goalsAgainst = isHome ? fixture.awayScore : fixture.homeScore;

      const result =
        goalsFor > goalsAgainst ? 'W' : goalsFor === goalsAgainst ? 'D' : 'L';

      this.applyMatch(overall, goalsFor, goalsAgainst);

      this.applyMatch(isHome ? home : away, goalsFor, goalsAgainst);

      const opponentId = isHome ? fixture.awayTeamId : fixture.homeTeamId;

      if (!opponentId) {
        continue;
      }

      const opponentName = isHome
        ? this.extractFixtureTeamName(fixture, 'away')
        : this.extractFixtureTeamName(fixture, 'home');

      recentMatches.push({
        date: fixture.fixtureDate,

        competitionId: fixture.leagueId,

        opponentId,

        opponentName,

        home: isHome,

        goalsFor,

        goalsAgainst,

        result,
      });
    }

    recentMatches.sort((a, b) => b.date.getTime() - a.date.getTime());

    const lastFive = recentMatches.slice(0, 5);

    const standing = standings.find((item) => item.teamId === teamId);

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

    await this.statsModel
      .updateOne(
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

            averageGoalsScored: averages.goalsFor,

            averageGoalsConceded: averages.goalsAgainst,

            winRate: this.calculateSimpleRate(overall.wins, overall.played),

            drawRate: this.calculateSimpleRate(overall.draws, overall.played),

            lossRate: this.calculateSimpleRate(overall.losses, overall.played),

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

            homeAverageGoalsScored: homeAverages.goalsFor,

            homeAverageGoalsConceded: homeAverages.goalsAgainst,

            homeBttsRate: this.calculateRate(
              recentMatches.filter((match) => match.home),
              (match) => match.goalsFor > 0 && match.goalsAgainst > 0,
            ),

            homeOver25Rate: this.calculateRate(
              recentMatches.filter((match) => match.home),
              (match) => match.goalsFor + match.goalsAgainst > 2,
            ),

            homeCleanSheetRate: this.calculateSimpleRate(
              home.cleanSheets,
              home.played,
            ),

            homeFailedToScoreRate: this.calculateSimpleRate(
              home.failedToScore,
              home.played,
            ),

            awayPlayed: away.played,

            awayWins: away.wins,

            awayDraws: away.draws,

            awayLosses: away.losses,

            awayGoalsFor: away.goalsFor,

            awayGoalsAgainst: away.goalsAgainst,

            awayAverageGoalsScored: awayAverages.goalsFor,

            awayAverageGoalsConceded: awayAverages.goalsAgainst,

            awayBttsRate: this.calculateRate(
              recentMatches.filter((match) => !match.home),
              (match) => match.goalsFor > 0 && match.goalsAgainst > 0,
            ),

            awayOver25Rate: this.calculateRate(
              recentMatches.filter((match) => !match.home),
              (match) => match.goalsFor + match.goalsAgainst > 2,
            ),

            awayCleanSheetRate: this.calculateSimpleRate(
              away.cleanSheets,
              away.played,
            ),

            awayFailedToScoreRate: this.calculateSimpleRate(
              away.failedToScore,
              away.played,
            ),

            lastFive: lastFive.map(
              (match) => `${match.competitionId}:${match.result}`,
            ),

            lastFiveHome: lastFive
              .filter((match) => match.home)
              .map((match) => `${match.competitionId}:${match.result}`),

            lastFiveAway: lastFive
              .filter((match) => !match.home)
              .map((match) => `${match.competitionId}:${match.result}`),

            lastFivePoints: this.getFormPoints(lastFive),

            lastFiveGoalsScored: lastFive.reduce(
              (sum, match) => sum + match.goalsFor,
              0,
            ),

            lastFiveGoalsConceded: lastFive.reduce(
              (sum, match) => sum + match.goalsAgainst,
              0,
            ),

            lastFiveAverageGoalsScored: this.average(
              lastFive.map((match) => match.goalsFor),
            ),

            lastFiveAverageGoalsConceded: this.average(
              lastFive.map((match) => match.goalsAgainst),
            ),

            lastFiveBttsRate: this.calculateRate(
              lastFive,
              (match) => match.goalsFor > 0 && match.goalsAgainst > 0,
            ),

            lastFiveOver25Rate: this.calculateRate(
              lastFive,
              (match) => match.goalsFor + match.goalsAgainst > 2,
            ),

            lastFiveCleanSheetRate: this.calculateSimpleRate(
              lastFive.filter((match) => match.goalsAgainst === 0).length,
              lastFive.length,
            ),

            previousMatchDate: previousMatch?.date ?? null,

            daysSincePreviousMatch: previousMatch
              ? this.daysSince(previousMatch.date)
              : 0,

            nextMatchDate: nextFixture?.fixtureDate ?? null,

            daysUntilNextMatch: nextFixture
              ? this.daysUntil(nextFixture.fixtureDate)
              : 0,

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
      )
      .exec();
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
  // MATCH APPLICATION
  // ============================================================

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

  // ============================================================
  // CALCULATIONS
  // ============================================================

  private calculateAverages(stats: MatchStats): {
    goalsFor: number;
    goalsAgainst: number;
  } {
    if (stats.played === 0) {
      return {
        goalsFor: 0,
        goalsAgainst: 0,
      };
    }

    return {
      goalsFor: Number((stats.goalsFor / stats.played).toFixed(3)),

      goalsAgainst: Number((stats.goalsAgainst / stats.played).toFixed(3)),
    };
  }

  private calculateRate(
    matches: RecentMatch[],
    predicate: (match: RecentMatch) => boolean,
  ): number {
    if (matches.length === 0) {
      return 0;
    }

    return Number(
      (matches.filter(predicate).length / matches.length).toFixed(3),
    );
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
      this.calculateSimpleRate(stats.cleanSheets, stats.played) * 15 -
      this.calculateSimpleRate(stats.failedToScore, stats.played) * 10;

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

  // ============================================================
  // ESPN DATA HELPERS
  // ============================================================

  private isCompletedFixture(fixture: EspnFixtureDocument): boolean {
    if (fixture.completed === true) {
      return true;
    }

    return this.completedStatuses.has(fixture.status.trim().toUpperCase());
  }

  private extractFixtureTeamName(
    fixture: EspnFixtureDocument,
    side: 'home' | 'away',
  ): string {
    const competitors = (
      fixture.payload['competitions'] as
        | Array<Record<string, unknown>>
        | undefined
    )?.[0]?.['competitors'];

    if (Array.isArray(competitors)) {
      const competitor = competitors.find(
        (item) => (item as Record<string, unknown>)?.['homeAway'] === side,
      ) as Record<string, unknown> | undefined;

      const team = competitor?.['team'] as Record<string, unknown> | undefined;

      const name =
        team?.['displayName'] ?? team?.['name'] ?? team?.['shortDisplayName'];

      if (typeof name === 'string' && name.trim()) {
        return name.trim();
      }
    }

    const teamId = side === 'home' ? fixture.homeTeamId : fixture.awayTeamId;

    return `Team ${teamId}`;
  }

  private extractStandingTeamName(
    standing: EspnStandingDocument,
    teamId: string,
  ): string {
    const team = standing.payload['team'] as
      | Record<string, unknown>
      | undefined;

    const name =
      team?.['displayName'] ?? team?.['name'] ?? team?.['shortDisplayName'];

    return typeof name === 'string' && name.trim()
      ? name.trim()
      : `Team ${teamId}`;
  }

  // ============================================================
  // DATE HELPERS
  // ============================================================

  private daysSince(date: Date): number {
    return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
  }

  private daysUntil(date: Date): number {
    return Math.max(0, Math.floor((date.getTime() - Date.now()) / 86_400_000));
  }

  private average(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }

    return Number(
      (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(
        3,
      ),
    );
  }
}
