import { Injectable, Logger } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import {
  ApiFootballFixture,
  ApiFootballFixtureDocument,
} from '../schemas/api-football/api-football-fixture.schema';

import {
  ActiveCompetition,
  ActiveCompetitionDocument,
} from '../schemas/active-competition.schema';

import { HeadToHead, HeadToHeadDocument } from '../schemas/head-to-head.schema';

interface FixtureTeam {
  id?: number;
  name?: string;
}

interface FixturePayload {
  fixture?: {
    id?: number;
    date?: string;
    status?: {
      short?: string;
    };
  };

  league?: {
    id?: number;
    season?: number;
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

interface MeetingRecord {
  fixtureId: number;
  competitionId: string;
  season: number;
  date: Date;
  homeTeamId: number;
  homeTeamName: string;
  awayTeamId: number;
  awayTeamName: string;
  homeGoals: number;
  awayGoals: number;
}

@Injectable()
export class HeadToHeadService {
  private readonly logger = new Logger(HeadToHeadService.name);

  private readonly completedStatuses = new Set(['FT', 'AET', 'PEN']);

  constructor(
    @InjectModel(ApiFootballFixture.name)
    private readonly fixtureModel: Model<ApiFootballFixtureDocument>,

    @InjectModel(ActiveCompetition.name)
    private readonly activeCompetitionModel: Model<ActiveCompetitionDocument>,

    @InjectModel(HeadToHead.name)
    private readonly headToHeadModel: Model<HeadToHeadDocument>,
  ) {}

  async rebuildPair(
    teamOneId: number,
    teamTwoId: number,
  ): Promise<HeadToHeadDocument | null> {
    if (teamOneId === teamTwoId) {
      return null;
    }

    const { teamAId, teamBId, pairKey } = this.normalizePair(
      teamOneId,
      teamTwoId,
    );

    const fixtures = await this.fixtureModel
      .find({
        $or: [
          {
            'payload.teams.home.id': teamAId,
            'payload.teams.away.id': teamBId,
          },
          {
            'payload.teams.home.id': teamBId,
            'payload.teams.away.id': teamAId,
          },
        ],
      })
      .lean()
      .exec();

    const completedFixtures = fixtures.filter((fixture) =>
      this.isCompletedFixture(fixture.payload),
    );

    const competitionMap = await this.buildCompetitionMap(completedFixtures);

    const meetings: MeetingRecord[] = [];

    let teamAName = `Team ${teamAId}`;

    let teamBName = `Team ${teamBId}`;

    for (const fixture of completedFixtures) {
      const payload = fixture.payload as FixturePayload;

      const home = payload.teams?.home;

      const away = payload.teams?.away;

      if (
        !home?.id ||
        !away?.id ||
        !this.isPair(home.id, away.id, teamAId, teamBId)
      ) {
        continue;
      }

      const fixtureId = payload.fixture?.id ?? fixture.fixtureId;

      if (typeof fixtureId !== 'number') {
        continue;
      }

      const date = this.getFixtureDate(payload, fixture.fixtureDate);

      const season = this.getSeason(payload, fixture.season);

      const leagueId = payload.league?.id;

      const competitionId =
        typeof leagueId === 'number' && typeof season === 'number'
          ? (competitionMap.get(this.getCompetitionMapKey(leagueId, season)) ??
            String(leagueId))
          : 'unknown';

      const homeGoals = this.toNumber(payload.goals?.home);

      const awayGoals = this.toNumber(payload.goals?.away);

      teamAName =
        home.id === teamAId
          ? (home.name ?? teamAName)
          : (away.name ?? teamAName);

      teamBName =
        home.id === teamBId
          ? (home.name ?? teamBName)
          : (away.name ?? teamBName);

      meetings.push({
        fixtureId,
        competitionId,
        season,
        date,
        homeTeamId: home.id,
        homeTeamName: home.name ?? `Team ${home.id}`,
        awayTeamId: away.id,
        awayTeamName: away.name ?? `Team ${away.id}`,
        homeGoals,
        awayGoals,
      });
    }

    meetings.sort((a, b) => b.date.getTime() - a.date.getTime());

    if (meetings.length === 0) {
      await this.headToHeadModel.deleteOne({
        pairKey,
      });

      return null;
    }

    const stats = this.calculateStats(teamAId, teamBId, meetings);

    return this.headToHeadModel
      .findOneAndUpdate(
        {
          pairKey,
        },
        {
          $set: {
            pairKey,

            teamAId,
            teamAName,

            teamBId,
            teamBName,

            totalMatches: meetings.length,

            teamAWins: stats.teamAWins,

            draws: stats.draws,

            teamBWins: stats.teamBWins,

            teamAGoals: stats.teamAGoals,

            teamBGoals: stats.teamBGoals,

            meetings,

            calculatedAt: new Date(),
          },
        },
        {
          upsert: true,
          returnDocument: 'after',
        },
      )
      .exec();
  }

  async refreshForFixture(
    fixtureId: number,
  ): Promise<HeadToHeadDocument | null> {
    const fixture = await this.fixtureModel
      .findOne({
        fixtureId,
      })
      .lean()
      .exec();

    if (!fixture) {
      return null;
    }

    const payload = fixture.payload as FixturePayload;

    if (!this.isCompletedFixture(payload)) {
      return null;
    }

    const homeId = payload.teams?.home?.id;

    const awayId = payload.teams?.away?.id;

    if (
      typeof homeId !== 'number' ||
      typeof awayId !== 'number' ||
      homeId === awayId
    ) {
      return null;
    }

    return this.rebuildPair(homeId, awayId);
  }

  async getPair(
    teamOneId: number,
    teamTwoId: number,
  ): Promise<HeadToHeadDocument | null> {
    if (teamOneId === teamTwoId) {
      return null;
    }

    const { pairKey } = this.normalizePair(teamOneId, teamTwoId);

    return this.headToHeadModel
      .findOne({
        pairKey,
      })
      .lean()
      .exec();
  }

  async rebuildPairsForTeams(teamIds: number[]): Promise<number> {
    const uniqueTeamIds = [
      ...new Set(teamIds.filter((id) => Number.isInteger(id) && id > 0)),
    ];

    if (uniqueTeamIds.length < 2) {
      return 0;
    }

    const fixtures = await this.fixtureModel
      .find({
        $or: [
          {
            'payload.teams.home.id': {
              $in: uniqueTeamIds,
            },
          },
          {
            'payload.teams.away.id': {
              $in: uniqueTeamIds,
            },
          },
        ],
      })
      .lean()
      .exec();

    const pairs = new Set<string>();

    for (const fixture of fixtures) {
      const payload = fixture.payload as FixturePayload;

      if (!this.isCompletedFixture(payload)) {
        continue;
      }

      const homeId = payload.teams?.home?.id;

      const awayId = payload.teams?.away?.id;

      if (
        typeof homeId !== 'number' ||
        typeof awayId !== 'number' ||
        homeId === awayId ||
        !uniqueTeamIds.includes(homeId) ||
        !uniqueTeamIds.includes(awayId)
      ) {
        continue;
      }

      const { pairKey } = this.normalizePair(homeId, awayId);

      pairs.add(pairKey);
    }

    let rebuilt = 0;

    for (const pairKey of pairs) {
      const [teamAId, teamBId] = pairKey.split(':').map(Number);

      if (!Number.isInteger(teamAId) || !Number.isInteger(teamBId)) {
        continue;
      }

      const result = await this.rebuildPair(teamAId, teamBId);

      if (result) {
        rebuilt += 1;
      }
    }

    return rebuilt;
  }

  private async buildCompetitionMap(
    fixtures: ApiFootballFixtureDocument[],
  ): Promise<Map<string, string>> {
    const keys = new Set<string>();

    for (const fixture of fixtures) {
      const payload = fixture.payload as FixturePayload;

      const leagueId = payload.league?.id;

      const season = this.getSeason(payload, fixture.season);

      if (typeof leagueId === 'number' && typeof season === 'number') {
        keys.add(this.getCompetitionMapKey(leagueId, season));
      }
    }

    if (keys.size === 0) {
      return new Map();
    }

    const leagueIds = [
      ...new Set([...keys].map((key) => Number(key.split(':')[0]))),
    ];

    const seasons = [
      ...new Set([...keys].map((key) => Number(key.split(':')[1]))),
    ];

    const competitions = await this.activeCompetitionModel
      .find({
        apiFootballLeagueId: {
          $in: leagueIds,
        },

        season: {
          $in: seasons,
        },
      })
      .lean()
      .exec();

    const map = new Map<string, string>();

    for (const competition of competitions) {
      if (
        typeof competition.apiFootballLeagueId !== 'number' ||
        typeof competition.season !== 'number'
      ) {
        continue;
      }

      map.set(
        this.getCompetitionMapKey(
          competition.apiFootballLeagueId,
          competition.season,
        ),
        String(competition.competitionId),
      );
    }

    return map;
  }

  private calculateStats(
    teamAId: number,
    teamBId: number,
    meetings: MeetingRecord[],
  ): {
    teamAWins: number;
    draws: number;
    teamBWins: number;
    teamAGoals: number;
    teamBGoals: number;
  } {
    let teamAWins = 0;
    let draws = 0;
    let teamBWins = 0;

    let teamAGoals = 0;
    let teamBGoals = 0;

    for (const meeting of meetings) {
      const teamAGoalsInMatch =
        meeting.homeTeamId === teamAId ? meeting.homeGoals : meeting.awayGoals;

      const teamBGoalsInMatch =
        meeting.homeTeamId === teamBId ? meeting.homeGoals : meeting.awayGoals;

      teamAGoals += teamAGoalsInMatch;
      teamBGoals += teamBGoalsInMatch;

      if (teamAGoalsInMatch > teamBGoalsInMatch) {
        teamAWins += 1;
      } else if (teamAGoalsInMatch < teamBGoalsInMatch) {
        teamBWins += 1;
      } else {
        draws += 1;
      }
    }

    return {
      teamAWins,
      draws,
      teamBWins,
      teamAGoals,
      teamBGoals,
    };
  }

  private normalizePair(
    teamOneId: number,
    teamTwoId: number,
  ): {
    teamAId: number;
    teamBId: number;
    pairKey: string;
  } {
    const teamAId = Math.min(teamOneId, teamTwoId);

    const teamBId = Math.max(teamOneId, teamTwoId);

    return {
      teamAId,
      teamBId,
      pairKey: `${teamAId}:${teamBId}`,
    };
  }

  private isPair(
    homeId: number,
    awayId: number,
    teamAId: number,
    teamBId: number,
  ): boolean {
    return (
      (homeId === teamAId && awayId === teamBId) ||
      (homeId === teamBId && awayId === teamAId)
    );
  }

  private isCompletedFixture(payload: unknown): boolean {
    const fixturePayload = payload as FixturePayload;

    return this.completedStatuses.has(
      fixturePayload.fixture?.status?.short ?? '',
    );
  }

  private getFixtureDate(payload: FixturePayload, fallback: Date): Date {
    const value = payload.fixture?.date;

    if (!value) {
      return fallback;
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? fallback : date;
  }

  private getSeason(payload: FixturePayload, fallback: number): number {
    return typeof payload.league?.season === 'number'
      ? payload.league.season
      : fallback;
  }

  private getCompetitionMapKey(leagueId: number, season: number): string {
    return `${leagueId}:${season}`;
  }

  private toNumber(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }
}
