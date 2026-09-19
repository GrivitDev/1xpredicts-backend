// src/predictions-engine/services/raw-prediction-data.service.ts

import { Injectable } from '@nestjs/common';

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
  private readonly completedStatuses = [
    'FT',
    'AET',
    'PEN',
    'FINAL',
    'FINISHED',
    'COMPLETED',
    'POST',
    'STATUS_FINAL',
  ];

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
    const normalizedEventId = this.normalizeString(eventId);

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

    if (!this.isValidDate(fixtureDate)) {
      return null;
    }

    const competitionId = this.normalizeCompetitionId(fixture.leagueId);

    const season = Number(fixture.season);

    if (!competitionId || !Number.isFinite(season)) {
      return null;
    }

    const homeTeamId = this.normalizeString(fixture.homeTeamId);

    const awayTeamId = this.normalizeString(fixture.awayTeamId);

    if (!homeTeamId || !awayTeamId || homeTeamId === awayTeamId) {
      return null;
    }

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
      competitionHistoricalFixtures,
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

      this.getCompetitionHistoricalFixtures(competitionId, season, fixtureDate),
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

      competitionHistoricalFixtures,

      retrievedAt: new Date(),
    };
  }

  private async getHistoricalFixtures(
    teamId: string,
    beforeDate: Date,
    competitionId: string,
  ): Promise<EspnFixtureDocument[]> {
    /*
     * Historical team evidence is not removed by age.
     *
     * The prediction feature layer is responsible for applying
     * recency weighting. This query only establishes the temporal
     * boundary and historical-match eligibility.
     *
     * A fixture is considered completed when either the explicit
     * completed flag is true or ESPN has supplied a recognized
     * completed status.
     */
    return this.fixtureModel
      .find({
        leagueId: competitionId,

        fixtureDate: {
          $lt: beforeDate,
        },

        $or: [
          {
            completed: true,
          },

          {
            status: {
              $in: this.completedStatuses,
            },
          },
        ],

        $and: [
          {
            $or: [
              {
                homeTeamId: teamId,
              },

              {
                awayTeamId: teamId,
              },
            ],
          },
        ],
      })
      .sort({
        fixtureDate: -1,
      })
      .exec();
  }

  private async getCompetitionHistoricalFixtures(
    competitionId: string,
    season: number,
    beforeDate: Date,
  ): Promise<EspnFixtureDocument[]> {
    /*
     * Competition strength is constructed only from matches that
     * happened before the target fixture.
     *
     * Keeping the current season separate from the complete team
     * history prevents future/current-season information from
     * leaking into pre-match strength calculations.
     */
    return this.fixtureModel
      .find({
        leagueId: competitionId,

        season,

        fixtureDate: {
          $lt: beforeDate,
        },

        $or: [
          {
            completed: true,
          },

          {
            status: {
              $in: this.completedStatuses,
            },
          },
        ],
      })
      .sort({
        fixtureDate: 1,
      })
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

    return this.trimFutureHeadToHeadMeetings(headToHead, fixtureDate);
  }

  private trimFutureHeadToHeadMeetings(
    headToHead: HeadToHeadDocument,
    cutoff: Date,
  ): HeadToHeadDocument | null {
    const source = headToHead.toObject() as unknown as {
      meetings?: unknown;
    };

    /*
     * If the document contains an explicit meetings collection,
     * that collection becomes the authoritative historical H2H
     * evidence for this prediction.
     *
     * We deliberately do not fall back to stored aggregate values
     * when every stored meeting is future-dated. Those aggregates
     * could contain the very future matches we are required to
     * exclude.
     */
    const hasMeetingsArray = Array.isArray(source.meetings);

    if (!hasMeetingsArray) {
      return headToHead;
    }

    const meetings = source.meetings as unknown[];

    if (meetings.length === 0) {
      /*
       * An explicitly empty meeting history means there is no
       * meeting-level evidence available. Do not manufacture
       * historical evidence from potentially stale aggregate
       * fields.
       */
      return null;
    }

    const filteredMeetings = meetings.filter((meeting: unknown) => {
      if (!meeting || typeof meeting !== 'object') {
        return false;
      }

      const record = meeting as Record<string, unknown>;

      const meetingDate = record['fixtureDate'] ?? record['date'];

      if (
        !(
          typeof meetingDate === 'string' ||
          typeof meetingDate === 'number' ||
          meetingDate instanceof Date
        )
      ) {
        return false;
      }

      const date = new Date(meetingDate);

      return this.isValidDate(date) && date < cutoff;
    });

    /*
     * No valid historical meeting remains before the target
     * fixture. Returning null prevents the feature layer from
     * trusting stale aggregate fields that may include future
     * meetings.
     */
    if (filteredMeetings.length === 0) {
      return null;
    }

    /*
     * Avoid cloning the document when no temporal filtering was
     * necessary.
     */
    if (filteredMeetings.length === meetings.length) {
      return headToHead;
    }

    const cloned = headToHead.toObject() as unknown as Record<string, unknown>;

    cloned.meetings = filteredMeetings;

    return cloned as unknown as HeadToHeadDocument;
  }

  private normalizeString(value: unknown): string {
    if (typeof value !== 'string' && typeof value !== 'number') {
      return '';
    }

    return String(value).trim();
  }

  private normalizeCompetitionId(value: unknown): string {
    return this.normalizeString(value).toLowerCase();
  }

  private isValidDate(value: Date): boolean {
    return Number.isFinite(value.getTime());
  }
}
