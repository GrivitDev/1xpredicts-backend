import { Injectable } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { ApiFootballQueueJobType } from '../interfaces/api-football-queue.interface';

import {
  ActiveCompetition,
  ActiveCompetitionDocument,
} from '../schemas/active-competition.schema';

import { ActiveCompetitionStatus } from '../interfaces/active-competition.interface';

import { CompetitionPriority } from '../enums/competition-priority.enum';

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
  // PRIORITY
  // ============================================================

  private getQueuePriority(priority: CompetitionPriority): number {
    switch (priority) {
      case CompetitionPriority.ELITE:
        return 1;

      case CompetitionPriority.HIGH:
        return 2;

      case CompetitionPriority.REGIONAL:
        return 3;

      case CompetitionPriority.SELECTIVE:
        return 4;

      default:
        return 100;
    }
  }

  /**
   * Lower number = higher queue priority.
   *
   * Competition importance remains the primary factor.
   * Fixture proximity is then used to move imminent fixtures ahead
   * of fixtures that are further away.
   */
  private getFixtureQueuePriority(
    competitionPriority: CompetitionPriority,
    fixtureDate: Date,
  ): number {
    const basePriority = this.getQueuePriority(competitionPriority);

    const now = Date.now();
    const fixtureTime = fixtureDate.getTime();
    const hoursUntilFixture = Math.max(
      0,
      (fixtureTime - now) / (1000 * 60 * 60),
    );

    let urgency = 50;

    if (hoursUntilFixture <= 6) {
      urgency = 0;
    } else if (hoursUntilFixture <= 12) {
      urgency = 5;
    } else if (hoursUntilFixture <= 24) {
      urgency = 10;
    } else if (hoursUntilFixture <= 48) {
      urgency = 20;
    } else if (hoursUntilFixture <= 72) {
      urgency = 30;
    } else if (hoursUntilFixture <= 120) {
      urgency = 40;
    }

    return basePriority * 100 + urgency;
  }

  // ============================================================
  // RESULT HELPERS
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
  // ACTIVE COMPETITIONS
  // ============================================================

  private async getActiveCompetitions() {
    return this.activeCompetitionModel
      .find({
        status: {
          $in: [
            ActiveCompetitionStatus.ACTIVE,
            ActiveCompetitionStatus.UPCOMING,
          ],
        },
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
  }

  // ============================================================
  // FIXTURE QUEUE
  // ============================================================

  async buildFixtureQueue(): Promise<ApiFootballQueueBuildResult> {
    const result = await this.getResult();

    const now = new Date();

    const windowEnd = new Date(now);
    windowEnd.setDate(windowEnd.getDate() + this.fixtureWindowDays);

    const competitions = await this.getActiveCompetitions();

    for (const competition of competitions) {
      if (
        competition.apiFootballLeagueId === undefined ||
        competition.season === undefined ||
        competition.season === null
      ) {
        result.skipped += 1;
        continue;
      }

      /**
       * We deliberately do not use:
       *
       *   "if any fixture exists, skip competition"
       *
       * because that prevents new fixtures from being collected.
       *
       * The queue service handles duplicate jobs. This builder therefore
       * keeps the competition eligible for a fresh fixture refresh.
       */
      await this.createJob(
        {
          jobType: ApiFootballQueueJobType.FIXTURES,
          competitionId: competition.competitionId,
          apiFootballLeagueId: competition.apiFootballLeagueId,
          season: Number(competition.season),
          priority: this.getQueuePriority(competition.priority),
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
        result.skipped += 1;
        continue;
      }

      await this.createJob(
        {
          jobType: ApiFootballQueueJobType.STANDINGS,
          competitionId: competition.competitionId,
          apiFootballLeagueId: competition.apiFootballLeagueId,
          season: Number(competition.season),
          priority: this.getQueuePriority(competition.priority),
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
        result.skipped += 1;
        continue;
      }

      await this.createJob(
        {
          jobType: ApiFootballQueueJobType.INJURIES,
          competitionId: competition.competitionId,
          apiFootballLeagueId: competition.apiFootballLeagueId,
          season: Number(competition.season),
          priority: this.getQueuePriority(competition.priority),
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
        result.skipped += 1;
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

      if (teamIds.size === 0) {
        result.skipped += 1;
        continue;
      }

      for (const teamId of teamIds) {
        await this.createJob(
          {
            jobType: ApiFootballQueueJobType.TEAM_STATISTICS,
            competitionId: competition.competitionId,
            apiFootballLeagueId: competition.apiFootballLeagueId,
            season: Number(competition.season),
            apiFootballTeamId: teamId,
            priority: this.getQueuePriority(competition.priority),
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
        result.skipped += 1;
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
          fixtureDate: 1,
        })
        .sort({
          fixtureDate: 1,
        })
        .lean()
        .exec();

      if (fixtures.length === 0) {
        result.skipped += 1;
        continue;
      }

      for (const fixture of fixtures) {
        if (typeof fixture.fixtureId !== 'number') {
          result.skipped += 1;
          continue;
        }

        if (!(fixture.fixtureDate instanceof Date)) {
          result.skipped += 1;
          continue;
        }

        await this.createJob(
          {
            jobType: ApiFootballQueueJobType.PREDICTION,
            competitionId: competition.competitionId,
            apiFootballLeagueId: competition.apiFootballLeagueId,
            season: Number(competition.season),
            apiFootballFixtureId: fixture.fixtureId,
            priority: this.getFixtureQueuePriority(
              competition.priority,
              fixture.fixtureDate,
            ),
          },
          result,
        );
      }
    }

    return this.finalizeResult(result);
  }

  // ============================================================
  // COLLECTION STAGES
  // ============================================================

  /**
   * EARLY COLLECTION
   *
   * Supporting data is prepared first:
   *
   * - team statistics
   * - injuries
   */
  async buildTeamStatisticsAndInjuryJobs(): Promise<ApiFootballQueueBuildResult> {
    const result = await this.getResult();

    const teamStatisticsResult = await this.buildTeamStatisticsQueue();

    result.queued += teamStatisticsResult.queued;
    result.skipped += teamStatisticsResult.skipped;

    const injuryResult = await this.buildInjuryQueue();

    result.queued += injuryResult.queued;
    result.skipped += injuryResult.skipped;

    return this.finalizeResult(result);
  }

  /**
   * MID-COLLECTION TARGETED STAGE
   *
   * Prepare prediction jobs for upcoming fixtures.
   */
  async buildTargetedJobs(): Promise<ApiFootballQueueBuildResult> {
    const result = await this.getResult();

    const predictionResult = await this.buildPredictionQueue();

    result.queued += predictionResult.queued;
    result.skipped += predictionResult.skipped;

    return this.finalizeResult(result);
  }

  /**
   * LATE COLLECTION STAGE
   *
   * Refresh:
   *
   * - fixtures
   * - standings
   * - predictions
   */
  async buildLateStageJobs(): Promise<ApiFootballQueueBuildResult> {
    const result = await this.getResult();

    const fixtureResult = await this.buildFixtureQueue();

    result.queued += fixtureResult.queued;
    result.skipped += fixtureResult.skipped;

    const standingsResult = await this.buildStandingsQueue();

    result.queued += standingsResult.queued;
    result.skipped += standingsResult.skipped;

    const predictionResult = await this.buildPredictionQueue();

    result.queued += predictionResult.queued;
    result.skipped += predictionResult.skipped;

    return this.finalizeResult(result);
  }
}
