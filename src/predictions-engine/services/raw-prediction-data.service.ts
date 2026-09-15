import { Injectable, Logger } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import {
  EspnFixture,
  EspnFixtureDocument,
} from '../../sports/schemas/espn/espn-fixture.schema';

import {
  EspnTeam,
  EspnTeamDocument,
} from '../../sports/schemas/espn/espn-team.schema';

import {
  EspnStanding,
  EspnStandingDocument,
} from '../../sports/schemas/espn/espn-standing.schema';

import {
  TeamCompetitionStats,
  TeamCompetitionStatsDocument,
} from '../../sports/schemas/team-competition-stats.schema';

import {
  TeamPerformanceProfile,
  TeamPerformanceProfileDocument,
} from '../../sports/schemas/team-performance-profile.schema';

import {
  HeadToHead,
  HeadToHeadDocument,
} from '../../sports/schemas/head-to-head.schema';

import { RawPredictionMatchInput } from '../interfaces/raw-prediction-match.interface';

@Injectable()
export class RawPredictionDataService {
  private readonly logger = new Logger(RawPredictionDataService.name);

  private readonly historicalFixtureLimit = 30;

  constructor(
    @InjectModel(EspnFixture.name)
    private readonly fixtureModel: Model<EspnFixtureDocument>,

    @InjectModel(EspnTeam.name)
    private readonly teamModel: Model<EspnTeamDocument>,

    @InjectModel(EspnStanding.name)
    private readonly standingModel: Model<EspnStandingDocument>,

    @InjectModel(TeamCompetitionStats.name)
    private readonly teamCompetitionStatsModel: Model<TeamCompetitionStatsDocument>,

    @InjectModel(TeamPerformanceProfile.name)
    private readonly teamPerformanceProfileModel: Model<TeamPerformanceProfileDocument>,

    @InjectModel(HeadToHead.name)
    private readonly headToHeadModel: Model<HeadToHeadDocument>,
  ) {}

  async getMatch(eventId: string): Promise<RawPredictionMatchInput | null> {
    const normalizedEventId = String(eventId).trim();

    if (!normalizedEventId) {
      return null;
    }

    const fixture = await this.fixtureModel
      .findOne({
        eventId: normalizedEventId,
      })
      .exec();

    if (!fixture) {
      return null;
    }

    if (
      !fixture.fixtureDate ||
      !fixture.homeTeamId ||
      !fixture.awayTeamId ||
      !fixture.leagueId ||
      fixture.season === undefined ||
      fixture.season === null
    ) {
      return null;
    }

    const fixtureDate = new Date(fixture.fixtureDate);

    if (!Number.isFinite(fixtureDate.getTime())) {
      return null;
    }

    const competitionId = String(fixture.leagueId).trim().toLowerCase();

    const season = Number(fixture.season);

    const homeTeamId = String(fixture.homeTeamId).trim();

    const awayTeamId = String(fixture.awayTeamId).trim();

    const [
      homeTeam,
      awayTeam,
      homeStanding,
      awayStanding,
      homeTeamCompetitionStats,
      awayTeamCompetitionStats,
      homeTeamPerformanceProfile,
      awayTeamPerformanceProfile,
      headToHead,
      homeHistoricalFixtures,
      awayHistoricalFixtures,
    ] = await Promise.all([
      this.teamModel
        .findOne({
          leagueId: competitionId,
          teamId: homeTeamId,
        })
        .exec(),

      this.teamModel
        .findOne({
          leagueId: competitionId,
          teamId: awayTeamId,
        })
        .exec(),

      this.standingModel
        .findOne({
          leagueId: competitionId,
          season,
          teamId: homeTeamId,
        })
        .exec(),

      this.standingModel
        .findOne({
          leagueId: competitionId,
          season,
          teamId: awayTeamId,
        })
        .exec(),

      this.teamCompetitionStatsModel
        .findOne({
          competitionId,
          season,
          teamId: homeTeamId,
        })
        .exec(),

      this.teamCompetitionStatsModel
        .findOne({
          competitionId,
          season,
          teamId: awayTeamId,
        })
        .exec(),

      this.teamPerformanceProfileModel
        .findOne({
          competitionId,
          season,
          teamId: homeTeamId,
        })
        .exec(),

      this.teamPerformanceProfileModel
        .findOne({
          competitionId,
          season,
          teamId: awayTeamId,
        })
        .exec(),

      this.getHeadToHead(homeTeamId, awayTeamId, fixtureDate),

      this.getHistoricalFixtures(homeTeamId, fixtureDate, competitionId),

      this.getHistoricalFixtures(awayTeamId, fixtureDate, competitionId),
    ]);

    return {
      fixture,

      homeTeam,
      awayTeam,

      homeStanding,
      awayStanding,

      homeTeamCompetitionStats,
      awayTeamCompetitionStats,

      homeTeamPerformanceProfile,
      awayTeamPerformanceProfile,

      headToHead,

      homeHistoricalFixtures,
      awayHistoricalFixtures,

      retrievedAt: new Date(),
    };
  }

  private async getHistoricalFixtures(
    teamId: string,
    beforeDate: Date,
    competitionId: string,
  ): Promise<EspnFixtureDocument[]> {
    /*
     * Historical form for prediction is deliberately
     * limited to the same competition and to fixtures
     * strictly before the target kickoff.
     */
    return this.fixtureModel
      .find({
        leagueId: competitionId,

        completed: true,

        fixtureDate: {
          $lt: beforeDate,
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
        fixtureDate: -1,
      })
      .limit(this.historicalFixtureLimit)
      .exec();
  }

  private async getHeadToHead(
    homeTeamId: string,
    awayTeamId: string,
    fixtureDate: Date,
  ): Promise<HeadToHeadDocument | null> {
    const [teamAId, teamBId] = [homeTeamId, awayTeamId].sort((a, b) =>
      a.localeCompare(b, undefined, {
        numeric: true,
      }),
    );

    const pairKey = `${teamAId}:${teamBId}`;

    const headToHead = await this.headToHeadModel
      .findOne({
        pairKey,
      })
      .exec();

    if (!headToHead) {
      return null;
    }

    return this.trimHeadToHeadToCutoff(headToHead, fixtureDate);
  }

  private trimHeadToHeadToCutoff(
    headToHead: HeadToHeadDocument,
    cutoff: Date,
  ): HeadToHeadDocument {
    const source = headToHead.toObject() as unknown as {
      meetings?: unknown;
    };

    const meetings: unknown[] = Array.isArray(source.meetings)
      ? source.meetings
      : [];

    if (!meetings.length) {
      return headToHead;
    }

    const filteredMeetings = meetings.filter((meeting: unknown) => {
      if (typeof meeting !== 'object' || meeting === null) {
        return false;
      }

      const meetingRecord = meeting as Record<string, unknown>;
      const meetingDate = meetingRecord.fixtureDate ?? meetingRecord.date;

      if (
        typeof meetingDate !== 'string' &&
        typeof meetingDate !== 'number' &&
        !(meetingDate instanceof Date)
      ) {
        return false;
      }

      const date = new Date(meetingDate);

      return Number.isFinite(date.getTime()) && date < cutoff;
    });

    if (filteredMeetings.length === meetings.length) {
      return headToHead;
    }

    const cloned = headToHead.toObject() as unknown as Record<string, unknown>;

    cloned.meetings = filteredMeetings;

    return cloned as unknown as HeadToHeadDocument;
  }
}
