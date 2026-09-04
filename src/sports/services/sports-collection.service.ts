import { Injectable, Logger } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import { FootballDataService } from '../providers/football-data.service';

import { ApiFootballService } from '../providers/api-football.service';

import { TheSportsDbService } from '../providers/thesportsdb.service';

import { TheOddsApiService } from '../providers/the-odds-api.service';

import { ApiFootballQueueDocument } from '../schemas/api-football-queue.schema';

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
  ApiFootballFixture,
  ApiFootballFixtureDocument,
} from '../schemas/api-football/api-football-fixture.schema';

import {
  ApiFootballStanding,
  ApiFootballStandingDocument,
} from '../schemas/api-football/api-football-standing.schema';

import {
  ApiFootballTeamStatistics,
  ApiFootballTeamStatisticsDocument,
} from '../schemas/api-football/api-football-team-statistics.schema';

import {
  ApiFootballInjury,
  ApiFootballInjuryDocument,
} from '../schemas/api-football/api-football-injury.schema';

import {
  ApiFootballPrediction,
  ApiFootballPredictionDocument,
} from '../schemas/api-football/api-football-prediction.schema';

import {
  TheSportsDbEvent,
  TheSportsDbEventDocument,
} from '../schemas/thesportsdb/thesportsdb-event.schema';

import {
  TheSportsDbEventResult,
  TheSportsDbEventResultDocument,
} from '../schemas/thesportsdb/thesportsdb-event-result.schema';

import {
  TheSportsDbTimeline,
  TheSportsDbTimelineDocument,
} from '../schemas/thesportsdb/thesportsdb-timeline.schema';

import {
  TheSportsDbLineup,
  TheSportsDbLineupDocument,
} from '../schemas/thesportsdb/thesportsdb-lineup.schema';

import {
  TheSportsDbStatistics,
  TheSportsDbStatisticsDocument,
} from '../schemas/thesportsdb/thesportsdb-statistics.schema';

import {
  TheSportsDbTeam,
  TheSportsDbTeamDocument,
} from '../schemas/thesportsdb/thesportsdb-team.schema';

import {
  TheSportsDbPlayer,
  TheSportsDbPlayerDocument,
} from '../schemas/thesportsdb/thesportsdb-player.schema';

import {
  TheSportsDbPlayerStatistics,
  TheSportsDbPlayerStatisticsDocument,
} from '../schemas/thesportsdb/thesportsdb-player-statistics.schema';

import {
  TheSportsDbVenue,
  TheSportsDbVenueDocument,
} from '../schemas/thesportsdb/thesportsdb-venue.schema';

import {
  TheSportsDbSeason,
  TheSportsDbSeasonDocument,
} from '../schemas/thesportsdb/thesportsdb-season.schema';

import {
  OddsApiSport,
  OddsApiSportDocument,
} from '../schemas/odds-api-sport.schema';

import {
  OddsApiEvent,
  OddsApiEventDocument,
} from '../schemas/odds-api-event.schema';

import {
  OddsApiScore,
  OddsApiScoreDocument,
} from '../schemas/odds-api-score.schema';

import {
  SportsOddsSnapshot,
  SportsOddsSnapshotDocument,
} from '../schemas/sports-odds-snapshot.schema';

import { ApiFootballQueueJobType } from '../interfaces/api-football-queue.interface';

import { ApiFootballQueueService } from './api-football-queue.service';

import { SportsCacheWriteService } from './sports-cache-write.service';

@Injectable()
export class SportsCollectionService {
  private readonly logger = new Logger(SportsCollectionService.name);

  constructor(
    private readonly footballDataService: FootballDataService,

    private readonly apiFootballService: ApiFootballService,

    private readonly theSportsDbService: TheSportsDbService,

    private readonly theOddsApiService: TheOddsApiService,

    private readonly apiFootballQueueService: ApiFootballQueueService,

    private readonly sportsCacheWriteService: SportsCacheWriteService,

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
    // API-Football
    // ----------------------------------------------------------

    @InjectModel(ApiFootballFixture.name)
    private readonly apiFootballFixtureModel: Model<ApiFootballFixtureDocument>,

    @InjectModel(ApiFootballStanding.name)
    private readonly apiFootballStandingModel: Model<ApiFootballStandingDocument>,

    @InjectModel(ApiFootballTeamStatistics.name)
    private readonly apiFootballTeamStatisticsModel: Model<ApiFootballTeamStatisticsDocument>,

    @InjectModel(ApiFootballInjury.name)
    private readonly apiFootballInjuryModel: Model<ApiFootballInjuryDocument>,

    @InjectModel(ApiFootballPrediction.name)
    private readonly apiFootballPredictionModel: Model<ApiFootballPredictionDocument>,

    // ----------------------------------------------------------
    // TheSportsDB
    // ----------------------------------------------------------

    @InjectModel(TheSportsDbEvent.name)
    private readonly theSportsDbEventModel: Model<TheSportsDbEventDocument>,

    @InjectModel(TheSportsDbEventResult.name)
    private readonly theSportsDbEventResultModel: Model<TheSportsDbEventResultDocument>,

    @InjectModel(TheSportsDbTimeline.name)
    private readonly theSportsDbTimelineModel: Model<TheSportsDbTimelineDocument>,

    @InjectModel(TheSportsDbLineup.name)
    private readonly theSportsDbLineupModel: Model<TheSportsDbLineupDocument>,

    @InjectModel(TheSportsDbStatistics.name)
    private readonly theSportsDbStatisticsModel: Model<TheSportsDbStatisticsDocument>,

    @InjectModel(TheSportsDbTeam.name)
    private readonly theSportsDbTeamModel: Model<TheSportsDbTeamDocument>,

    @InjectModel(TheSportsDbPlayer.name)
    private readonly theSportsDbPlayerModel: Model<TheSportsDbPlayerDocument>,

    @InjectModel(TheSportsDbPlayerStatistics.name)
    private readonly theSportsDbPlayerStatisticsModel: Model<TheSportsDbPlayerStatisticsDocument>,

    @InjectModel(TheSportsDbVenue.name)
    private readonly theSportsDbVenueModel: Model<TheSportsDbVenueDocument>,

    @InjectModel(TheSportsDbSeason.name)
    private readonly theSportsDbSeasonModel: Model<TheSportsDbSeasonDocument>,

    // ----------------------------------------------------------
    // Odds
    // ----------------------------------------------------------

    @InjectModel(OddsApiSport.name)
    private readonly oddsApiSportModel: Model<OddsApiSportDocument>,

    @InjectModel(OddsApiEvent.name)
    private readonly oddsApiEventModel: Model<OddsApiEventDocument>,

    @InjectModel(OddsApiScore.name)
    private readonly oddsApiScoreModel: Model<OddsApiScoreDocument>,

    @InjectModel(SportsOddsSnapshot.name)
    private readonly sportsOddsSnapshotModel: Model<SportsOddsSnapshotDocument>,
  ) {}

  // ============================================================
  // FOOTBALL-DATA
  // ============================================================

  async collectFootballDataCompetition(code: string): Promise<void> {
    const competitionCode = code.trim().toUpperCase();

    const collectedAt = new Date();

    /*
     * Football-Data requests are deliberately sequential.
     * The provider service also enforces the global 60-second
     * request interval, so this method never starts several
     * Football-Data requests at the same time.
     */
    const competition =
      await this.footballDataService.getCompetition(competitionCode);

    const matches = await this.footballDataService.getMatches(competitionCode);

    const standings =
      await this.footballDataService.getStandings(competitionCode);

    const teams = await this.footballDataService.getTeams(competitionCode);

    await this.footballDataCompetitionModel
      .findOneAndUpdate(
        {
          competitionId: competition.id,
        },
        {
          $set: {
            competitionId: competition.id,

            code: competition.code ?? competitionCode,

            name: competition.name,

            type: competition.type,

            payload: competition as unknown as Record<string, unknown>,

            collectedAt,
          },
        },
        {
          upsert: true,

          returnDocument: 'after',
        },
      )
      .exec();

    await this.saveFootballDataMatches(matches.matches, collectedAt);

    await this.saveFootballDataStandings(
      standings.standings,
      standings.competition.id,
      standings.season.id,
      competitionCode,
      collectedAt,
    );

    await this.saveFootballDataTeams(
      teams.teams,
      competition.id,
      competitionCode,
      collectedAt,
    );

    await this.sportsCacheWriteService.invalidateFixtures(competitionCode);

    await this.sportsCacheWriteService.invalidateResults(competitionCode);

    await this.sportsCacheWriteService.invalidateStandings(competitionCode);

    await this.sportsCacheWriteService.invalidateCompetitions();

    this.logger.log(`Football-Data collection completed: ${competitionCode}`);
  }

  private async saveFootballDataMatches(
    matches: import('../providers/football-data.interfaces').FootballDataMatch[],
    collectedAt: Date,
  ): Promise<void> {
    if (!matches.length) {
      return;
    }

    await this.footballDataMatchModel.bulkWrite(
      matches.map((match) => ({
        updateOne: {
          filter: {
            matchId: match.id,
          },

          update: {
            $set: {
              matchId: match.id,

              competitionId: match.competition.id,

              competitionCode: (match.competition.code ?? '').toUpperCase(),

              seasonId: match.season.id,

              status: match.status,

              utcDate: new Date(match.utcDate),

              homeTeamId: match.homeTeam.id,

              awayTeamId: match.awayTeam.id,

              payload: match as unknown as Record<string, unknown>,

              collectedAt,
            },
          },

          upsert: true,
        },
      })),
      {
        ordered: false,
      },
    );
  }

  private async saveFootballDataStandings(
    standings: import('../providers/football-data.interfaces').FootballDataStanding[],
    competitionId: number,
    seasonId: number,
    competitionCode: string,
    collectedAt: Date,
  ): Promise<void> {
    const operations = standings.flatMap((standing) =>
      standing.table.map((row) => {
        const filter: Record<string, unknown> = {
          competitionId,

          seasonId,

          stage: standing.stage,

          type: standing.type,

          'payload.team.id': row.team.id,
        };

        const update: Record<string, unknown> = {
          competitionId,

          competitionCode,

          seasonId,

          stage: standing.stage,

          type: standing.type,

          payload: row,

          collectedAt,
        };

        if (standing.group !== undefined && standing.group !== null) {
          filter.group = standing.group;

          update.group = standing.group;
        }

        return {
          updateOne: {
            filter,

            update: {
              $set: update,
            },

            upsert: true,
          },
        };
      }),
    );

    if (!operations.length) {
      return;
    }

    await this.footballDataStandingModel.bulkWrite(operations, {
      ordered: false,
    });
  }

  private async saveFootballDataTeams(
    teams: import('../providers/football-data.interfaces').FootballDataTeam[],
    competitionId: number,
    competitionCode: string,
    collectedAt: Date,
  ): Promise<void> {
    if (!teams.length) {
      return;
    }

    await this.footballDataTeamModel.bulkWrite(
      teams.map((team) => ({
        updateOne: {
          filter: {
            teamId: team.id,
          },

          update: {
            $set: {
              teamId: team.id,

              competitionId,

              competitionCode,

              name: team.name,

              payload: team as unknown as Record<string, unknown>,

              collectedAt,
            },
          },

          upsert: true,
        },
      })),
      {
        ordered: false,
      },
    );
  }

  // ============================================================
  // THE SPORTS DB — SEASON
  // ============================================================

  async collectTheSportsDbSeason(
    leagueId: number,
    season: string,
  ): Promise<void> {
    const response = await this.theSportsDbService.getSeasonEvents(
      leagueId,
      season,
    );

    await this.theSportsDbSeasonModel
      .findOneAndUpdate(
        {
          leagueId,

          season,
        },
        {
          $set: {
            leagueId,

            season,

            payload: response as unknown as Record<string, unknown>,

            collectedAt: new Date(),
          },
        },
        {
          upsert: true,

          returnDocument: 'after',
        },
      )
      .exec();

    await this.sportsCacheWriteService.setTheSportsDbSeason(
      leagueId,
      season,
      response,
    );
  }

  // ============================================================
  // THE SPORTS DB — EVENTS
  // ============================================================

  async collectTheSportsDbSeasonEvents(
    leagueId: number,
    season: string,
  ): Promise<void> {
    const response = await this.theSportsDbService.getSeasonEvents(
      leagueId,
      season,
    );

    const events = this.readArray(response, 'events');

    if (!events.length) {
      return;
    }

    const collectedAt = new Date();

    await this.theSportsDbEventModel.bulkWrite(
      events.map((event) => ({
        updateOne: {
          filter: {
            eventId: this.readNumber(event, 'idEvent'),
          },

          update: {
            $set: {
              eventId: this.readNumber(event, 'idEvent'),

              leagueId,

              homeTeamId: this.readNumber(event, 'idHomeTeam'),

              awayTeamId: this.readNumber(event, 'idAwayTeam'),

              eventDate: this.readDate(event, 'dateEvent'),

              status: this.readString(event, 'strStatus') ?? 'UNKNOWN',

              payload: event,

              collectedAt,
            },
          },

          upsert: true,
        },
      })),
      {
        ordered: false,
      },
    );

    await this.sportsCacheWriteService.setTheSportsDbEvents(leagueId, events);
  }

  async collectTheSportsDbEvent(eventId: number): Promise<void> {
    const response = await this.theSportsDbService.getEvent(eventId);

    const events = this.readArray(response, 'events');

    const event = events[0];

    if (!event) {
      return;
    }

    await this.theSportsDbEventModel
      .findOneAndUpdate(
        {
          eventId,
        },
        {
          $set: {
            eventId,

            leagueId: this.readNumber(event, 'idLeague'),

            homeTeamId: this.readNumber(event, 'idHomeTeam'),

            awayTeamId: this.readNumber(event, 'idAwayTeam'),

            eventDate: this.readDate(event, 'dateEvent'),

            status: this.readString(event, 'strStatus') ?? 'UNKNOWN',

            payload: event,

            collectedAt: new Date(),
          },
        },
        {
          upsert: true,

          returnDocument: 'after',
        },
      )
      .exec();

    await this.sportsCacheWriteService.setTheSportsDbEvent(eventId, event);
  }

  // ============================================================
  // THE SPORTS DB — RESULTS
  // ============================================================

  async collectTheSportsDbEventResults(eventId: number): Promise<void> {
    const response = await this.theSportsDbService.getEventResults(eventId);

    const results = this.readArray(response, 'results');

    if (!results.length) {
      return;
    }

    await this.theSportsDbEventResultModel
      .deleteMany({
        eventId,
      })
      .exec();

    await this.theSportsDbEventResultModel.insertMany(
      results.map((result, index) => ({
        eventId,

        resultId:
          this.readString(result, 'id') ??
          this.readString(result, 'idResult') ??
          String(index),

        payload: result,

        collectedAt: new Date(),
      })),
      {
        ordered: false,
      },
    );
  }

  // ============================================================
  // THE SPORTS DB — TIMELINE
  // ============================================================

  async collectTheSportsDbTimeline(eventId: number): Promise<void> {
    const response = await this.theSportsDbService.getEventTimeline(eventId);

    const timeline = this.readArray(response, 'timeline');

    if (!timeline.length) {
      return;
    }

    await this.theSportsDbTimelineModel
      .deleteMany({
        eventId,
      })
      .exec();

    await this.theSportsDbTimelineModel.insertMany(
      timeline.map((item, index) => ({
        eventId,

        timelineId: this.readString(item, 'id') ?? String(index),

        payload: item,

        collectedAt: new Date(),
      })),
      {
        ordered: false,
      },
    );
  }

  // ============================================================
  // THE SPORTS DB — LINEUP
  // ============================================================

  async collectTheSportsDbLineup(eventId: number): Promise<void> {
    const response = await this.theSportsDbService.getEventLineup(eventId);

    const lineup = this.readArray(response, 'lineup');

    if (!lineup.length) {
      return;
    }

    await this.theSportsDbLineupModel
      .deleteMany({
        eventId,
      })
      .exec();

    await this.theSportsDbLineupModel.insertMany(
      lineup.map((player) => ({
        eventId,

        playerId: this.readNumber(player, 'idPlayer'),

        teamId: this.readNumber(player, 'idTeam'),

        payload: player,

        collectedAt: new Date(),
      })),
      {
        ordered: false,
      },
    );
  }

  // ============================================================
  // THE SPORTS DB — EVENT STATISTICS
  // ============================================================

  async collectTheSportsDbStatistics(eventId: number): Promise<void> {
    const response = await this.theSportsDbService.getEventStatistics(eventId);

    const statistics = this.readArray(response, 'statistics');

    if (!statistics.length) {
      return;
    }

    await this.theSportsDbStatisticsModel
      .findOneAndUpdate(
        {
          eventId,
        },
        {
          $set: {
            eventId,

            payload: {
              statistics,
            },

            collectedAt: new Date(),
          },
        },
        {
          upsert: true,

          returnDocument: 'after',
        },
      )
      .exec();
  }

  // ============================================================
  // THE SPORTS DB — TEAMS
  // ============================================================

  async collectTheSportsDbTeams(leagueId: number): Promise<void> {
    const response = await this.theSportsDbService.getLeagueTeams(leagueId);

    const teams = this.readArray(response, 'teams');

    if (!teams.length) {
      return;
    }

    const collectedAt = new Date();

    await this.theSportsDbTeamModel.bulkWrite(
      teams.map((team) => ({
        updateOne: {
          filter: {
            teamId: this.readNumber(team, 'idTeam'),
          },

          update: {
            $set: {
              teamId: this.readNumber(team, 'idTeam'),

              leagueId,

              name: this.readString(team, 'strTeam') ?? 'Unknown Team',

              payload: team,

              collectedAt,
            },
          },

          upsert: true,
        },
      })),
      {
        ordered: false,
      },
    );

    await this.sportsCacheWriteService.setTheSportsDbTeams(leagueId, teams);
  }

  // ============================================================
  // THE SPORTS DB — TEAM
  // ============================================================

  async collectTheSportsDbTeam(
    teamId: number,
    leagueId: number,
  ): Promise<void> {
    const response = await this.theSportsDbService.getTeam(teamId);

    const teams = this.readArray(response, 'teams');

    const team = teams[0];

    if (!team) {
      return;
    }

    await this.theSportsDbTeamModel
      .findOneAndUpdate(
        {
          teamId,
        },
        {
          $set: {
            teamId,

            leagueId,

            name: this.readString(team, 'strTeam') ?? 'Unknown Team',

            payload: team,

            collectedAt: new Date(),
          },
        },
        {
          upsert: true,

          returnDocument: 'after',
        },
      )
      .exec();
  }

  // ============================================================
  // THE SPORTS DB — PLAYERS
  // ============================================================

  async collectTheSportsDbPlayers(teamId: number): Promise<void> {
    const response = await this.theSportsDbService.getTeamPlayers(teamId);

    const players = this.readArray(response, 'player');

    if (!players.length) {
      return;
    }

    const collectedAt = new Date();

    await this.theSportsDbPlayerModel.bulkWrite(
      players.map((player) => ({
        updateOne: {
          filter: {
            playerId: this.readNumber(player, 'idPlayer'),
          },

          update: {
            $set: {
              playerId: this.readNumber(player, 'idPlayer'),

              teamId,

              name: this.readString(player, 'strPlayer') ?? 'Unknown Player',

              payload: player,

              collectedAt,
            },
          },

          upsert: true,
        },
      })),
      {
        ordered: false,
      },
    );

    await this.sportsCacheWriteService.setTheSportsDbPlayers(teamId, players);
  }

  // ============================================================
  // THE SPORTS DB — PLAYER
  // ============================================================

  async collectTheSportsDbPlayer(
    playerId: number,
    teamId: number,
  ): Promise<void> {
    const response = await this.theSportsDbService.getPlayer(playerId);

    const players = this.readArray(response, 'players');

    const player = players[0];

    if (!player) {
      return;
    }

    await this.theSportsDbPlayerModel
      .findOneAndUpdate(
        {
          playerId,
        },
        {
          $set: {
            playerId,

            teamId,

            name: this.readString(player, 'strPlayer') ?? 'Unknown Player',

            payload: player,

            collectedAt: new Date(),
          },
        },
        {
          upsert: true,

          returnDocument: 'after',
        },
      )
      .exec();
  }

  // ============================================================
  // THE SPORTS DB — PLAYER STATISTICS
  // ============================================================

  async collectTheSportsDbPlayerStatistics(
    playerId: number,
    teamId: number,
  ): Promise<void> {
    const response =
      await this.theSportsDbService.getPlayerStatistics(playerId);

    const statistics = this.readArray(response, 'playerstatistics');

    if (!statistics.length) {
      return;
    }

    await this.theSportsDbPlayerStatisticsModel
      .findOneAndUpdate(
        {
          playerId,

          teamId,
        },
        {
          $set: {
            playerId,

            teamId,

            payload: {
              statistics,
            },

            collectedAt: new Date(),
          },
        },
        {
          upsert: true,

          returnDocument: 'after',
        },
      )
      .exec();

    await this.sportsCacheWriteService.setTheSportsDbPlayerStatistics(
      playerId,
      teamId,
      statistics,
    );
  }

  // ============================================================
  // THE SPORTS DB — VENUE
  // ============================================================

  async collectTheSportsDbVenue(venueId: number): Promise<void> {
    const response = await this.theSportsDbService.getVenue(venueId);

    const venues = this.readArray(response, 'venues');

    const venue = venues[0];

    if (!venue) {
      return;
    }

    await this.theSportsDbVenueModel
      .findOneAndUpdate(
        {
          venueId,
        },
        {
          $set: {
            venueId,

            name: this.readString(venue, 'strVenue') ?? 'Unknown Venue',

            payload: venue,

            collectedAt: new Date(),
          },
        },
        {
          upsert: true,

          returnDocument: 'after',
        },
      )
      .exec();

    await this.sportsCacheWriteService.setTheSportsDbVenue(venueId, venue);
  }

  // ============================================================
  // ODDS API — SPORTS
  // ============================================================

  async collectOddsSports(): Promise<void> {
    const sports = await this.theOddsApiService.getSports();

    if (!sports.length) {
      return;
    }

    const collectedAt = new Date();

    await this.oddsApiSportModel.bulkWrite(
      sports.map((sport) => ({
        updateOne: {
          filter: {
            sportKey: sport.key,
          },

          update: {
            $set: {
              sportKey: sport.key,

              title: sport.title,

              active: sport.active,

              hasOutrights: sport.has_outrights,

              payload: sport as unknown as Record<string, unknown>,

              collectedAt,
            },
          },

          upsert: true,
        },
      })),
      {
        ordered: false,
      },
    );

    await this.sportsCacheWriteService.setOddsSports(sports);
  }

  // ============================================================
  // ODDS API — EVENTS
  // ============================================================

  async collectOddsEvents(sportKey: string): Promise<void> {
    const events = await this.theOddsApiService.getEvents(sportKey);

    if (!events.length) {
      return;
    }

    const collectedAt = new Date();

    await this.oddsApiEventModel.bulkWrite(
      events.map((event) => ({
        updateOne: {
          filter: {
            eventId: event.id,
          },

          update: {
            $set: {
              eventId: event.id,

              sportKey: event.sport_key,

              homeTeam: event.home_team,

              awayTeam: event.away_team,

              commenceTime: new Date(event.commence_time),

              payload: event as unknown as Record<string, unknown>,

              collectedAt,
            },
          },

          upsert: true,
        },
      })),
      {
        ordered: false,
      },
    );

    await this.sportsCacheWriteService.setOddsEvents(sportKey, events);
  }

  // ============================================================
  // ODDS API — SCORES
  // ============================================================

  async collectOddsScores(
    sportKey: string,
    daysFrom: 1 | 2 | 3 = 1,
  ): Promise<void> {
    const scores = await this.theOddsApiService.getScores(sportKey, daysFrom);

    if (!scores.length) {
      return;
    }

    const collectedAt = new Date();

    await this.oddsApiScoreModel.bulkWrite(
      scores.map((score) => ({
        updateOne: {
          filter: {
            eventId: score.id,
          },

          update: {
            $set: {
              eventId: score.id,

              sportKey: score.sport_key,

              commenceTime: new Date(score.commence_time),

              payload: score as unknown as Record<string, unknown>,

              collectedAt,
            },
          },

          upsert: true,
        },
      })),
      {
        ordered: false,
      },
    );

    await this.sportsCacheWriteService.setOddsScores(sportKey, scores);
  }

  // ============================================================
  // ODDS API — ODDS SNAPSHOTS
  // ============================================================

  async collectOdds(
    sportKey: string,
    regions: string,
    markets: string,
  ): Promise<void> {
    const marketList = markets
      .split(',')
      .map((market) => market.trim())
      .filter(Boolean);

    const events = await this.theOddsApiService.getOdds(
      sportKey,
      regions,
      marketList,
    );

    if (!events.length) {
      return;
    }

    const collectedAt = new Date();

    const documents = events.flatMap((event) =>
      (event.bookmakers ?? []).flatMap((bookmaker) =>
        (bookmaker.markets ?? []).map((market) => ({
          eventId: event.id,

          sportKey: event.sport_key,

          homeTeam: event.home_team,

          awayTeam: event.away_team,

          commenceTime: new Date(event.commence_time),

          payload: {
            eventId: event.id,

            sportKey: event.sport_key,

            bookmaker,

            market,
          },

          collectedAt,
        })),
      ),
    );

    if (!documents.length) {
      return;
    }

    await this.sportsOddsSnapshotModel.insertMany(documents, {
      ordered: false,
    });

    for (const event of events) {
      await this.sportsCacheWriteService.setOdds(event.id, event);
    }
  }

  // ============================================================
  // API-FOOTBALL QUEUE WORKER
  // ============================================================

  async processNextApiFootballJob(): Promise<boolean> {
    const job = await this.apiFootballQueueService.getNextJob();

    if (!job) {
      return false;
    }

    try {
      switch (job.type) {
        case ApiFootballQueueJobType.FIXTURES:
          await this.collectApiFootballFixtures(job);
          break;

        case ApiFootballQueueJobType.STANDINGS:
          await this.collectApiFootballStandings(job);
          break;

        case ApiFootballQueueJobType.TEAM_STATISTICS:
          await this.collectApiFootballTeamStatistics(job);
          break;

        case ApiFootballQueueJobType.INJURIES:
          await this.collectApiFootballInjuries(job);
          break;

        case ApiFootballQueueJobType.PREDICTION:
          await this.collectApiFootballPrediction(job);
          break;

        default:
          throw new Error('Unsupported API-Football job type');
      }

      await this.apiFootballQueueService.markCompleted(String(job._id));

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      await this.apiFootballQueueService.markFailed(String(job._id), message);

      this.logger.error(`API-Football job failed: ${message}`);

      return false;
    }
  }

  // ============================================================
  // API-FOOTBALL — FIXTURES
  // ============================================================

  private async collectApiFootballFixtures(
    job: ApiFootballQueueDocument,
  ): Promise<void> {
    if (job.apiFootballLeagueId === undefined || job.season === undefined) {
      throw new Error('Fixtures job requires leagueId and season');
    }

    const fixtures = await this.apiFootballService.getFixtures(
      job.apiFootballLeagueId,
      job.season,
    );

    if (!fixtures.length) {
      return;
    }

    const validFixtures = fixtures.filter(
      (fixture) =>
        fixture.fixture?.id != null &&
        fixture.fixture?.date != null &&
        fixture.fixture?.status?.short != null &&
        fixture.league?.id != null &&
        fixture.league?.season != null &&
        fixture.teams?.home?.id != null &&
        fixture.teams?.away?.id != null,
    );

    if (!validFixtures.length) {
      return;
    }

    const collectedAt = new Date();

    const fixtureOperations = validFixtures
      .map((fixture) => {
        const fixtureId = fixture.fixture?.id;

        const fixtureDate = fixture.fixture?.date;

        const statusShort = fixture.fixture?.status?.short;

        const leagueId = fixture.league?.id;

        const season = fixture.league?.season;

        const homeTeamId = fixture.teams?.home?.id;

        const awayTeamId = fixture.teams?.away?.id;

        if (
          fixtureId == null ||
          fixtureDate == null ||
          statusShort == null ||
          leagueId == null ||
          season == null ||
          homeTeamId == null ||
          awayTeamId == null
        ) {
          return null;
        }

        return {
          updateOne: {
            filter: {
              fixtureId,
            },

            update: {
              $set: {
                fixtureId,

                leagueId,

                season: Number(season),

                fixtureDate: new Date(fixtureDate),

                statusShort,

                homeTeamId,

                awayTeamId,

                payload: fixture as unknown as Record<string, unknown>,

                collectedAt,
              },
            },

            upsert: true,
          },
        };
      })
      .filter(
        (operation): operation is NonNullable<typeof operation> =>
          operation !== null,
      );

    if (fixtureOperations.length > 0) {
      await this.apiFootballFixtureModel.bulkWrite(fixtureOperations, {
        ordered: false,
      });
    }

    await this.sportsCacheWriteService.setApiFootballFixtures(
      job.apiFootballLeagueId,
      job.season,
      validFixtures,
    );
  }

  // ============================================================
  // API-FOOTBALL — STANDINGS
  // ============================================================

  private async collectApiFootballStandings(
    job: ApiFootballQueueDocument,
  ): Promise<void> {
    if (job.apiFootballLeagueId === undefined || job.season === undefined) {
      throw new Error('Standings job requires leagueId and season');
    }

    const response = await this.apiFootballService.getStandings(
      job.apiFootballLeagueId,
      job.season,
    );

    if (!response.length) {
      return;
    }

    const groups = response.flatMap((item) => {
      if (!item.league?.standings || !Array.isArray(item.league.standings)) {
        return [];
      }

      return item.league.standings.flatMap((group) => group);
    });

    if (!groups.length) {
      return;
    }

    const collectedAt = new Date();

    const standingOperations = groups
      .map((standing) => {
        const teamId = standing.team?.id;

        const rank = standing.rank;

        if (teamId == null || rank == null) {
          return null;
        }

        return {
          updateOne: {
            filter: {
              leagueId: job.apiFootballLeagueId,

              season: job.season,

              teamId,
            },

            update: {
              $set: {
                leagueId: job.apiFootballLeagueId,

                season: job.season,

                teamId,

                rank,

                payload: standing as unknown as Record<string, unknown>,

                collectedAt,
              },
            },

            upsert: true,
          },
        };
      })
      .filter(
        (operation): operation is NonNullable<typeof operation> =>
          operation !== null,
      );

    if (standingOperations.length > 0) {
      await this.apiFootballStandingModel.bulkWrite(standingOperations, {
        ordered: false,
      });
    }

    await this.sportsCacheWriteService.setApiFootballStandings(
      job.apiFootballLeagueId,
      job.season,
      response,
    );
  }

  // ============================================================
  // API-FOOTBALL — TEAM STATISTICS
  // ============================================================

  private async collectApiFootballTeamStatistics(
    job: ApiFootballQueueDocument,
  ): Promise<void> {
    if (
      job.apiFootballLeagueId === undefined ||
      job.season === undefined ||
      job.apiFootballTeamId === undefined
    ) {
      throw new Error(
        'Team statistics job requires leagueId, season and teamId',
      );
    }

    const response = await this.apiFootballService.getTeamStatistics(
      job.apiFootballLeagueId,
      job.season,
      job.apiFootballTeamId,
    );

    if (!response) {
      throw new Error(
        `No team statistics returned for team ${job.apiFootballTeamId}`,
      );
    }

    await this.apiFootballTeamStatisticsModel
      .findOneAndUpdate(
        {
          leagueId: job.apiFootballLeagueId,

          season: job.season,

          teamId: job.apiFootballTeamId,
        },
        {
          $set: {
            leagueId: job.apiFootballLeagueId,

            season: job.season,

            teamId: job.apiFootballTeamId,

            payload: response as unknown as Record<string, unknown>,

            collectedAt: new Date(),
          },
        },
        {
          upsert: true,

          returnDocument: 'after',
        },
      )
      .exec();

    await this.sportsCacheWriteService.setApiFootballTeamStatistics(
      job.apiFootballLeagueId,
      job.season,
      job.apiFootballTeamId,
      response,
    );
  }

  // ============================================================
  // API-FOOTBALL — INJURIES
  // ============================================================

  private async collectApiFootballInjuries(
    job: ApiFootballQueueDocument,
  ): Promise<void> {
    if (job.apiFootballLeagueId === undefined || job.season === undefined) {
      throw new Error('Injury job requires leagueId and season');
    }

    const injuries = await this.apiFootballService.getInjuries(
      job.apiFootballLeagueId,
      job.season,
    );

    const validInjuries = injuries.filter(
      (injury) =>
        injury.player?.id !== undefined && injury.team?.id !== undefined,
    );

    if (!validInjuries.length) {
      return;
    }

    const collectedAt = new Date();

    await this.apiFootballInjuryModel.bulkWrite(
      validInjuries.map((injury) => ({
        updateOne: {
          filter: {
            leagueId: job.apiFootballLeagueId,

            season: job.season,

            playerId: injury.player!.id,

            teamId: injury.team!.id,
          },

          update: {
            $set: {
              leagueId: job.apiFootballLeagueId,

              season: job.season,

              playerId: injury.player!.id,

              teamId: injury.team!.id,

              payload: injury as unknown as Record<string, unknown>,

              collectedAt,
            },
          },

          upsert: true,
        },
      })),
      {
        ordered: false,
      },
    );

    await this.sportsCacheWriteService.setApiFootballInjuries(
      job.apiFootballLeagueId,
      job.season,
      validInjuries,
    );
  }

  // ============================================================
  // API-FOOTBALL — PREDICTION
  // ============================================================

  private async collectApiFootballPrediction(
    job: ApiFootballQueueDocument,
  ): Promise<void> {
    if (job.apiFootballFixtureId === undefined) {
      throw new Error('Prediction job requires fixtureId');
    }

    const prediction = await this.apiFootballService.getPrediction(
      job.apiFootballFixtureId,
    );

    if (!prediction) {
      throw new Error(
        `No prediction returned for fixture ${job.apiFootballFixtureId}`,
      );
    }

    if (
      prediction.league?.id === undefined ||
      prediction.league?.season == null
    ) {
      throw new Error(
        `Prediction ${job.apiFootballFixtureId} is missing league information`,
      );
    }

    await this.apiFootballPredictionModel
      .findOneAndUpdate(
        {
          fixtureId: job.apiFootballFixtureId,
        },

        {
          $set: {
            fixtureId: job.apiFootballFixtureId,

            leagueId: prediction.league.id,

            season: Number(prediction.league.season),

            payload: prediction as unknown as Record<string, unknown>,

            collectedAt: new Date(),
          },
        },

        {
          upsert: true,

          returnDocument: 'after',
        },
      )
      .exec();

    await this.sportsCacheWriteService.setApiFootballPrediction(
      job.apiFootballFixtureId,
      prediction,
    );
  }

  // ============================================================
  // SAFE RESPONSE HELPERS
  // ============================================================

  private readArray(
    value: unknown,
    property: string,
  ): Record<string, unknown>[] {
    if (!value || typeof value !== 'object') {
      return [];
    }

    const record = value as Record<string, unknown>;

    const result = record[property];

    if (!Array.isArray(result)) {
      return [];
    }

    return result.filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === 'object' && !Array.isArray(item),
    );
  }

  private readString(
    value: Record<string, unknown>,
    property: string,
  ): string | undefined {
    const result = value[property];

    return typeof result === 'string' ? result : undefined;
  }

  private readNumber(value: Record<string, unknown>, property: string): number {
    const result = Number(value[property]);

    return Number.isFinite(result) ? result : 0;
  }

  private readDate(value: Record<string, unknown>, property: string): Date {
    const raw = value[property];

    const date = new Date(String(raw));

    return Number.isNaN(date.getTime()) ? new Date() : date;
  }
}
