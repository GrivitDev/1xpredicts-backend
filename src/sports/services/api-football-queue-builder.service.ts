import { Injectable } from '@nestjs/common';

import { SupportedCompetitionService } from './supported-competition.service';

import { ActiveCompetitionService } from './active-competition.service';

import { ApiFootballQueueService } from './api-football-queue.service';

import { ApiFootballQueueJobType } from '../interfaces/api-football-queue.interface';

import { CompetitionPriority } from '../enums/competition-priority.enum';

@Injectable()
export class ApiFootballQueueBuilderService {
  constructor(
    private readonly supportedCompetitionService: SupportedCompetitionService,

    private readonly activeCompetitionService: ActiveCompetitionService,

    private readonly apiFootballQueueService: ApiFootballQueueService,
  ) {}

  // ============================================================
  // BUILD DAILY COLLECTION QUEUE
  // ============================================================

  async buildDailyQueue(): Promise<{
    queued: number;
    skipped: number;
    remainingQuota: number;
  }> {
    let remainingQuota =
      await this.apiFootballQueueService.getRemainingDailyQuota();

    if (remainingQuota <= 0) {
      return {
        queued: 0,
        skipped: 0,
        remainingQuota: 0,
      };
    }

    const active = await this.activeCompetitionService.getActive();

    const configured = this.supportedCompetitionService.getAll();

    const configuredMap = new Map(
      configured.map((competition) => [competition.id, competition]),
    );

    const competitions = active
      .map((activeCompetition) => ({
        activeCompetition,
        config: configuredMap.get(activeCompetition.competitionId),
      }))
      .filter(
        (
          item,
        ): item is {
          activeCompetition: NonNullable<typeof item.activeCompetition>;
          config: NonNullable<typeof item.config>;
        } => Boolean(item.config),
      )
      .filter(({ config }) => Boolean(config.providers.apiFootballId))
      .sort(
        (a, b) =>
          this.getPriority(a.config.priority) -
          this.getPriority(b.config.priority),
      );

    let queued = 0;
    let skipped = 0;

    for (const { activeCompetition, config } of competitions) {
      if (remainingQuota <= 0) {
        skipped += 1;
        break;
      }

      if (activeCompetition.season === undefined) {
        skipped += 1;
        continue;
      }

      const season = Number(activeCompetition.season);

      if (!Number.isInteger(season)) {
        skipped += 1;
        continue;
      }

      const leagueId = config.providers.apiFootballId;

      if (leagueId === undefined) {
        skipped += 1;
        continue;
      }

      const priority = this.getPriority(config.priority);

      const fixtureJob = await this.apiFootballQueueService.addJob({
        competitionId: config.id,

        apiFootballLeagueId: leagueId,

        season,

        type: ApiFootballQueueJobType.FIXTURES,

        priority,

        scheduledFor: new Date(),
      });

      /*
       * If this job already existed,
       * it does not consume another API
       * request. We still continue building
       * the rest of the queue.
       */
      if (fixtureJob.isNew) {
        queued += 1;
        remainingQuota -= 1;
      }

      if (remainingQuota <= 0) {
        break;
      }

      const standingsJob = await this.apiFootballQueueService.addJob({
        competitionId: config.id,

        apiFootballLeagueId: leagueId,

        season,

        type: ApiFootballQueueJobType.STANDINGS,

        priority: priority + 1,

        scheduledFor: new Date(Date.now() + 60 * 1000),
      });

      if (standingsJob.isNew) {
        queued += 1;
        remainingQuota -= 1;
      }

      if (remainingQuota <= 0) {
        break;
      }

      const injuriesJob = await this.apiFootballQueueService.addJob({
        competitionId: config.id,

        apiFootballLeagueId: leagueId,

        season,

        type: ApiFootballQueueJobType.INJURIES,

        priority: priority + 2,

        scheduledFor: new Date(Date.now() + 2 * 60 * 1000),
      });

      if (injuriesJob.isNew) {
        queued += 1;
        remainingQuota -= 1;
      }
    }

    return {
      queued,
      skipped,
      remainingQuota,
    };
  }

  // ============================================================
  // QUEUE TEAM STATISTICS
  // ============================================================

  async queueTeamStatistics(
    jobs: Array<{
      competitionId: string;
      leagueId: number;
      season: number;
      teamId: number;
      priority: number;
    }>,
  ): Promise<number> {
    let remainingQuota =
      await this.apiFootballQueueService.getRemainingDailyQuota();

    if (remainingQuota <= 0) {
      return 0;
    }

    let queued = 0;

    for (const job of jobs) {
      if (remainingQuota <= 0) {
        break;
      }

      const result = await this.apiFootballQueueService.addJob({
        competitionId: job.competitionId,

        apiFootballLeagueId: job.leagueId,

        season: job.season,

        apiFootballTeamId: job.teamId,

        type: ApiFootballQueueJobType.TEAM_STATISTICS,

        priority: job.priority,

        scheduledFor: new Date(),
      });

      if (result.isNew) {
        queued += 1;
        remainingQuota -= 1;
      }
    }

    return queued;
  }

  // ============================================================
  // QUEUE PREDICTIONS
  // ============================================================

  async queuePredictions(
    jobs: Array<{
      competitionId: string;
      leagueId: number;
      season: number;
      fixtureId: number;
      priority: number;
    }>,
  ): Promise<number> {
    let remainingQuota =
      await this.apiFootballQueueService.getRemainingDailyQuota();

    if (remainingQuota <= 0) {
      return 0;
    }

    let queued = 0;

    for (const job of jobs) {
      if (remainingQuota <= 0) {
        break;
      }

      const result = await this.apiFootballQueueService.addJob({
        competitionId: job.competitionId,

        apiFootballLeagueId: job.leagueId,

        season: job.season,

        apiFootballFixtureId: job.fixtureId,

        type: ApiFootballQueueJobType.PREDICTION,

        priority: job.priority,

        scheduledFor: new Date(),
      });

      if (result.isNew) {
        queued += 1;
        remainingQuota -= 1;
      }
    }

    return queued;
  }

  private getPriority(priority: CompetitionPriority): number {
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
        return 99;
    }
  }
}
