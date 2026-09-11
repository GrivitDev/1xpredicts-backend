import { Injectable, Logger } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { EspnService } from '../providers/espn.service';
import { FootballDataService } from '../providers/football-data.service';
import { TheOddsApiService } from '../providers/the-odds-api.service';

import {
  EspnLeague,
  EspnLeagueDocument,
} from '../schemas/espn/espn-league.schema';

import {
  EspnFixture,
  EspnFixtureDocument,
} from '../schemas/espn/espn-fixture.schema';

import {
  EspnStanding,
  EspnStandingDocument,
} from '../schemas/espn/espn-standing.schema';

import { EspnTeam, EspnTeamDocument } from '../schemas/espn/espn-team.schema';

import {
  EspnMatchEvent,
  EspnMatchEventDocument,
} from '../schemas/espn/espn-match-event.schema';

import {
  EspnMatchStatistics,
  EspnMatchStatisticsDocument,
} from '../schemas/espn/espn-match-statistics.schema';

import { EspnOdds, EspnOddsDocument } from '../schemas/espn/espn-odds.schema';

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

import {
  FootballDataCompetition as FootballDataCompetitionPayload,
  FootballDataMatch as FootballDataMatchPayload,
  FootballDataStandingTable,
  FootballDataTeam as FootballDataTeamPayload,
} from '../providers/football-data.interfaces';

import {
  OddsApiSport as OddsApiSportPayload,
  OddsApiEventOdds,
} from '../providers/the-odds-api.interfaces';

@Injectable()
export class SportsCollectionService {
  private readonly logger = new Logger(SportsCollectionService.name);

  private readonly STARTUP_FIXTURE_FORWARD_DAYS = 4;

  private readonly LEAGUE_REFRESH_PAST_DAYS = 1;

  private readonly LEAGUE_REFRESH_FORWARD_DAYS = 6;

  constructor(
    private readonly espnService: EspnService,

    private readonly footballDataService: FootballDataService,

    private readonly oddsApiService: TheOddsApiService,

    // ----------------------------------------------------------
    // ESPN
    // ----------------------------------------------------------

    @InjectModel(EspnLeague.name)
    private readonly espnLeagueModel: Model<EspnLeagueDocument>,

    @InjectModel(EspnFixture.name)
    private readonly espnFixtureModel: Model<EspnFixtureDocument>,

    @InjectModel(EspnStanding.name)
    private readonly espnStandingModel: Model<EspnStandingDocument>,

    @InjectModel(EspnTeam.name)
    private readonly espnTeamModel: Model<EspnTeamDocument>,

    @InjectModel(EspnMatchEvent.name)
    private readonly espnMatchEventModel: Model<EspnMatchEventDocument>,

    @InjectModel(EspnMatchStatistics.name)
    private readonly espnMatchStatisticsModel: Model<EspnMatchStatisticsDocument>,

    @InjectModel(EspnOdds.name)
    private readonly espnOddsModel: Model<EspnOddsDocument>,

    // ----------------------------------------------------------
    // Football-Data
    // ----------------------------------------------------------

    @InjectModel(FootballDataCompetition.name)
    private readonly footballDataCompetitionModel: Model<FootballDataCompetitionDocument>,

    @InjectModel(FootballDataMatch.name)
    private readonly footballDataMatchModel: Model<FootballDataMatchDocument>,

    @InjectModel(FootballDataStanding.name)
    private readonly footballDataStandingModel: Model<FootballDataStandingDocument>,

    @InjectModel(FootballDataTeam.name)
    private readonly footballDataTeamModel: Model<FootballDataTeamDocument>,

    // ----------------------------------------------------------
    // Odds API
    // ----------------------------------------------------------

    @InjectModel(OddsApiSport.name)
    private readonly oddsApiSportModel: Model<OddsApiSportDocument>,

    @InjectModel(SportsOddsSnapshot.name)
    private readonly sportsOddsSnapshotModel: Model<SportsOddsSnapshotDocument>,
  ) {}

  // ============================================================
  // ESPN — STARTUP SEASON FIXTURE COLLECTION
  // ============================================================

  /**
   * Collect fixtures for the complete currently active season
   * of one ESPN league.
   *
   * Range:
   *
   * season start date
   *        ->
   * today + 4 days
   *
   * This is intended for startup / full season bootstrap.
   */
  async collectEspnSeasonFixtures(params: {
    leagueId: string;
    season?: number;
    seasonStartDate?: Date;
  }): Promise<{
    fixtureIds: string[];
    collected: number;
    dateFrom?: string;
    dateTo: string;
  }> {
    const now = new Date();

    const dateFrom = this.toUtcDateOnly(params.seasonStartDate ?? now);

    const dateToDate = new Date(
      now.getTime() + this.STARTUP_FIXTURE_FORWARD_DAYS * 24 * 60 * 60 * 1000,
    );

    const dateTo = this.toUtcDateOnly(dateToDate);

    const response = await this.espnService.getFixtures(
      params.leagueId,
      dateFrom,
      dateTo,
    );

    const result = await this.collectEspnFixtures(params.leagueId, response);

    this.logger.log(
      `ESPN startup fixtures collected for ${params.leagueId}: ` +
        `${result.collected} fixtures (${dateFrom} -> ${dateTo})`,
    );

    return {
      fixtureIds: result.fixtureIds,
      collected: result.collected,
      dateFrom,
      dateTo,
    };
  }

  // ============================================================
  // ESPN — LEAGUE REFRESH
  // ============================================================

  /**
   * Refresh a league's recent and upcoming fixture window.
   *
   * Range:
   *
   * yesterday
   *     ->
   * today + 6 days
   *
   * This keeps the local fixture database continuously aligned
   * with ESPN without repeatedly downloading the entire season.
   */
  async processEspnLeagueRefresh(params: {
    leagueId: string;
    season?: number;
  }): Promise<{
    fixtureIds: string[];
    collected: number;
    standings: number;
    leadersCollected: boolean;
    dateFrom: string;
    dateTo: string;
  }> {
    const now = new Date();

    const dateFromDate = new Date(
      now.getTime() - this.LEAGUE_REFRESH_PAST_DAYS * 24 * 60 * 60 * 1000,
    );

    const dateToDate = new Date(
      now.getTime() + this.LEAGUE_REFRESH_FORWARD_DAYS * 24 * 60 * 60 * 1000,
    );

    const dateFrom = this.toUtcDateOnly(dateFromDate);
    const dateTo = this.toUtcDateOnly(dateToDate);

    const scoreboard = await this.espnService.getFixtures(
      params.leagueId,
      dateFrom,
      dateTo,
    );

    const fixtureResult = await this.collectEspnFixtures(
      params.leagueId,
      scoreboard,
    );

    const standingsResponse = await this.espnService.getStandings(
      params.leagueId,
    );

    const standings = await this.collectEspnStandings(
      params.leagueId,
      standingsResponse,
      params.season ?? this.getSeasonFromFixtures(scoreboard),
    );

    const leadersResponse = await this.espnService.getLeaders(params.leagueId);

    const leadersCollected = await this.collectEspnLeaders(
      params.leagueId,
      leadersResponse,
      params.season ?? this.getSeasonFromFixtures(scoreboard),
    );

    return {
      fixtureIds: fixtureResult.fixtureIds,
      collected: fixtureResult.collected,
      standings,
      leadersCollected,
      dateFrom,
      dateTo,
    };
  }

  // ============================================================
  // ESPN — FIXTURES / SCOREBOARD
  // ============================================================

  async collectEspnFixtures(
    leagueId: string,
    response: unknown,
  ): Promise<{
    fixtureIds: string[];
    collected: number;
  }> {
    const events = this.extractArray(response, ['events', 'items']);

    const fixtureIds: string[] = [];

    for (const event of events) {
      if (!event || typeof event !== 'object') {
        continue;
      }

      const eventId = this.toStringValue(event.id);

      const fixtureDate = this.parseDate(event.date);

      if (!eventId || !fixtureDate) {
        continue;
      }

      const competition = event?.competitions?.[0];

      const competitors = competition?.competitors ?? [];

      const home =
        competitors.find(
          (item: any) => item?.homeAway === 'home' || item?.isHome === true,
        ) ?? competitors[0];

      const away =
        competitors.find(
          (item: any) => item?.homeAway === 'away' || item?.isAway === true,
        ) ?? competitors[1];

      const season =
        this.toNumber(event?.season?.year) ??
        this.toNumber(competition?.season?.year) ??
        fixtureDate.getUTCFullYear();

      const status = this.extractStatus(event);

      const completed = this.isCompleted(event);

      const payload = event as Record<string, unknown>;

      await this.espnFixtureModel
        .updateOne(
          {
            eventId,
          },
          {
            $set: {
              eventId,
              leagueId,
              season,
              fixtureDate,
              status,

              statusDetail: this.getNestedString(competition, [
                'status',
                'type',
                'description',
              ]),

              statusShortDetail: this.getNestedString(competition, [
                'status',
                'type',
                'shortDetail',
              ]),

              period: this.toNumber(competition?.status?.period),

              completed,

              homeTeamId: this.getTeamId(home),

              awayTeamId: this.getTeamId(away),

              homeScore: this.toNumber(home?.score),

              awayScore: this.toNumber(away?.score),

              venueId: this.toStringValue(competition?.venue?.id),

              venueName:
                this.getNestedString(competition, ['venue', 'fullName']) ??
                this.getNestedString(competition, ['venue', 'name']),

              payload,

              collectedAt: new Date(),
            },
          },
          {
            upsert: true,
          },
        )
        .exec();

      await this.collectEspnTeams(leagueId, competitors);

      fixtureIds.push(eventId);
    }

    return {
      fixtureIds,
      collected: fixtureIds.length,
    };
  }

  // ============================================================
  // ESPN — TEAMS FROM SCOREBOARD
  // ============================================================

  async collectEspnTeams(
    leagueId: string,
    competitors: unknown[],
  ): Promise<number> {
    let collected = 0;

    for (const competitor of competitors) {
      const team = (competitor as any)?.team;

      const teamId = this.toStringValue(team?.id ?? (competitor as any)?.id);

      if (!teamId) {
        continue;
      }

      await this.espnTeamModel
        .updateOne(
          {
            teamId,
            leagueId,
          },
          {
            $set: {
              teamId,
              leagueId,

              name: team?.name ?? team?.displayName ?? `Team ${teamId}`,

              displayName: team?.displayName ?? team?.name ?? `Team ${teamId}`,

              shortDisplayName:
                team?.shortDisplayName ?? team?.name ?? `Team ${teamId}`,

              abbreviation: team?.abbreviation,

              location: team?.location,

              logo: this.getTeamLogo(team),

              colors: team?.color ?? team?.colors,

              active: team?.isActive ?? true,

              payload: team ?? competitor,

              collectedAt: new Date(),
            },
          },
          {
            upsert: true,
          },
        )
        .exec();

      collected += 1;
    }

    return collected;
  }

  // ============================================================
  // ESPN — STANDINGS
  // ============================================================

  async collectEspnStandings(
    leagueId: string,
    response: unknown,
    season?: number,
  ): Promise<number> {
    const entries = this.extractStandingEntries(response);

    if (!entries.length) {
      return 0;
    }

    const resolvedSeason =
      season ??
      this.toNumber((response as any)?.season?.year) ??
      new Date().getUTCFullYear();

    const activeTeamIds = new Set<string>();

    let collected = 0;

    for (const entry of entries) {
      const teamId = this.toStringValue(entry?.team?.id ?? entry?.teamId);

      if (!teamId) {
        continue;
      }

      activeTeamIds.add(teamId);

      const statistics = Array.isArray(entry?.stats) ? entry.stats : [];

      const value = (name: string): number | undefined =>
        this.getStatisticNumber(statistics, name);

      const form = this.getStatisticDisplayValue(statistics, ['form']);

      await this.espnStandingModel
        .updateOne(
          {
            leagueId,
            season: resolvedSeason,
            teamId,
          },
          {
            $set: {
              leagueId,
              season: resolvedSeason,
              teamId,

              rank: this.toNumber(entry?.rank ?? entry?.position) ?? 0,

              points: value('points'),

              played: value('gamesPlayed') ?? value('played'),

              wins: value('wins'),

              draws: value('ties') ?? value('draws'),

              losses: value('losses'),

              goalsFor: value('pointsFor') ?? value('goalsFor'),

              goalsAgainst: value('pointsAgainst') ?? value('goalsAgainst'),

              goalDifference: value('goalDifference'),

              form,

              description: this.getStatisticDisplayValue(statistics, [
                'description',
              ]),

              payload: entry as Record<string, unknown>,

              collectedAt: new Date(),
            },
          },
          {
            upsert: true,
          },
        )
        .exec();

      collected += 1;
    }

    await this.espnStandingModel
      .deleteMany({
        leagueId,
        season: resolvedSeason,
        teamId: {
          $nin: [...activeTeamIds],
        },
      })
      .exec();

    return collected;
  }

  // ============================================================
  // ESPN — LEADERS
  // ============================================================

  async collectEspnLeaders(
    leagueId: string,
    response: unknown,
    _season?: number,
  ): Promise<boolean> {
    if (response === null || response === undefined) {
      return false;
    }

    const league = await this.espnLeagueModel
      .findOne({
        leagueId,
      })
      .exec();

    if (!league) {
      return false;
    }

    const existingPayload = league.payload ?? {};

    await this.espnLeagueModel
      .updateOne(
        {
          leagueId,
        },
        {
          $set: {
            payload: {
              ...existingPayload,

              leaders: response,

              leadersCollectedAt: new Date(),
            },

            collectedAt: new Date(),
          },
        },
      )
      .exec();

    return true;
  }

  // ============================================================
  // ESPN — MATCH DETAILS
  // ============================================================

  async collectEspnMatchDetails(params: {
    leagueId: string;
    event: any;
    competition?: any | null;
  }): Promise<void> {
    const event = params.event;

    const competition = params.competition ?? event?.competitions?.[0];

    const eventId = this.toStringValue(event?.id);

    const fixtureDate = this.parseDate(
      event?.date ?? competition?.date ?? competition?.startDate,
    );

    if (!eventId || !fixtureDate) {
      throw new Error('Invalid ESPN match payload');
    }

    const competitors =
      competition?.competitors ?? event?.competitions?.[0]?.competitors ?? [];

    const home =
      competitors.find(
        (item: any) => item?.homeAway === 'home' || item?.isHome === true,
      ) ?? competitors[0];

    const away =
      competitors.find(
        (item: any) => item?.homeAway === 'away' || item?.isAway === true,
      ) ?? competitors[1];

    const season =
      this.toNumber(event?.season?.year) ??
      this.toNumber(competition?.season?.year) ??
      fixtureDate.getUTCFullYear();

    const status = this.extractStatus(event);

    const completed = this.isCompleted(event);

    await this.espnFixtureModel
      .updateOne(
        {
          eventId,
        },
        {
          $set: {
            eventId,

            leagueId: params.leagueId,

            season,

            fixtureDate,

            status,

            statusDetail: this.getNestedString(competition, [
              'status',
              'type',
              'description',
            ]),

            statusShortDetail: this.getNestedString(competition, [
              'status',
              'type',
              'shortDetail',
            ]),

            period: this.toNumber(competition?.status?.period),

            completed,

            homeTeamId: this.getTeamId(home),

            awayTeamId: this.getTeamId(away),

            homeScore: this.toNumber(home?.score),

            awayScore: this.toNumber(away?.score),

            venueId: this.toStringValue(competition?.venue?.id),

            venueName: competition?.venue?.fullName ?? competition?.venue?.name,

            payload: {
              event,
              competition,
            },

            collectedAt: new Date(),
          },
        },
        {
          upsert: true,
        },
      )
      .exec();

    await this.collectEspnTeams(params.leagueId, competitors);
  }

  // ============================================================
  // ESPN — MATCH SUMMARY
  // ============================================================

  async collectEspnMatchSummary(params: {
    leagueId: string;
    eventId: string;
    summary: unknown;
  }): Promise<void> {
    const fixture = await this.espnFixtureModel
      .findOne({
        eventId: params.eventId,
      })
      .lean()
      .exec();

    const existingPayload = fixture?.payload ?? {};

    await this.espnFixtureModel
      .updateOne(
        {
          eventId: params.eventId,
        },
        {
          $set: {
            leagueId: params.leagueId,

            payload: {
              ...existingPayload,

              summary: params.summary,

              summaryCollectedAt: new Date(),
            },

            collectedAt: new Date(),
          },
        },
      )
      .exec();
  }

  // ============================================================
  // ESPN — MATCH EVENTS
  // ============================================================

  async collectEspnMatchEvents(params: {
    leagueId: string;
    eventId: string;
    competitionId?: string;
    events: unknown;
  }): Promise<number> {
    const plays = this.extractArray(params.events, [
      'plays',
      'events',
      'items',
    ]);

    let collected = 0;

    for (let index = 0; index < plays.length; index += 1) {
      const play = plays[index];

      const playId = this.toStringValue(
        play?.id ?? play?.sequenceNumber ?? index,
      );

      if (!playId) {
        continue;
      }

      const teamId = this.toStringValue(play?.team?.id ?? play?.teamId);

      await this.espnMatchEventModel
        .updateOne(
          {
            eventId: params.eventId,
            playId,
          },
          {
            $set: {
              eventId: params.eventId,

              leagueId: params.leagueId,

              competitionId: params.competitionId,

              playId,

              clock: this.getClockValue(play),

              clockDisplay:
                this.getNestedString(play, ['clock', 'displayValue']) ??
                this.toStringValue(play?.clockDisplay),

              type:
                this.getNestedString(play, ['type', 'text']) ??
                this.getNestedString(play, ['type', 'name']),

              text: play?.text,

              teamId,

              homeScore: this.toNumber(play?.homeScore),

              awayScore: this.toNumber(play?.awayScore),

              scoringPlay: Boolean(play?.scoringPlay),

              redCard: Boolean(play?.redCard),

              yellowCard: Boolean(play?.yellowCard),

              penaltyKick: Boolean(play?.penaltyKick ?? play?.penalty),

              ownGoal: Boolean(play?.ownGoal),

              shootout: Boolean(play?.shootout),

              payload: play as Record<string, unknown>,

              collectedAt: new Date(),
            },
          },
          {
            upsert: true,
          },
        )
        .exec();

      collected += 1;
    }

    return collected;
  }

  // ============================================================
  // ESPN — MATCH STATISTICS
  // ============================================================

  async collectEspnMatchStatistics(params: {
    leagueId: string;
    eventId: string;
    competitionId?: string;
    teamId: string;
    statistics: unknown;
  }): Promise<void> {
    const rows = this.extractStatisticsRows(params.statistics);

    const statistics =
      rows.find(
        (row: any) =>
          this.toStringValue(row?.team?.id ?? row?.teamId) === params.teamId,
      ) ?? rows[0];

    const statsList = Array.isArray(statistics?.statistics)
      ? statistics.statistics
      : Array.isArray(statistics?.stats)
        ? statistics.stats
        : [];

    const value = (names: string[]): number | undefined =>
      this.getStatisticNumber(statsList, ...names);

    await this.espnMatchStatisticsModel
      .updateOne(
        {
          eventId: params.eventId,
          teamId: params.teamId,
        },
        {
          $set: {
            eventId: params.eventId,

            leagueId: params.leagueId,

            competitionId: params.competitionId,

            teamId: params.teamId,

            possession: value(['possession', 'possessionPct']),

            shots: value(['shots', 'totalShots']),

            shotsOnTarget: value(['shotsOnTarget']),

            corners: value(['corners', 'cornerKicks']),

            fouls: value(['fouls', 'foulsCommitted']),

            offsides: value(['offsides']),

            yellow: value(['yellowCards', 'yellow']),

            red: value(['redCards', 'red']),

            saves: value(['saves']),

            payload: statistics ?? params.statistics,

            collectedAt: new Date(),
          },
        },
        {
          upsert: true,
        },
      )
      .exec();
  }

  // ============================================================
  // ESPN — ODDS
  // ============================================================

  async collectEspnMatchOdds(params: {
    leagueId: string;
    eventId: string;
    competitionId?: string;
    odds: unknown;
  }): Promise<number> {
    const odds = this.extractArray(params.odds, ['odds', 'items']);

    if (!odds.length) {
      return 0;
    }

    let collected = 0;

    for (let index = 0; index < odds.length; index += 1) {
      const item = odds[index];

      const providerId =
        this.toStringValue(item?.provider?.id ?? item?.providerId) ??
        `unknown-${index}`;

      await this.espnOddsModel
        .updateOne(
          {
            eventId: params.eventId,

            providerId,
          },
          {
            $set: {
              eventId: params.eventId,

              leagueId: params.leagueId,

              competitionId: params.competitionId,

              providerId,

              payload: item as Record<string, unknown>,

              collectedAt: new Date(),
            },
          },
          {
            upsert: true,
          },
        )
        .exec();

      collected += 1;
    }

    return collected;
  }

  // ============================================================
  // FOOTBALL-DATA — COMPETITION
  // ============================================================

  async collectFootballDataCompetition(
    competition: FootballDataCompetitionPayload,
  ): Promise<void> {
    if (typeof competition.id !== 'number' || !competition.code) {
      return;
    }

    await this.footballDataCompetitionModel
      .updateOne(
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
      )
      .exec();
  }

  // ============================================================
  // FOOTBALL-DATA — MATCHES
  // ============================================================

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

      await this.footballDataMatchModel
        .updateOne(
          {
            matchId: match.id,
          },
          {
            $set: {
              matchId: match.id,

              competitionId: match.competition.id,

              competitionCode:
                match.competition.code?.trim().toUpperCase() ?? '',

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
        )
        .exec();

      collected += 1;
    }

    return collected;
  }

  // ============================================================
  // FOOTBALL-DATA — STANDINGS
  // ============================================================

  async collectFootballDataStandings(
    standings: FootballDataStandingTable[],
    competition: FootballDataCompetitionPayload,
    seasonId: number,
  ): Promise<number> {
    if (
      typeof competition.id !== 'number' ||
      !competition.code ||
      typeof seasonId !== 'number'
    ) {
      return 0;
    }

    const competitionCode = competition.code.trim().toUpperCase();

    let collected = 0;

    for (const standing of standings) {
      for (const row of standing.table ?? []) {
        if (typeof row.team?.id !== 'number') {
          continue;
        }

        await this.footballDataStandingModel
          .updateOne(
            {
              competitionId: competition.id,

              competitionCode,

              seasonId,

              stage: standing.stage ?? 'REGULAR_SEASON',

              type: standing.type ?? 'TOTAL',

              group: standing.group ?? null,

              teamId: row.team.id,
            },
            {
              $set: {
                competitionId: competition.id,

                competitionCode,

                seasonId,

                stage: standing.stage ?? 'REGULAR_SEASON',

                type: standing.type ?? 'TOTAL',

                group: standing.group ?? null,

                teamId: row.team.id,

                payload: row as unknown as Record<string, unknown>,

                collectedAt: new Date(),
              },
            },
            {
              upsert: true,
            },
          )
          .exec();

        collected += 1;
      }
    }

    return collected;
  }

  // ============================================================
  // FOOTBALL-DATA — TEAMS
  // ============================================================

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

      await this.footballDataTeamModel
        .updateOne(
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
        )
        .exec();

      collected += 1;
    }

    return collected;
  }

  // ============================================================
  // ODDS API — SPORTS
  // ============================================================

  async collectOddsSports(sports: OddsApiSportPayload[]): Promise<number> {
    let collected = 0;

    for (const sport of sports) {
      if (!sport.key) {
        continue;
      }

      await this.oddsApiSportModel
        .updateOne(
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
        )
        .exec();

      collected += 1;
    }

    return collected;
  }

  // ============================================================
  // ODDS API — EVENT ODDS
  // ============================================================

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

      await this.sportsOddsSnapshotModel
        .updateOne(
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
        )
        .exec();

      collected += 1;
    }

    return collected;
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private extractArray(value: unknown, keys: string[] = []): any[] {
    if (Array.isArray(value)) {
      return value;
    }

    if (!value || typeof value !== 'object') {
      return [];
    }

    const object = value as Record<string, unknown>;

    for (const key of keys) {
      if (Array.isArray(object[key])) {
        return object[key];
      }
    }

    return [];
  }

  private extractStandingEntries(response: unknown): any[] {
    if (!response || typeof response !== 'object') {
      return [];
    }

    const root = response as any;

    if (Array.isArray(root.entries)) {
      return root.entries;
    }

    if (Array.isArray(root.standings)) {
      return root.standings.flatMap((group: any) =>
        Array.isArray(group?.entries) ? group.entries : [],
      );
    }

    const groups = root.groups ?? root.standings?.groups;

    if (Array.isArray(groups)) {
      return groups.flatMap((group: any) =>
        Array.isArray(group?.entries) ? group.entries : [],
      );
    }

    return [];
  }

  private extractStatisticsRows(response: unknown): any[] {
    if (Array.isArray(response)) {
      return response;
    }

    if (!response || typeof response !== 'object') {
      return [];
    }

    const object = response as any;

    if (Array.isArray(object.results)) {
      return object.results;
    }

    if (Array.isArray(object.items)) {
      return object.items;
    }

    if (Array.isArray(object.statistics)) {
      return object.statistics;
    }

    return [];
  }

  private getStatisticNumber(
    stats: any[],
    ...names: string[]
  ): number | undefined {
    for (const item of stats) {
      const name = String(
        item?.name ?? item?.type ?? item?.key ?? '',
      ).toLowerCase();

      if (names.some((candidate) => name === candidate.toLowerCase())) {
        return this.toNumber(item?.value) ?? this.toNumber(item?.displayValue);
      }
    }

    return undefined;
  }

  private getStatisticDisplayValue(
    stats: any[],
    names: string[],
  ): string | undefined {
    for (const item of stats) {
      const name = String(
        item?.name ?? item?.type ?? item?.key ?? '',
      ).toLowerCase();

      if (names.some((candidate) => name === candidate.toLowerCase())) {
        return this.toStringValue(item?.displayValue ?? item?.value);
      }
    }

    return undefined;
  }

  private getClockValue(play: any): number | undefined {
    return (
      this.toNumber(play?.clock?.value) ??
      this.toNumber(play?.clock?.minutes) ??
      this.toNumber(play?.clock)
    );
  }

  private getNestedString(value: any, path: string[]): string | undefined {
    let current = value;

    for (const key of path) {
      if (current === null || current === undefined) {
        return undefined;
      }

      current = current[key];
    }

    return this.toStringValue(current);
  }

  private getTeamId(competitor: any): string {
    return this.toStringValue(competitor?.team?.id ?? competitor?.id) ?? '';
  }

  private getTeamLogo(team: any): string | undefined {
    if (typeof team?.logo === 'string') {
      return team.logo;
    }

    if (Array.isArray(team?.logos) && typeof team.logos[0]?.href === 'string') {
      return team.logos[0].href;
    }

    return undefined;
  }

  private extractStatus(event: any): string {
    const competition = event?.competitions?.[0];

    return (
      this.getNestedString(competition, ['status', 'type', 'name']) ??
      this.getNestedString(competition, ['status', 'type', 'state']) ??
      this.getNestedString(event, ['status', 'type', 'name']) ??
      'UNKNOWN'
    );
  }

  private isCompleted(event: any): boolean {
    const competition = event?.competitions?.[0];

    const status = competition?.status ?? event?.status;

    if (status?.type?.completed === true || status?.completed === true) {
      return true;
    }

    const state = String(
      status?.type?.state ?? status?.state ?? '',
    ).toLowerCase();

    return ['post', 'final', 'completed', 'complete', 'finished'].includes(
      state,
    );
  }

  private getSeasonFromFixtures(response: unknown): number | undefined {
    const events = this.extractArray(response, ['events', 'items']);

    for (const event of events) {
      const season = this.toNumber(event?.season?.year);

      if (season !== undefined) {
        return season;
      }
    }

    return undefined;
  }

  private parseDate(value: unknown): Date | undefined {
    if (typeof value !== 'string' && !(value instanceof Date)) {
      return undefined;
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private toStringValue(value: unknown): string | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }

    const result = String(value).trim();

    return result ? result : undefined;
  }

  private toNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value !== 'string') {
      return undefined;
    }

    const cleaned = value.replace('%', '').trim();

    const result = Number(cleaned);

    return Number.isFinite(result) ? result : undefined;
  }

  /**
   * Converts a Date into the UTC calendar date
   * expected by ESPN's dates parameter.
   *
   * Result:
   *
   * YYYY-MM-DD
   */
  private toUtcDateOnly(value: Date): string {
    const date = new Date(value);

    const year = date.getUTCFullYear();

    const month = String(date.getUTCMonth() + 1).padStart(2, '0');

    const day = String(date.getUTCDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}
