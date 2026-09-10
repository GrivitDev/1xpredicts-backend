import { Injectable, Logger } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import {
  EspnFixture,
  EspnFixtureDocument,
} from '../schemas/espn/espn-fixture.schema';

import { HeadToHead, HeadToHeadDocument } from '../schemas/head-to-head.schema';

interface MeetingRecord {
  fixtureId: string;

  competitionId: string;

  season: number;

  date: Date;

  homeTeamId: string;

  homeTeamName: string;

  awayTeamId: string;

  awayTeamName: string;

  homeGoals: number;

  awayGoals: number;
}

@Injectable()
export class HeadToHeadService {
  private readonly logger = new Logger(HeadToHeadService.name);

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

    @InjectModel(HeadToHead.name)
    private readonly headToHeadModel: Model<HeadToHeadDocument>,
  ) {}

  // ============================================================
  // REBUILD PAIR
  // ============================================================

  async rebuildPair(
    teamOneId: string,
    teamTwoId: string,
  ): Promise<HeadToHeadDocument | null> {
    const normalizedTeamOneId = teamOneId.trim();

    const normalizedTeamTwoId = teamTwoId.trim();

    if (
      !normalizedTeamOneId ||
      !normalizedTeamTwoId ||
      normalizedTeamOneId === normalizedTeamTwoId
    ) {
      return null;
    }

    const { teamAId, teamBId, pairKey } = this.normalizePair(
      normalizedTeamOneId,
      normalizedTeamTwoId,
    );

    const pairCriteria = {
      completed: true,
      $or: [
        {
          homeTeamId: teamAId,
          awayTeamId: teamBId,
        },
        {
          homeTeamId: teamBId,
          awayTeamId: teamAId,
        },
      ],
    };

    const fixtures = await this.fixtureModel
      .find(pairCriteria)
      .sort({
        fixtureDate: -1,
      })
      .lean()
      .exec();

    const meetings: MeetingRecord[] = [];

    let teamAName = `Team ${teamAId}`;

    let teamBName = `Team ${teamBId}`;

    for (const fixture of fixtures) {
      if (!this.isCompletedFixture(fixture)) {
        continue;
      }

      if (fixture.homeScore === undefined || fixture.awayScore === undefined) {
        continue;
      }

      const homeTeamId = fixture.homeTeamId;

      const awayTeamId = fixture.awayTeamId;

      if (!this.isPair(homeTeamId, awayTeamId, teamAId, teamBId)) {
        continue;
      }

      const homeTeamName = this.extractTeamName(
        fixture.payload,
        'home',
        homeTeamId,
      );

      const awayTeamName = this.extractTeamName(
        fixture.payload,
        'away',
        awayTeamId,
      );

      teamAName = homeTeamId === teamAId ? homeTeamName : awayTeamName;

      teamBName = homeTeamId === teamBId ? homeTeamName : awayTeamName;

      meetings.push({
        fixtureId: fixture.eventId,

        competitionId: fixture.leagueId,

        season: fixture.season,

        date: fixture.fixtureDate,

        homeTeamId,

        homeTeamName,

        awayTeamId,

        awayTeamName,

        homeGoals: fixture.homeScore,

        awayGoals: fixture.awayScore,
      });
    }

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

            totalMeetings: meetings.length,

            teamAWins: stats.teamAWins,

            draws: stats.draws,

            teamBWins: stats.teamBWins,

            teamAGoals: stats.teamAGoals,

            teamBGoals: stats.teamBGoals,

            meetings,

            lastMeetingAt: meetings[0]?.date ?? null,

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
  // ============================================================
  // REFRESH FOR FIXTURE
  // ============================================================

  async refreshForFixture(
    fixtureId: string,
  ): Promise<HeadToHeadDocument | null> {
    const fixture = await this.fixtureModel
      .findOne({
        eventId: fixtureId.trim(),
      })
      .lean()
      .exec();

    if (!fixture) {
      return null;
    }

    if (!this.isCompletedFixture(fixture)) {
      return null;
    }

    if (
      !fixture.homeTeamId ||
      !fixture.awayTeamId ||
      fixture.homeTeamId === fixture.awayTeamId
    ) {
      return null;
    }

    return this.rebuildPair(fixture.homeTeamId, fixture.awayTeamId);
  }

  // ============================================================
  // GET PAIR
  // ============================================================

  async getPair(
    teamOneId: string,
    teamTwoId: string,
  ): Promise<HeadToHeadDocument | null> {
    if (!teamOneId || !teamTwoId || teamOneId === teamTwoId) {
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

  // ============================================================
  // REBUILD PAIRS
  // ============================================================

  async rebuildPairsForTeams(teamIds: string[]): Promise<number> {
    const uniqueTeamIds = [
      ...new Set(teamIds.map((id) => id.trim()).filter(Boolean)),
    ];

    if (uniqueTeamIds.length < 2) {
      return 0;
    }

    const fixtures = await this.fixtureModel
      .find({
        completed: true,

        $or: [
          {
            homeTeamId: {
              $in: uniqueTeamIds,
            },
          },
          {
            awayTeamId: {
              $in: uniqueTeamIds,
            },
          },
        ],
      })
      .lean()
      .exec();

    const pairs = new Set<string>();

    for (const fixture of fixtures) {
      if (!this.isCompletedFixture(fixture)) {
        continue;
      }

      const homeId = fixture.homeTeamId;

      const awayId = fixture.awayTeamId;

      if (
        !homeId ||
        !awayId ||
        homeId === awayId ||
        !uniqueTeamIds.includes(homeId) ||
        !uniqueTeamIds.includes(awayId)
      ) {
        continue;
      }

      pairs.add(this.normalizePair(homeId, awayId).pairKey);
    }

    let rebuilt = 0;

    for (const pairKey of pairs) {
      const [teamAId, teamBId] = pairKey.split(':');

      if (!teamAId || !teamBId) {
        continue;
      }

      const result = await this.rebuildPair(teamAId, teamBId);

      if (result) {
        rebuilt += 1;
      }
    }

    return rebuilt;
  }

  // ============================================================
  // STATS
  // ============================================================

  private calculateStats(
    teamAId: string,
    teamBId: string,
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

  // ============================================================
  // HELPERS
  // ============================================================

  private normalizePair(
    teamOneId: string,
    teamTwoId: string,
  ): {
    teamAId: string;
    teamBId: string;
    pairKey: string;
  } {
    const ids = [teamOneId.trim(), teamTwoId.trim()].sort((a, b) =>
      a.localeCompare(b, undefined, {
        numeric: true,
      }),
    );

    return {
      teamAId: ids[0],
      teamBId: ids[1],
      pairKey: `${ids[0]}:${ids[1]}`,
    };
  }

  private isPair(
    homeId: string,
    awayId: string,
    teamAId: string,
    teamBId: string,
  ): boolean {
    return (
      (homeId === teamAId && awayId === teamBId) ||
      (homeId === teamBId && awayId === teamAId)
    );
  }

  private isCompletedFixture(fixture: EspnFixtureDocument): boolean {
    if (fixture.completed === true) {
      return true;
    }

    const status = fixture.status?.trim().toUpperCase();

    return this.completedStatuses.has(status);
  }

  private extractTeamName(
    payload: Record<string, unknown>,
    side: 'home' | 'away',
    fallbackId: string,
  ): string {
    const competitions = payload['competitions'];

    if (Array.isArray(competitions)) {
      const competitors = (competitions[0] as Record<string, unknown>)?.[
        'competitors'
      ];

      if (Array.isArray(competitors)) {
        const competitor = competitors.find(
          (item) => (item as Record<string, unknown>)?.['homeAway'] === side,
        ) as Record<string, unknown> | undefined;

        const team = competitor?.['team'] as
          | Record<string, unknown>
          | undefined;

        const name =
          team?.['displayName'] ?? team?.['name'] ?? team?.['shortDisplayName'];

        if (typeof name === 'string' && name.trim()) {
          return name.trim();
        }
      }
    }

    return `Team ${fallbackId}`;
  }
}
