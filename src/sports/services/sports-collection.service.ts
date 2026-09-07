import { Injectable, Logger } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import { ApiFootballService } from '../providers/api-football.service';
import { FootballDataService } from '../providers/football-data.service';
import { TheOddsApiService } from '../providers/the-odds-api.service';
import { YoutubeHighlightService } from './youtube-highlight.service';

import {
  ApiFootballFixture,
  ApiFootballFixtureDocument,
} from '../schemas/api-football/api-football-fixture.schema';

import {
  ApiFootballStanding,
  ApiFootballStandingDocument,
} from '../schemas/api-football/api-football-standing.schema';

import {
  FootballDataCompetition,
  FootballDataCompetitionDocument,
} from '../schemas/football-data/football-data-competition.schema';

import {
  FootballDataMatch,
  FootballDataMatchDocument,
} from '../schemas/football-data/football-data-match.schema';

import {
  FootballDataStanding,
  FootballDataStandingDocument,
} from '../schemas/football-data/football-data-standing.schema';

import {
  FootballDataTeam,
  FootballDataTeamDocument,
} from '../schemas/football-data/football-data-team.schema';

import {
  OddsApiSport,
  OddsApiSportDocument,
} from '../schemas/odds-api-sport.schema';

import {
  SportsOddsSnapshot,
  SportsOddsSnapshotDocument,
} from '../schemas/sports-odds-snapshot.schema';

import { ApiFootballQueueJobType } from '../interfaces/api-football-queue.interface';

import {
  ApiFootballResponse,
  ApiFootballFixture as ApiFootballFixturePayload,
  ApiFootballStanding as ApiFootballStandingPayload,
  ApiFootballStandingResponse,
} from '../providers/api-football.interfaces';

import {
  FootballDataCompetition as FootballDataCompetitionPayload,
  FootballDataMatch as FootballDataMatchPayload,
  FootballDataStandingsResponse,
  FootballDataTeam as FootballDataTeamPayload,
} from '../providers/football-data.interfaces';

import {
  OddsApiSport as OddsApiSportPayload,
  OddsApiEventOdds,
} from '../providers/the-odds-api.interfaces';

@Injectable()
export class SportsCollectionService {
  private readonly logger = new Logger(SportsCollectionService.name);

  constructor(
    private readonly apiFootballService: ApiFootballService,

    private readonly footballDataService: FootballDataService,

    private readonly oddsApiService: TheOddsApiService,

    private readonly youtubeHighlightService: YoutubeHighlightService,

    @InjectModel(ApiFootballFixture.name)
    private readonly apiFootballFixtureModel: Model<ApiFootballFixtureDocument>,

    @InjectModel(ApiFootballStanding.name)
    private readonly apiFootballStandingModel: Model<ApiFootballStandingDocument>,

    @InjectModel(FootballDataCompetition.name)
    private readonly footballDataCompetitionModel: Model<FootballDataCompetitionDocument>,

    @InjectModel(FootballDataMatch.name)
    private readonly footballDataMatchModel: Model<FootballDataMatchDocument>,

    @InjectModel(FootballDataStanding.name)
    private readonly footballDataStandingModel: Model<FootballDataStandingDocument>,

    @InjectModel(FootballDataTeam.name)
    private readonly footballDataTeamModel: Model<FootballDataTeamDocument>,

    @InjectModel(OddsApiSport.name)
    private readonly oddsApiSportModel: Model<OddsApiSportDocument>,

    @InjectModel(SportsOddsSnapshot.name)
    private readonly sportsOddsSnapshotModel: Model<SportsOddsSnapshotDocument>,
  ) {}

  async processApiFootballJob(job: {
    type: ApiFootballQueueJobType;
    competitionId: string;
    leagueId: number;
    season: number;
    collectionDate: string;
  }): Promise<{
    fixtureIds: number[];
    collected: number;
  }> {
    switch (job.type) {
      case ApiFootballQueueJobType.FIXTURES:
        return this.collectApiFootballFixtures(job.leagueId, job.season);

      case ApiFootballQueueJobType.STANDINGS:
        await this.collectApiFootballStandings(job.leagueId, job.season);

        return {
          fixtureIds: [],
          collected: 0,
        };

      default:
        throw new Error(`Unsupported API-Football job type: ${job.type}`);
    }
  }

  private async collectApiFootballFixtures(
    leagueId: number,
    season: number,
  ): Promise<{
    fixtureIds: number[];
    collected: number;
  }> {
    const response = await this.apiFootballService.getFixtures(
      leagueId,
      season,
    );

    const fixtures =
      this.extractApiFootballResponse<ApiFootballFixturePayload>(response);

    const fixtureIds: number[] = [];

    for (const fixture of fixtures) {
      const fixtureId = fixture.fixture?.id;

      if (typeof fixtureId !== 'number') {
        continue;
      }

      const fixtureDate = this.parseDate(fixture.fixture?.date);

      if (!fixtureDate) {
        continue;
      }

      const home = fixture.teams?.home;
      const away = fixture.teams?.away;

      const statusShort = fixture.fixture?.status?.short ?? 'UNKNOWN';

      await this.apiFootballFixtureModel.updateOne(
        {
          fixtureId,
        },
        {
          $set: {
            fixtureId,
            leagueId,
            season,
            fixtureDate,
            statusShort,
            homeTeamId: home?.id ?? 0,
            awayTeamId: away?.id ?? 0,
            payload: fixture as unknown as Record<string, unknown>,
            collectedAt: new Date(),
          },
        },
        {
          upsert: true,
        },
      );

      fixtureIds.push(fixtureId);

      if (this.isCompletedFixture(fixture)) {
        await this.youtubeHighlightService.queueFixture(
          fixtureId,
          String(leagueId),
        );
      }
    }

    return {
      fixtureIds,
      collected: fixtureIds.length,
    };
  }

  private async collectApiFootballStandings(
    leagueId: number,
    season: number,
  ): Promise<void> {
    const response = await this.apiFootballService.getStandings(
      leagueId,
      season,
    );

    const standings = this.extractApiFootballStandings(response);

    const activeTeamIds = new Set<number>();

    for (const standing of standings) {
      const teamId = standing.team?.id;

      if (typeof teamId !== 'number') {
        continue;
      }

      activeTeamIds.add(teamId);

      await this.apiFootballStandingModel.updateOne(
        {
          leagueId,
          season,
          teamId,
        },
        {
          $set: {
            leagueId,
            season,
            teamId,
            rank: standing.rank ?? 0,
            payload: standing as unknown as Record<string, unknown>,
            collectedAt: new Date(),
          },
        },
        {
          upsert: true,
        },
      );
    }

    if (activeTeamIds.size === 0) {
      return;
    }

    await this.apiFootballStandingModel.deleteMany({
      leagueId,
      season,
      teamId: {
        $nin: [...activeTeamIds],
      },
    });
  }

  async collectFootballDataCompetition(
    competition: FootballDataCompetitionPayload,
  ): Promise<void> {
    if (typeof competition.id !== 'number' || !competition.code) {
      return;
    }

    await this.footballDataCompetitionModel.updateOne(
      {
        competitionId: competition.id,
      },
      {
        $set: {
          competitionId: competition.id,
          code: competition.code.trim().toUpperCase(),
          name: competition.name ?? '',
          type: competition.type,
          payload: competition as unknown as Record<string, unknown>,
          collectedAt: new Date(),
        },
      },
      {
        upsert: true,
      },
    );
  }

  async collectFootballDataMatches(
    matches: FootballDataMatchPayload[],
  ): Promise<number> {
    let collected = 0;

    for (const match of matches) {
      if (
        typeof match.id !== 'number' ||
        !match.utcDate ||
        typeof match.competition?.id !== 'number' ||
        typeof match.homeTeam?.id !== 'number' ||
        typeof match.awayTeam?.id !== 'number'
      ) {
        continue;
      }

      const utcDate = new Date(match.utcDate);

      if (Number.isNaN(utcDate.getTime())) {
        continue;
      }

      await this.footballDataMatchModel.updateOne(
        {
          matchId: match.id,
        },
        {
          $set: {
            matchId: match.id,

            competitionId: match.competition.id,

            competitionCode: match.competition.code?.trim().toUpperCase() ?? '',

            seasonId: match.season?.id ?? 0,

            status: match.status ?? '',

            utcDate,

            homeTeamId: match.homeTeam.id,

            awayTeamId: match.awayTeam.id,

            payload: match as unknown as Record<string, unknown>,

            collectedAt: new Date(),
          },
        },
        {
          upsert: true,
        },
      );

      collected += 1;
    }

    return collected;
  }

  async collectFootballDataStandings(
    response: FootballDataStandingsResponse,
  ): Promise<number> {
    const competition = response.competition;

    const season = response.season;

    if (
      !competition ||
      typeof competition.id !== 'number' ||
      !competition.code ||
      !season ||
      typeof season.id !== 'number'
    ) {
      return 0;
    }

    const competitionCode = competition.code.trim().toUpperCase();

    let collected = 0;

    for (const standing of response.standings ?? []) {
      const stage = standing.stage ?? 'REGULAR_SEASON';
      const type = standing.type ?? 'TOTAL';
      const group = standing.group ?? null;

      for (const row of standing.table ?? []) {
        if (typeof row.team?.id !== 'number') {
          continue;
        }

        const payload = row;

        await this.footballDataStandingModel.updateOne(
          {
            competitionId: competition.id,
            competitionCode,
            seasonId: season.id,
            stage,
            type,
            group,
            teamId: row.team.id,
          },
          {
            $set: {
              competitionId: competition.id,
              competitionCode,
              seasonId: season.id,
              stage,
              type,
              group,
              teamId: row.team.id,
              payload: payload as unknown as Record<string, unknown>,
              collectedAt: new Date(),
            },
          },
          {
            upsert: true,
          },
        );

        collected += 1;
      }
    }

    return collected;
  }

  async collectFootballDataTeams(
    teams: FootballDataTeamPayload[],
    competitionId: number,
    competitionCode: string,
  ): Promise<number> {
    let collected = 0;

    for (const team of teams) {
      if (typeof team.id !== 'number' || !team.name) {
        continue;
      }

      await this.footballDataTeamModel.updateOne(
        {
          teamId: team.id,
          competitionId,
        },
        {
          $set: {
            teamId: team.id,
            competitionId,
            competitionCode: competitionCode.trim().toUpperCase(),
            name: team.name,
            payload: team as unknown as Record<string, unknown>,
            collectedAt: new Date(),
          },
        },
        {
          upsert: true,
        },
      );

      collected += 1;
    }

    return collected;
  }

  async collectOddsSports(sports: OddsApiSportPayload[]): Promise<number> {
    let collected = 0;

    for (const sport of sports) {
      if (!sport.key) {
        continue;
      }

      await this.oddsApiSportModel.updateOne(
        {
          sportKey: sport.key,
        },
        {
          $set: {
            sportKey: sport.key,
            title: sport.title ?? sport.key,
            active: Boolean(sport.active),
            hasOutrights: Boolean(sport.has_outrights),
            payload: sport as unknown as Record<string, unknown>,
            collectedAt: new Date(),
          },
        },
        {
          upsert: true,
        },
      );

      collected += 1;
    }

    return collected;
  }

  async collectOdds(events: OddsApiEventOdds[]): Promise<number> {
    let collected = 0;

    for (const event of events) {
      if (
        !event.id ||
        !event.sport_key ||
        !event.home_team ||
        !event.away_team
      ) {
        continue;
      }

      const commenceTime = new Date(event.commence_time);

      if (Number.isNaN(commenceTime.getTime())) {
        continue;
      }

      await this.sportsOddsSnapshotModel.updateOne(
        {
          eventId: event.id,
        },
        {
          $set: {
            eventId: event.id,
            sportKey: event.sport_key,
            homeTeam: event.home_team,
            awayTeam: event.away_team,
            commenceTime,
            payload: event as unknown as Record<string, unknown>,
            collectedAt: new Date(),
          },
        },
        {
          upsert: true,
        },
      );

      collected += 1;
    }

    return collected;
  }

  private extractApiFootballResponse<T>(
    response: ApiFootballResponse<T[]>,
  ): T[] {
    if (!response || !Array.isArray(response.response)) {
      return [];
    }

    return response.response;
  }

  private extractApiFootballStandings(
    response: ApiFootballResponse<ApiFootballStandingResponse[]>,
  ): ApiFootballStandingPayload[] {
    if (!response || !Array.isArray(response.response)) {
      return [];
    }

    const groups = response.response[0]?.league?.standings;

    if (!Array.isArray(groups)) {
      return [];
    }

    return groups.flat();
  }

  private isCompletedFixture(fixture: ApiFootballFixturePayload): boolean {
    return ['FT', 'AET', 'PEN'].includes(fixture.fixture?.status?.short ?? '');
  }

  private parseDate(value?: string | null): Date | undefined {
    if (!value) {
      return undefined;
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? undefined : date;
  }
}
