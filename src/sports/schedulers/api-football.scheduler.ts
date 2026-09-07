import { Injectable, Logger } from '@nestjs/common';

import { Cron } from '@nestjs/schedule';

import { SPORTS_DATA_COLLECTION_CONFIG } from '../config/sports-data-collection.config';

import { ApiFootballQueueService } from '../services/api-football-queue.service';

import { SportsCollectionService } from '../services/sports-collection.service';

import { TeamCompetitionStatsService } from '../services/team-competition-stats.service';

import { HeadToHeadService } from '../services/head-to-head.service';

import { ApiFootballQueueJobType } from '../interfaces/api-football-queue.interface';

import { ApiFootballQueueDocument } from '../schemas/api-football-queue.schema';

@Injectable()
export class ApiFootballScheduler {
  private readonly logger = new Logger(ApiFootballScheduler.name);

  private readonly config = SPORTS_DATA_COLLECTION_CONFIG.API_FOOTBALL;

  private running = false;

  constructor(
    private readonly apiFootballQueueService: ApiFootballQueueService,

    private readonly sportsCollectionService: SportsCollectionService,

    private readonly teamCompetitionStatsService: TeamCompetitionStatsService,

    private readonly headToHeadService: HeadToHeadService,
  ) {}

  @Cron('* * * * *', {
    timeZone: 'Africa/Lagos',
  })
  async processQueue(): Promise<void> {
    if (this.running || !this.isWithinCollectionWindow()) {
      return;
    }

    this.running = true;

    try {
      await this.apiFootballQueueService.recoverStaleJobs(
        this.config.queue.staleProcessingMinutes,
      );

      const job = await this.apiFootballQueueService.getNextJob();

      if (!job) {
        return;
      }

      await this.processJob(job);
    } catch (error) {
      this.logger.error(
        'API-Football queue processing failed',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }

  private async processJob(job: ApiFootballQueueDocument): Promise<void> {
    try {
      if (job.type === ApiFootballQueueJobType.FIXTURES) {
        await this.processFixtures(job);
      } else if (job.type === ApiFootballQueueJobType.STANDINGS) {
        await this.processStandings(job);
      } else {
        throw new Error(`Unsupported API-Football job type: ${job.type}`);
      }

      await this.apiFootballQueueService.complete(String(job._id));
    } catch (error) {
      await this.apiFootballQueueService.fail(
        String(job._id),
        error instanceof Error ? error.message : String(error),
      );

      this.logger.error(
        `API-Football job ${job._id} failed`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async processFixtures(job: ApiFootballQueueDocument): Promise<void> {
    const result = await this.sportsCollectionService.processApiFootballJob({
      type: ApiFootballQueueJobType.FIXTURES,
      competitionId: job.competitionId,
      leagueId: job.apiFootballLeagueId,
      season: job.season,
      collectionDate: job.collectionDate,
    });

    const fixtureIds = result.fixtureIds ?? [];

    for (const fixtureId of fixtureIds) {
      await this.teamCompetitionStatsService.refreshForFixture(
        job.apiFootballLeagueId,
        job.season,
        fixtureId,
      );

      await this.headToHeadService.refreshForFixture(fixtureId);
    }
  }

  private async processStandings(job: ApiFootballQueueDocument): Promise<void> {
    await this.sportsCollectionService.processApiFootballJob({
      type: ApiFootballQueueJobType.STANDINGS,
      competitionId: job.competitionId,
      leagueId: job.apiFootballLeagueId,
      season: job.season,
      collectionDate: job.collectionDate,
    });

    await this.teamCompetitionStatsService.rebuildCompetition(
      job.apiFootballLeagueId,
      job.season,
    );
  }

  private isWithinCollectionWindow(): boolean {
    const now = new Date();

    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Lagos',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });

    const parts = formatter.formatToParts(now);

    const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);

    const minute = Number(
      parts.find((part) => part.type === 'minute')?.value ?? 0,
    );

    const current = hour * 60 + minute;

    const start = this.config.collectionWindow.startHour * 60;

    const end = this.config.collectionWindow.endHour * 60 + 59;

    return current >= start && current <= end;
  }
}
