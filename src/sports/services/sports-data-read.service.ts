import { Injectable } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import { SportsCacheReadService } from './sports-cache-read.service';

import { SupportedCompetitionService } from './supported-competition.service';

// ============================================================
// FOOTBALL-DATA
// ============================================================

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

// ============================================================
// API-FOOTBALL
// ============================================================

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

// ============================================================
// THE SPORTS DB
// ============================================================

import {
  TheSportsDbSeason,
  TheSportsDbSeasonDocument,
} from '../schemas/thesportsdb/thesportsdb-season.schema';

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

// ============================================================
// ODDS
// ============================================================

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

// ============================================================
// ACTIVE COMPETITION
// ============================================================

import {
  ActiveCompetition,
  ActiveCompetitionDocument,
} from '../schemas/active-competition.schema';

import { ActiveCompetitionStatus } from '../interfaces/active-competition.interface';

// ============================================================
// SERVICE
// ============================================================

@Injectable()
export class SportsDataReadService {
  constructor(
    private readonly cacheReadService: SportsCacheReadService,
    private readonly supportedCompetitionService: SupportedCompetitionService,

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

    @InjectModel(TheSportsDbSeason.name)
    private readonly theSportsDbSeasonModel: Model<TheSportsDbSeasonDocument>,

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

    // ----------------------------------------------------------
    // Active competitions
    // ----------------------------------------------------------

    @InjectModel(ActiveCompetition.name)
    private readonly activeCompetitionModel: Model<ActiveCompetitionDocument>,
  ) {}

  // ============================================================
  // FRONTEND / GENERAL READS
  // ============================================================

  async getLive(): Promise<OddsApiScoreDocument[]> {
    const cached =
      await this.cacheReadService.getLive<OddsApiScoreDocument[]>();

    if (cached !== null) {
      return cached;
    }

    return this.oddsApiScoreModel
      .find()
      .sort({
        commenceTime: 1,
      })
      .lean()
      .exec();
  }

  /**
   * Public fixture read.
   *
   * API-Football is the primary source.
   * TheSportsDB is the secondary source.
   * Football-Data is the fallback source.
   *
   * No external provider is called here.
   */
  async getFixtures(competitionId?: string): Promise<unknown[]> {
    if (!competitionId) {
      return this.getUpcomingFixturesFromStoredSources();
    }

    const competition = this.supportedCompetitionService.getById(competitionId);

    if (!competition) {
      return [];
    }

    // ============================================================
    // API-FOOTBALL — PRIMARY
    // ============================================================

    const activeCompetition = await this.activeCompetitionModel
      .findOne({
        competitionId: competition.id,
      })
      .lean()
      .exec();

    if (
      activeCompetition?.apiFootballLeagueId !== undefined &&
      activeCompetition.season !== undefined &&
      activeCompetition.season !== null
    ) {
      return this.getApiFootballFixtures(
        Number(activeCompetition.apiFootballLeagueId),
        Number(activeCompetition.season),
      );
    }

    // ============================================================
    // THE SPORTS DB — SECONDARY
    // ============================================================

    if (competition.providers.sportsDbLeagueId) {
      return this.getTheSportsDbUpcomingEvents(
        competition.providers.sportsDbLeagueId,
      );
    }

    // ============================================================
    // FOOTBALL-DATA — FALLBACK
    // ============================================================

    if (competition.providers.footballDataCode) {
      const code = competition.providers.footballDataCode.trim().toUpperCase();

      const cached =
        await this.cacheReadService.getFixtures<FootballDataMatchDocument[]>(
          code,
        );

      if (cached !== null) {
        return cached;
      }

      return this.footballDataMatchModel
        .find({
          competitionCode: code,
          status: {
            $in: ['SCHEDULED', 'TIMED'],
          },
        })
        .sort({
          utcDate: 1,
        })
        .lean()
        .exec();
    }

    return [];
  }

  /**
   * Public results read.
   *
   * API-Football is the primary source.
   * TheSportsDB is the secondary source.
   * Football-Data is the fallback source.
   */
  async getResults(competitionId?: string): Promise<unknown[]> {
    if (!competitionId) {
      return this.getRecentResultsFromStoredSources();
    }

    const competition = this.supportedCompetitionService.getById(competitionId);

    if (!competition) {
      return [];
    }

    // ============================================================
    // API-FOOTBALL — PRIMARY
    // ============================================================

    const activeCompetition = await this.activeCompetitionModel
      .findOne({
        competitionId: competition.id,
      })
      .lean()
      .exec();

    if (
      activeCompetition?.apiFootballLeagueId !== undefined &&
      activeCompetition.season !== undefined &&
      activeCompetition.season !== null
    ) {
      return this.getApiFootballFinishedFixtures(
        Number(activeCompetition.apiFootballLeagueId),
        Number(activeCompetition.season),
      );
    }

    // ============================================================
    // THE SPORTS DB — SECONDARY
    // ============================================================

    if (competition.providers.sportsDbLeagueId) {
      return this.getTheSportsDbResults(competition.providers.sportsDbLeagueId);
    }

    // ============================================================
    // FOOTBALL-DATA — FALLBACK
    // ============================================================

    if (competition.providers.footballDataCode) {
      const code = competition.providers.footballDataCode.trim().toUpperCase();

      const cached =
        await this.cacheReadService.getResults<FootballDataMatchDocument[]>(
          code,
        );

      if (cached !== null) {
        return cached;
      }

      return this.footballDataMatchModel
        .find({
          competitionCode: code,
          status: 'FINISHED',
        })
        .sort({
          utcDate: -1,
        })
        .lean()
        .exec();
    }

    return [];
  }
  /**
   * Public standings read.
   *
   * API-Football is the primary source.
   * Football-Data is the fallback source.
   *
   * TheSportsDB is not used as an artificial standings provider.
   */
  async getStandings(competitionId?: string): Promise<unknown[]> {
    if (!competitionId) {
      return [];
    }

    const competition = this.supportedCompetitionService.getById(competitionId);

    if (!competition) {
      return [];
    }

    // ============================================================
    // API-FOOTBALL — PRIMARY
    // ============================================================

    const activeCompetition = await this.activeCompetitionModel
      .findOne({
        competitionId: competition.id,
      })
      .lean()
      .exec();

    if (
      activeCompetition?.apiFootballLeagueId !== undefined &&
      activeCompetition.season !== undefined &&
      activeCompetition.season !== null
    ) {
      return this.getApiFootballStandings(
        Number(activeCompetition.apiFootballLeagueId),
        Number(activeCompetition.season),
      );
    }

    // ============================================================
    // FOOTBALL-DATA — FALLBACK
    // ============================================================

    if (competition.providers.footballDataCode) {
      const code = competition.providers.footballDataCode.trim().toUpperCase();

      const cached =
        await this.cacheReadService.getStandings<
          FootballDataStandingDocument[]
        >(code);

      if (cached !== null) {
        return cached;
      }

      return this.footballDataStandingModel
        .find({
          competitionCode: code,
        })
        .sort({
          'payload.position': 1,
        })
        .lean()
        .exec();
    }

    return [];
  }

  /**
   * Returns the application's supported competition registry.
   */
  async getCompetitions() {
    const cached =
      await this.cacheReadService.getCompetitions<
        Awaited<ReturnType<SupportedCompetitionService['getAll']>>
      >();

    if (cached !== null) {
      return cached;
    }

    return this.supportedCompetitionService.getAll();
  }

  /**
   * Public team read.
   *
   * TheSportsDB is preferred for team information because
   * API-Football does not currently have a dedicated stored
   * team collection in this module.
   *
   * Football-Data is the fallback.
   */
  async getTeams(competitionId?: string): Promise<unknown[]> {
    if (!competitionId) {
      return [];
    }

    const competition = this.supportedCompetitionService.getById(competitionId);

    if (!competition) {
      return [];
    }

    // ============================================================
    // THE SPORTS DB — PRIMARY TEAM SOURCE
    // ============================================================

    if (competition.providers.sportsDbLeagueId) {
      return this.getTheSportsDbTeams(competition.providers.sportsDbLeagueId);
    }

    // ============================================================
    // FOOTBALL-DATA — FALLBACK
    // ============================================================

    if (competition.providers.footballDataCode) {
      const code = competition.providers.footballDataCode.trim().toUpperCase();

      const cached =
        await this.cacheReadService.getTeams<FootballDataTeamDocument[]>(code);

      if (cached !== null) {
        return cached;
      }

      return this.footballDataTeamModel
        .find({
          competitionCode: code,
        })
        .sort({
          name: 1,
        })
        .lean()
        .exec();
    }

    return [];
  }

  async getActiveCompetitions(): Promise<ActiveCompetitionDocument[]> {
    const cached =
      await this.cacheReadService.getActiveCompetitions<
        ActiveCompetitionDocument[]
      >();

    if (cached !== null) {
      return cached;
    }

    return this.activeCompetitionModel
      .find({
        status: ActiveCompetitionStatus.ACTIVE,
      })
      .sort({
        priority: 1,
        name: 1,
      })
      .lean()
      .exec();
  }

  // ============================================================
  // PROVIDER-AWARE PUBLIC HELPERS
  // ============================================================

  private async getTheSportsDbUpcomingEvents(
    leagueId: number,
  ): Promise<TheSportsDbEventDocument[]> {
    const events = await this.getTheSportsDbEvents(leagueId);

    const now = Date.now();

    return events
      .filter((event) => {
        const timestamp = new Date(event.eventDate).getTime();

        return Number.isFinite(timestamp) && timestamp >= now;
      })
      .sort(
        (a, b) =>
          new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime(),
      );
  }

  private async getTheSportsDbResults(
    leagueId: number,
  ): Promise<TheSportsDbEventDocument[]> {
    const events = await this.getTheSportsDbEvents(leagueId);

    const now = Date.now();

    return events
      .filter((event) => {
        const timestamp = new Date(event.eventDate).getTime();

        return Number.isFinite(timestamp) && timestamp < now;
      })
      .sort(
        (a, b) =>
          new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime(),
      );
  }

  private async getUpcomingFixturesFromStoredSources(): Promise<unknown[]> {
    const now = new Date();

    const [footballData, apiFootball, sportsDb] = await Promise.all([
      this.footballDataMatchModel
        .find({
          status: {
            $in: ['SCHEDULED', 'TIMED'],
          },
          utcDate: {
            $gte: now,
          },
        })
        .sort({
          utcDate: 1,
        })
        .lean()
        .exec(),

      this.apiFootballFixtureModel
        .find({
          fixtureDate: {
            $gte: now,
          },
          statusShort: {
            $nin: ['FT', 'AET', 'PEN'],
          },
        })
        .sort({
          fixtureDate: 1,
        })
        .lean()
        .exec(),

      this.theSportsDbEventModel
        .find({
          eventDate: {
            $gte: now,
          },
        })
        .sort({
          eventDate: 1,
        })
        .lean()
        .exec(),
    ]);

    return [...footballData, ...apiFootball, ...sportsDb];
  }

  private async getRecentResultsFromStoredSources(): Promise<unknown[]> {
    const [footballData, apiFootball, sportsDb] = await Promise.all([
      this.footballDataMatchModel
        .find({
          status: 'FINISHED',
        })
        .sort({
          utcDate: -1,
        })
        .limit(100)
        .lean()
        .exec(),

      this.apiFootballFixtureModel
        .find({
          statusShort: {
            $in: ['FT', 'AET', 'PEN'],
          },
        })
        .sort({
          fixtureDate: -1,
        })
        .limit(100)
        .lean()
        .exec(),

      this.theSportsDbEventModel
        .find({
          eventDate: {
            $lt: new Date(),
          },
        })
        .sort({
          eventDate: -1,
        })
        .limit(100)
        .lean()
        .exec(),
    ]);

    return [...footballData, ...apiFootball, ...sportsDb];
  }

  // ============================================================
  // API-FOOTBALL INTERNAL READS
  // ============================================================

  async getApiFootballFixtures(
    leagueId: number,
    season: number,
  ): Promise<ApiFootballFixtureDocument[]> {
    const cached = await this.cacheReadService.getApiFootballFixtures<
      ApiFootballFixtureDocument[]
    >(leagueId, season);

    if (cached !== null) {
      return cached;
    }

    return this.apiFootballFixtureModel
      .find({
        leagueId,
        season,
      })
      .sort({
        fixtureDate: 1,
      })
      .lean()
      .exec();
  }

  async getApiFootballStandings(
    leagueId: number,
    season: number,
  ): Promise<ApiFootballStandingDocument[]> {
    const cached = await this.cacheReadService.getApiFootballStandings<
      ApiFootballStandingDocument[]
    >(leagueId, season);

    if (cached !== null) {
      return cached;
    }

    return this.apiFootballStandingModel
      .find({
        leagueId,
        season,
      })
      .sort({
        rank: 1,
      })
      .lean()
      .exec();
  }

  async getApiFootballTeamStatistics(
    leagueId: number,
    season: number,
    teamId: number,
  ): Promise<ApiFootballTeamStatisticsDocument | null> {
    const cached =
      await this.cacheReadService.getApiFootballTeamStatistics<ApiFootballTeamStatisticsDocument>(
        leagueId,
        season,
        teamId,
      );

    if (cached !== null) {
      return cached;
    }

    return this.apiFootballTeamStatisticsModel
      .findOne({
        leagueId,
        season,
        teamId,
      })
      .lean()
      .exec();
  }

  async getApiFootballInjuries(
    leagueId: number,
    season: number,
    teamId?: number,
  ): Promise<ApiFootballInjuryDocument[]> {
    const cached =
      teamId === undefined
        ? await this.cacheReadService.getApiFootballInjuries<
            ApiFootballInjuryDocument[]
          >(leagueId, season)
        : null;

    if (cached !== null) {
      return cached;
    }

    return this.apiFootballInjuryModel
      .find({
        leagueId,
        season,
        ...(teamId !== undefined ? { teamId } : {}),
      })
      .sort({
        teamId: 1,
      })
      .lean()
      .exec();
  }

  async getApiFootballPrediction(
    fixtureId: number,
  ): Promise<ApiFootballPredictionDocument | null> {
    const cached =
      await this.cacheReadService.getApiFootballPrediction<ApiFootballPredictionDocument>(
        fixtureId,
      );

    if (cached !== null) {
      return cached;
    }

    return this.apiFootballPredictionModel
      .findOne({
        fixtureId,
      })
      .lean()
      .exec();
  }

  // ============================================================
  // THE SPORTS DB INTERNAL READS
  // ============================================================

  async getTheSportsDbSeason(
    leagueId: number,
    season: string,
  ): Promise<TheSportsDbSeasonDocument | null> {
    const cached =
      await this.cacheReadService.getTheSportsDbSeason<TheSportsDbSeasonDocument>(
        leagueId,
        season,
      );

    if (cached !== null) {
      return cached;
    }

    return this.theSportsDbSeasonModel
      .findOne({
        leagueId,
        season,
      })
      .lean()
      .exec();
  }

  async getTheSportsDbEvents(
    leagueId: number,
  ): Promise<TheSportsDbEventDocument[]> {
    const cached =
      await this.cacheReadService.getTheSportsDbEvents<
        TheSportsDbEventDocument[]
      >(leagueId);

    if (cached !== null) {
      return cached;
    }

    return this.theSportsDbEventModel
      .find({
        leagueId,
      })
      .sort({
        eventDate: 1,
      })
      .lean()
      .exec();
  }

  async getTheSportsDbEvent(
    eventId: number,
  ): Promise<TheSportsDbEventDocument | null> {
    const cached =
      await this.cacheReadService.getTheSportsDbEvent<TheSportsDbEventDocument>(
        eventId,
      );

    if (cached !== null) {
      return cached;
    }

    return this.theSportsDbEventModel
      .findOne({
        eventId,
      })
      .lean()
      .exec();
  }

  async getTheSportsDbEventResults(
    eventId: number,
  ): Promise<TheSportsDbEventResultDocument[]> {
    return this.theSportsDbEventResultModel
      .find({
        eventId,
      })
      .lean()
      .exec();
  }

  async getTheSportsDbTimeline(
    eventId: number,
  ): Promise<TheSportsDbTimelineDocument[]> {
    const cached =
      await this.cacheReadService.getTheSportsDbTimeline<
        TheSportsDbTimelineDocument[]
      >(eventId);

    if (cached !== null) {
      return cached;
    }

    return this.theSportsDbTimelineModel
      .find({
        eventId,
      })
      .lean()
      .exec();
  }

  async getTheSportsDbLineup(
    eventId: number,
  ): Promise<TheSportsDbLineupDocument[]> {
    const cached =
      await this.cacheReadService.getTheSportsDbLineup<
        TheSportsDbLineupDocument[]
      >(eventId);

    if (cached !== null) {
      return cached;
    }

    return this.theSportsDbLineupModel
      .find({
        eventId,
      })
      .lean()
      .exec();
  }

  async getTheSportsDbStatistics(
    eventId: number,
  ): Promise<TheSportsDbStatisticsDocument | null> {
    const cached =
      await this.cacheReadService.getTheSportsDbStatistics<TheSportsDbStatisticsDocument>(
        eventId,
      );

    if (cached !== null) {
      return cached;
    }

    return this.theSportsDbStatisticsModel
      .findOne({
        eventId,
      })
      .lean()
      .exec();
  }

  async getTheSportsDbTeams(
    leagueId: number,
  ): Promise<TheSportsDbTeamDocument[]> {
    const cached =
      await this.cacheReadService.getTheSportsDbTeams<
        TheSportsDbTeamDocument[]
      >(leagueId);

    if (cached !== null) {
      return cached;
    }

    return this.theSportsDbTeamModel
      .find({
        leagueId,
      })
      .sort({
        name: 1,
      })
      .lean()
      .exec();
  }

  async getTheSportsDbPlayers(
    teamId: number,
  ): Promise<TheSportsDbPlayerDocument[]> {
    const cached =
      await this.cacheReadService.getTheSportsDbPlayers<
        TheSportsDbPlayerDocument[]
      >(teamId);

    if (cached !== null) {
      return cached;
    }

    return this.theSportsDbPlayerModel
      .find({
        teamId,
      })
      .sort({
        name: 1,
      })
      .lean()
      .exec();
  }

  async getTheSportsDbPlayerStatistics(
    playerId: number,
    teamId: number,
  ): Promise<TheSportsDbPlayerStatisticsDocument | null> {
    const cached =
      await this.cacheReadService.getTheSportsDbPlayerStatistics<TheSportsDbPlayerStatisticsDocument>(
        playerId,
        teamId,
      );

    if (cached !== null) {
      return cached;
    }

    return this.theSportsDbPlayerStatisticsModel
      .findOne({
        playerId,
        teamId,
      })
      .lean()
      .exec();
  }

  async getTheSportsDbVenue(
    venueId: number,
  ): Promise<TheSportsDbVenueDocument | null> {
    const cached =
      await this.cacheReadService.getTheSportsDbVenue<TheSportsDbVenueDocument>(
        venueId,
      );

    if (cached !== null) {
      return cached;
    }

    return this.theSportsDbVenueModel
      .findOne({
        venueId,
      })
      .lean()
      .exec();
  }

  // ============================================================
  // ODDS INTERNAL READS
  // ============================================================

  async getOddsEvents(sportKey: string): Promise<OddsApiEventDocument[]> {
    const cached =
      await this.cacheReadService.getOddsEvents<OddsApiEventDocument[]>(
        sportKey,
      );

    if (cached !== null) {
      return cached;
    }

    return this.oddsApiEventModel
      .find({
        sportKey,
      })
      .sort({
        commenceTime: 1,
      })
      .lean()
      .exec();
  }

  async getOddsScores(sportKey?: string): Promise<OddsApiScoreDocument[]> {
    if (sportKey) {
      const cached =
        await this.cacheReadService.getOddsScores<OddsApiScoreDocument[]>(
          sportKey,
        );

      if (cached !== null) {
        return cached;
      }
    }

    return this.oddsApiScoreModel
      .find(
        sportKey
          ? {
              sportKey,
            }
          : {},
      )
      .sort({
        commenceTime: 1,
      })
      .lean()
      .exec();
  }

  async getOddsSnapshots(
    eventId: string,
  ): Promise<SportsOddsSnapshotDocument[]> {
    const cached =
      await this.cacheReadService.getOdds<SportsOddsSnapshotDocument[]>(
        eventId,
      );

    if (cached !== null) {
      return cached;
    }

    return this.sportsOddsSnapshotModel
      .find({
        eventId,
      })
      .sort({
        collectedAt: -1,
      })
      .lean()
      .exec();
  }

  // ============================================================
  // COMBINED MATCH INTELLIGENCE
  // ============================================================

  async getApiFootballFixture(
    fixtureId: number,
  ): Promise<ApiFootballFixtureDocument | null> {
    return this.apiFootballFixtureModel
      .findOne({
        fixtureId,
      })
      .lean()
      .exec();
  }

  async getApiFootballFinishedFixtures(
    leagueId: number,
    season: number,
  ): Promise<ApiFootballFixtureDocument[]> {
    return this.apiFootballFixtureModel
      .find({
        leagueId,
        season,
        statusShort: {
          $in: ['FT', 'AET', 'PEN'],
        },
      })
      .sort({
        fixtureDate: -1,
      })
      .lean()
      .exec();
  }
}
