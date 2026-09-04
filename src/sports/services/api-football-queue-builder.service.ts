import { Injectable } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { ApiFootballQueueJobType } from '../interfaces/api-football-queue.interface';

import {
  ActiveCompetition,
  ActiveCompetitionDocument,
} from '../schemas/active-competition.schema';

import { ActiveCompetitionStatus } from '../interfaces/active-competition.interface';

import {
  ApiFootballFixture,
  ApiFootballFixtureDocument,
} from '../schemas/api-football/api-football-fixture.schema';

import { ApiFootballQueueService } from './api-football-queue.service';

export interface ApiFootballQueueBuildResult {
  queued: number;
  skipped: number;
  remainingQuota: number;
}

@Injectable()
export class ApiFootballQueueBuilderService {
  private readonly fixtureWindowDays = 10;

  constructor(
    private readonly apiFootballQueueService: ApiFootballQueueService,

    @InjectModel(ActiveCompetition.name)
    private readonly activeCompetitionModel: Model<ActiveCompetitionDocument>,

    @InjectModel(ApiFootballFixture.name)
    private readonly apiFootballFixtureModel: Model<ApiFootballFixtureDocument>,
  ) {}

  // ============================================================
  // RESULT HELPER
  // ============================================================

  private async createJob(
    job: Parameters<ApiFootballQueueService['addJob']>[0],
    result: ApiFootballQueueBuildResult,
  ): Promise<void> {
    const created = await this.apiFootballQueueService.addJob(job);

    if (created) {
      result.queued += 1;
    } else {
      result.skipped += 1;
    }
  }

  private async getResult(): Promise<ApiFootballQueueBuildResult> {
    return {
      queued: 0,
      skipped: 0,
      remainingQuota:
        await this.apiFootballQueueService.getRemainingDailyQuota(),
    };
  }

  private async finalizeResult(
    result: ApiFootballQueueBuildResult,
  ): Promise<ApiFootballQueueBuildResult> {
    result.remainingQuota =
      await this.apiFootballQueueService.getRemainingDailyQuota();

    return result;
  }

  // ============================================================
  // FIXTURE QUEUE
  // ============================================================

  async buildFixtureQueue(): Promise<ApiFootballQueueBuildResult> {
    const result = await this.getResult();

    const now = new Date();

    const windowEnd = new Date(now);
    windowEnd.setDate(windowEnd.getDate() + this.fixtureWindowDays);

    const competitions = await this.activeCompetitionModel
      .find({
        status: {
          $in: [
            ActiveCompetitionStatus.ACTIVE,
            ActiveCompetitionStatus.UPCOMING,
          ],
        },
      })
      .sort({
        priority: 1,
      })
      .lean()
      .exec();

    for (const competition of competitions) {
      if (
        competition.apiFootballLeagueId === undefined ||
        competition.season === undefined ||
        competition.season === null
      ) {
        continue;
      }

      const existingFixtures = await this.apiFootballFixtureModel
        .find({
          leagueId: competition.apiFootballLeagueId,

          season: Number(competition.season),

          fixtureDate: {
            $gte: now,
            $lte: windowEnd,
          },
        })
        .select({
          fixtureId: 1,
        })
        .lean()
        .exec();

      const knownFixtureIds = new Set(
        existingFixtures
          .map((fixture) => fixture.fixtureId)
          .filter(
            (fixtureId): fixtureId is number => typeof fixtureId === 'number',
          ),
      );

      if (knownFixtureIds.size > 0) {
        result.skipped += 1;
        continue;
      }

      await this.createJob(
        {
          jobType: ApiFootballQueueJobType.FIXTURES,

          competitionId: competition.competitionId,

          apiFootballLeagueId: competition.apiFootballLeagueId,

          season: Number(competition.season),

          priority: competition.priority,
        },
        result,
      );
    }

    return this.finalizeResult(result);
  }

  // ============================================================
  // STANDINGS
  // ============================================================

  async buildStandingsQueue(): Promise<ApiFootballQueueBuildResult> {
    const result = await this.getResult();

    const competitions = await this.activeCompetitionModel
      .find({
        status: ActiveCompetitionStatus.ACTIVE,

        apiFootballLeagueId: {
          $exists: true,
        },

        season: {
          $exists: true,
        },
      })
      .sort({
        priority: 1,
      })
      .lean()
      .exec();

    for (const competition of competitions) {
      if (
        competition.apiFootballLeagueId === undefined ||
        competition.season === undefined ||
        competition.season === null
      ) {
        continue;
      }

      await this.createJob(
        {
          jobType: ApiFootballQueueJobType.STANDINGS,

          competitionId: competition.competitionId,

          apiFootballLeagueId: competition.apiFootballLeagueId,

          season: Number(competition.season),

          priority: competition.priority,
        },
        result,
      );
    }

    return this.finalizeResult(result);
  }

  // ============================================================
  // INJURIES
  // ============================================================

  async buildInjuryQueue(): Promise<ApiFootballQueueBuildResult> {
    const result = await this.getResult();

    const competitions = await this.activeCompetitionModel
      .find({
        status: ActiveCompetitionStatus.ACTIVE,

        apiFootballLeagueId: {
          $exists: true,
        },

        season: {
          $exists: true,
        },
      })
      .sort({
        priority: 1,
      })
      .lean()
      .exec();

    for (const competition of competitions) {
      if (
        competition.apiFootballLeagueId === undefined ||
        competition.season === undefined ||
        competition.season === null
      ) {
        continue;
      }

      await this.createJob(
        {
          jobType: ApiFootballQueueJobType.INJURIES,

          competitionId: competition.competitionId,

          apiFootballLeagueId: competition.apiFootballLeagueId,

          season: Number(competition.season),

          priority: competition.priority,
        },
        result,
      );
    }

    return this.finalizeResult(result);
  }

  // ============================================================
  // TEAM STATISTICS
  // ============================================================

  async buildTeamStatisticsQueue(): Promise<ApiFootballQueueBuildResult> {
    const result = await this.getResult();

    const now = new Date();

    const windowEnd = new Date(now);
    windowEnd.setDate(windowEnd.getDate() + this.fixtureWindowDays);

    const competitions = await this.activeCompetitionModel
      .find({
        status: ActiveCompetitionStatus.ACTIVE,

        apiFootballLeagueId: {
          $exists: true,
        },

        season: {
          $exists: true,
        },
      })
      .sort({
        priority: 1,
      })
      .lean()
      .exec();

    for (const competition of competitions) {
      if (
        competition.apiFootballLeagueId === undefined ||
        competition.season === undefined ||
        competition.season === null
      ) {
        continue;
      }

      const fixtures = await this.apiFootballFixtureModel
        .find({
          leagueId: competition.apiFootballLeagueId,

          season: Number(competition.season),

          fixtureDate: {
            $gte: now,
            $lte: windowEnd,
          },
        })
        .select({
          homeTeamId: 1,
          awayTeamId: 1,
        })
        .lean()
        .exec();

      const teamIds = new Set<number>();

      for (const fixture of fixtures) {
        if (typeof fixture.homeTeamId === 'number') {
          teamIds.add(fixture.homeTeamId);
        }

        if (typeof fixture.awayTeamId === 'number') {
          teamIds.add(fixture.awayTeamId);
        }
      }

      for (const teamId of teamIds) {
        await this.createJob(
          {
            jobType: ApiFootballQueueJobType.TEAM_STATISTICS,

            competitionId: competition.competitionId,

            apiFootballLeagueId: competition.apiFootballLeagueId,

            season: Number(competition.season),

            apiFootballTeamId: teamId,

            priority: competition.priority,
          },
          result,
        );
      }
    }

    return this.finalizeResult(result);
  }

  // ============================================================
  // PREDICTIONS
  // ============================================================

  async buildPredictionQueue(): Promise<ApiFootballQueueBuildResult> {
    const result = await this.getResult();

    const now = new Date();

    const windowEnd = new Date(now);
    windowEnd.setDate(windowEnd.getDate() + this.fixtureWindowDays);

    const competitions = await this.activeCompetitionModel
      .find({
        status: ActiveCompetitionStatus.ACTIVE,

        apiFootballLeagueId: {
          $exists: true,
        },

        season: {
          $exists: true,
        },
      })
      .sort({
        priority: 1,
      })
      .lean()
      .exec();

    for (const competition of competitions) {
      if (
        competition.apiFootballLeagueId === undefined ||
        competition.season === undefined ||
        competition.season === null
      ) {
        continue;
      }

      const fixtures = await this.apiFootballFixtureModel
        .find({
          leagueId: competition.apiFootballLeagueId,

          season: Number(competition.season),

          fixtureDate: {
            $gte: now,
            $lte: windowEnd,
          },

          statusShort: {
            $nin: ['FT', 'AET', 'PEN'],
          },
        })
        .select({
          fixtureId: 1,
        })
        .lean()
        .exec();

      for (const fixture of fixtures) {
        if (typeof fixture.fixtureId !== 'number') {
          continue;
        }

        await this.createJob(
          {
            jobType: ApiFootballQueueJobType.PREDICTION,

            competitionId: competition.competitionId,

            apiFootballLeagueId: competition.apiFootballLeagueId,

            season: Number(competition.season),

            apiFootballFixtureId: fixture.fixtureId,

            priority: competition.priority,
          },
          result,
        );
      }
    }

    return this.finalizeResult(result);
  }
}
