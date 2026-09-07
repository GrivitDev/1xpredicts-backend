import { Injectable } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import {
  ActiveCompetition,
  ActiveCompetitionDocument,
} from '../schemas/active-competition.schema';

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
  TeamCompetitionStats,
  TeamCompetitionStatsDocument,
} from '../schemas/team-competition-stats.schema';

import { HeadToHead, HeadToHeadDocument } from '../schemas/head-to-head.schema';

import {
  SportsOddsSnapshot,
  SportsOddsSnapshotDocument,
} from '../schemas/sports-odds-snapshot.schema';

import {
  YouTubeHighlight,
  YouTubeHighlightDocument,
} from '../schemas/youtube-highlight.schema';

import { SupportedCompetitionService } from './supported-competition.service';

import { ActiveCompetitionStatus } from '../interfaces/active-competition.interface';

import { YoutubeHighlightStatus } from '../interfaces/youtube-highlight.interface';

@Injectable()
export class SportsDataReadService {
  constructor(
    private readonly supportedCompetitionService: SupportedCompetitionService,

    @InjectModel(ActiveCompetition.name)
    private readonly activeCompetitionModel: Model<ActiveCompetitionDocument>,

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

    @InjectModel(TeamCompetitionStats.name)
    private readonly teamCompetitionStatsModel: Model<TeamCompetitionStatsDocument>,

    @InjectModel(HeadToHead.name)
    private readonly headToHeadModel: Model<HeadToHeadDocument>,

    @InjectModel(SportsOddsSnapshot.name)
    private readonly oddsModel: Model<SportsOddsSnapshotDocument>,

    @InjectModel(YouTubeHighlight.name)
    private readonly youtubeHighlightModel: Model<YouTubeHighlightDocument>,
  ) {}

  async getLive(): Promise<FootballDataMatchDocument[]> {
    return this.getLiveFixtures();
  }

  async getLiveFixtures(
    competitionId?: string,
  ): Promise<FootballDataMatchDocument[]> {
    const filter: Record<string, unknown> = {
      status: {
        $in: ['IN_PLAY', 'PAUSED'],
      },
    };

    if (competitionId) {
      const competition = await this.getCompetition(competitionId);

      if (!competition) {
        return [];
      }

      if (competition.footballDataCode) {
        filter.competitionCode = competition.footballDataCode
          .trim()
          .toUpperCase();
      } else if (competition.apiFootballLeagueId !== undefined) {
        return [];
      } else {
        return [];
      }
    }

    return this.footballDataMatchModel
      .find(filter)
      .sort({
        utcDate: 1,
      })
      .lean()
      .exec();
  }

  async getFixtures(competitionId?: string): Promise<unknown[]> {
    return this.getUpcomingFixtures(undefined, undefined, competitionId);
  }

  async getUpcomingFixtures(
    from?: Date,
    to?: Date,
    competitionId?: string,
  ): Promise<unknown[]> {
    const start = from ?? new Date();

    if (competitionId) {
      const competition = await this.getCompetition(competitionId);

      if (!competition) {
        return [];
      }

      if (
        typeof competition.apiFootballLeagueId === 'number' &&
        typeof competition.season === 'number'
      ) {
        const filter: Record<string, unknown> = {
          leagueId: competition.apiFootballLeagueId,
          season: competition.season,
          fixtureDate: {
            $gte: start,
          },
          'payload.fixture.status.short': {
            $nin: ['FT', 'AET', 'PEN', 'CANC', 'ABD'],
          },
        };

        if (to) {
          (filter.fixtureDate as Record<string, Date>).$lt = to;
        }

        return this.apiFootballFixtureModel
          .find(filter)
          .sort({
            fixtureDate: 1,
          })
          .lean()
          .exec();
      }

      if (competition.footballDataCode) {
        const filter: Record<string, unknown> = {
          competitionCode: competition.footballDataCode.trim().toUpperCase(),
          status: {
            $in: ['SCHEDULED', 'TIMED'],
          },
          utcDate: {
            $gte: start,
          },
        };

        if (to) {
          (filter.utcDate as Record<string, Date>).$lt = to;
        }

        return this.footballDataMatchModel
          .find(filter)
          .sort({
            utcDate: 1,
          })
          .lean()
          .exec();
      }

      return [];
    }

    const apiFootballFilter: Record<string, unknown> = {
      fixtureDate: {
        $gte: start,
      },
      'payload.fixture.status.short': {
        $nin: ['FT', 'AET', 'PEN', 'CANC', 'ABD'],
      },
    };

    if (to) {
      (apiFootballFilter.fixtureDate as Record<string, Date>).$lt = to;
    }

    const footballDataFilter: Record<string, unknown> = {
      status: {
        $in: ['SCHEDULED', 'TIMED'],
      },
      utcDate: {
        $gte: start,
      },
    };

    if (to) {
      (footballDataFilter.utcDate as Record<string, Date>).$lt = to;
    }

    const [apiFootballFixtures, footballDataMatches] = await Promise.all([
      this.apiFootballFixtureModel
        .find(apiFootballFilter)
        .sort({
          fixtureDate: 1,
        })
        .lean()
        .exec(),

      this.footballDataMatchModel
        .find(footballDataFilter)
        .sort({
          utcDate: 1,
        })
        .lean()
        .exec(),
    ]);

    return [...apiFootballFixtures, ...footballDataMatches].sort(
      (a: any, b: any) => {
        const aDate = a.fixtureDate ?? a.utcDate;
        const bDate = b.fixtureDate ?? b.utcDate;

        return new Date(aDate).getTime() - new Date(bDate).getTime();
      },
    );
  }

  async getResults(competitionId?: string): Promise<unknown[]> {
    return this.getFinishedFixtures(undefined, undefined, competitionId);
  }

  async getFinishedFixtures(
    from?: Date,
    to?: Date,
    competitionId?: string,
  ): Promise<unknown[]> {
    if (competitionId) {
      const competition = await this.getCompetition(competitionId);

      if (!competition) {
        return [];
      }

      if (
        typeof competition.apiFootballLeagueId === 'number' &&
        typeof competition.season === 'number'
      ) {
        const filter: Record<string, unknown> = {
          leagueId: competition.apiFootballLeagueId,
          season: competition.season,
          'payload.fixture.status.short': {
            $in: ['FT', 'AET', 'PEN'],
          },
        };

        if (from || to) {
          filter.fixtureDate = {};

          if (from) {
            (filter.fixtureDate as Record<string, Date>).$gte = from;
          }

          if (to) {
            (filter.fixtureDate as Record<string, Date>).$lt = to;
          }
        }

        return this.apiFootballFixtureModel
          .find(filter)
          .sort({
            fixtureDate: -1,
          })
          .lean()
          .exec();
      }

      if (competition.footballDataCode) {
        const filter: Record<string, unknown> = {
          competitionCode: competition.footballDataCode.trim().toUpperCase(),
          status: 'FINISHED',
        };

        if (from || to) {
          filter.utcDate = {};

          if (from) {
            (filter.utcDate as Record<string, Date>).$gte = from;
          }

          if (to) {
            (filter.utcDate as Record<string, Date>).$lt = to;
          }
        }

        return this.footballDataMatchModel
          .find(filter)
          .sort({
            utcDate: -1,
          })
          .lean()
          .exec();
      }

      return [];
    }

    const apiFootballFilter: Record<string, unknown> = {
      'payload.fixture.status.short': {
        $in: ['FT', 'AET', 'PEN'],
      },
    };

    if (from || to) {
      apiFootballFilter.fixtureDate = {};

      if (from) {
        (apiFootballFilter.fixtureDate as Record<string, Date>).$gte = from;
      }

      if (to) {
        (apiFootballFilter.fixtureDate as Record<string, Date>).$lt = to;
      }
    }

    const footballDataFilter: Record<string, unknown> = {
      status: 'FINISHED',
    };

    if (from || to) {
      footballDataFilter.utcDate = {};

      if (from) {
        (footballDataFilter.utcDate as Record<string, Date>).$gte = from;
      }

      if (to) {
        (footballDataFilter.utcDate as Record<string, Date>).$lt = to;
      }
    }

    const [apiFootballFixtures, footballDataMatches] = await Promise.all([
      this.apiFootballFixtureModel
        .find(apiFootballFilter)
        .sort({
          fixtureDate: -1,
        })
        .limit(200)
        .lean()
        .exec(),

      this.footballDataMatchModel
        .find(footballDataFilter)
        .sort({
          utcDate: -1,
        })
        .limit(200)
        .lean()
        .exec(),
    ]);

    return [...apiFootballFixtures, ...footballDataMatches].sort(
      (a: any, b: any) => {
        const aDate = a.fixtureDate ?? a.utcDate;
        const bDate = b.fixtureDate ?? b.utcDate;

        return new Date(bDate).getTime() - new Date(aDate).getTime();
      },
    );
  }

  async getStandings(competitionId: string): Promise<unknown[]> {
    return this.getLeagueTable(competitionId);
  }

  async getLeagueTable(
    competitionId: string,
    season?: number,
  ): Promise<unknown[]> {
    const competition = await this.getCompetition(competitionId, season);

    if (!competition) {
      return [];
    }

    if (
      typeof competition.apiFootballLeagueId === 'number' &&
      typeof competition.season === 'number'
    ) {
      return this.apiFootballStandingModel
        .find({
          leagueId: competition.apiFootballLeagueId,
          season: competition.season,
        })
        .sort({
          rank: 1,
        })
        .lean()
        .exec();
    }

    if (competition.footballDataCode) {
      const filter: Record<string, unknown> = {
        competitionCode: competition.footballDataCode.trim().toUpperCase(),
      };

      if (typeof season === 'number') {
        filter.seasonId = season;
      }

      return this.footballDataStandingModel
        .find(filter)
        .sort({
          'payload.position': 1,
        })
        .lean()
        .exec();
    }

    return [];
  }

  async getCompetitions(
    options: {
      activeOnly?: boolean;
      predictionEnabled?: boolean;
    } = {},
  ) {
    let competitions = this.supportedCompetitionService.getAll();

    if (options.activeOnly) {
      const activeCompetitions = await this.getActiveCompetitions();

      const activeIds = new Set(
        activeCompetitions.map((competition) =>
          competition.competitionId.trim().toLowerCase(),
        ),
      );

      competitions = competitions.filter((competition) =>
        activeIds.has(competition.id.trim().toLowerCase()),
      );
    }

    if (options.predictionEnabled) {
      competitions = competitions.filter(
        (competition) => competition.predictionEnabled,
      );
    }

    return competitions;
  }

  async getTeams(competitionId: string): Promise<FootballDataTeamDocument[]> {
    const competition = this.supportedCompetitionService.getById(competitionId);

    if (!competition?.providers.footballDataCode) {
      return [];
    }

    return this.footballDataTeamModel
      .find({
        competitionCode: competition.providers.footballDataCode
          .trim()
          .toUpperCase(),
      })
      .sort({
        name: 1,
      })
      .lean()
      .exec();
  }

  async getActiveCompetitions(): Promise<ActiveCompetitionDocument[]> {
    return this.activeCompetitionModel
      .find({
        status: {
          $in: [
            ActiveCompetitionStatus.UPCOMING,
            ActiveCompetitionStatus.ACTIVE,
          ],
        },
      })
      .sort({
        priority: 1,
        name: 1,
      })
      .lean()
      .exec();
  }

  async getCompetition(
    competitionId: string,
    season?: number,
  ): Promise<ActiveCompetitionDocument | null> {
    const filter: Record<string, unknown> = {
      competitionId: competitionId.trim().toLowerCase(),
    };

    if (typeof season === 'number') {
      filter.season = season;
    }

    return this.activeCompetitionModel.findOne(filter).lean().exec();
  }

  async getTeamCompetitionStats(
    competitionId: string,
    season: number,
  ): Promise<TeamCompetitionStatsDocument[]> {
    return this.teamCompetitionStatsModel
      .find({
        competitionId: competitionId.trim().toLowerCase(),
        season,
      })
      .sort({
        position: 1,
        teamName: 1,
      })
      .lean()
      .exec();
  }

  async getTeamStats(
    competitionId: string,
    season: number,
    teamId: number,
  ): Promise<TeamCompetitionStatsDocument | null> {
    return this.teamCompetitionStatsModel
      .findOne({
        competitionId: competitionId.trim().toLowerCase(),
        season,
        teamId,
      })
      .lean()
      .exec();
  }

  async getHeadToHead(
    teamOneId: number,
    teamTwoId: number,
  ): Promise<HeadToHeadDocument | null> {
    if (teamOneId === teamTwoId) {
      return null;
    }

    const teamAId = Math.min(teamOneId, teamTwoId);
    const teamBId = Math.max(teamOneId, teamTwoId);

    return this.headToHeadModel
      .findOne({
        pairKey: `${teamAId}:${teamBId}`,
      })
      .lean()
      .exec();
  }

  async getOddsForEvent(
    eventId: string,
  ): Promise<SportsOddsSnapshotDocument | null> {
    return this.oddsModel
      .findOne({
        eventId,
      })
      .lean()
      .exec();
  }

  async getOddsForEvents(
    eventIds: string[],
  ): Promise<SportsOddsSnapshotDocument[]> {
    const ids = [...new Set(eventIds.filter(Boolean))];

    if (ids.length === 0) {
      return [];
    }

    return this.oddsModel
      .find({
        eventId: {
          $in: ids,
        },
      })
      .lean()
      .exec();
  }

  async getYoutubeHighlight(
    fixtureId: string,
  ): Promise<YouTubeHighlightDocument | null> {
    return this.youtubeHighlightModel
      .findOne({
        fixtureId,
        status: YoutubeHighlightStatus.FOUND,
      })
      .lean()
      .exec();
  }

  async getYoutubeHighlights(
    fixtureIds: string[],
  ): Promise<YouTubeHighlightDocument[]> {
    const ids = [...new Set(fixtureIds.filter(Boolean))];

    if (ids.length === 0) {
      return [];
    }

    return this.youtubeHighlightModel
      .find({
        fixtureId: {
          $in: ids,
        },
        status: YoutubeHighlightStatus.FOUND,
      })
      .lean()
      .exec();
  }

  async getFootballDataCompetitions(): Promise<
    FootballDataCompetitionDocument[]
  > {
    return this.footballDataCompetitionModel
      .find({})
      .sort({
        name: 1,
      })
      .lean()
      .exec();
  }

  async getFootballDataMatches(
    from?: Date,
    to?: Date,
    competitionCode?: string,
  ): Promise<FootballDataMatchDocument[]> {
    const filter: Record<string, unknown> = {};

    if (from || to) {
      filter.utcDate = {};

      if (from) {
        (filter.utcDate as Record<string, Date>).$gte = from;
      }

      if (to) {
        (filter.utcDate as Record<string, Date>).$lt = to;
      }
    }

    if (competitionCode) {
      filter.competitionCode = competitionCode.trim().toUpperCase();
    }

    return this.footballDataMatchModel
      .find(filter)
      .sort({
        utcDate: 1,
      })
      .lean()
      .exec();
  }

  async getFootballDataStandings(
    competitionCode: string,
    seasonId?: number,
  ): Promise<FootballDataStandingDocument[]> {
    const filter: Record<string, unknown> = {
      competitionCode: competitionCode.trim().toUpperCase(),
    };

    if (typeof seasonId === 'number') {
      filter.seasonId = seasonId;
    }

    return this.footballDataStandingModel
      .find(filter)
      .sort({
        'payload.position': 1,
      })
      .lean()
      .exec();
  }
}
