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
  ApiFootballQueue,
  ApiFootballQueueDocument,
} from '../schemas/api-football-queue.schema';

import { ApiFootballQueueJobType } from '../interfaces/api-football-queue.interface';

import { ActiveCompetitionStatus } from '../interfaces/active-competition.interface';

import { CompetitionPriority } from '../enums/competition-priority.enum';

import { ApiFootballQueueService } from './api-football-queue.service';

import { SPORTS_DATA_COLLECTION_CONFIG } from '../config/sports-data-collection.config';

@Injectable()
export class ApiFootballQueueBuilderService {
  constructor(
    @InjectModel(ActiveCompetition.name)
    private readonly activeCompetitionModel: Model<ActiveCompetitionDocument>,

    @InjectModel(ApiFootballFixture.name)
    private readonly fixtureModel: Model<ApiFootballFixtureDocument>,

    @InjectModel(ApiFootballQueue.name)
    private readonly queueModel: Model<ApiFootballQueueDocument>,

    private readonly queueService: ApiFootballQueueService,
  ) {}

  async buildInitialQueue(collectionDate = this.getWATDate()): Promise<{
    queued: number;
    skipped: number;
  }> {
    const competitions = await this.getEligibleCompetitions();

    return this.buildQueueForCompetitions(competitions, collectionDate);
  }

  async buildDailyQueue(collectionDate = this.getWATDate()): Promise<{
    queued: number;
    skipped: number;
  }> {
    const competitions = await this.getRecentMatchCompetitions();

    return this.buildQueueForCompetitions(competitions, collectionDate);
  }

  private async buildQueueForCompetitions(
    competitions: ActiveCompetitionDocument[],
    collectionDate: string,
  ): Promise<{
    queued: number;
    skipped: number;
  }> {
    let queued = 0;
    let skipped = 0;

    const start = this.getCollectionStart();

    const interval =
      SPORTS_DATA_COLLECTION_CONFIG.API_FOOTBALL.slotIntervalMinutes;

    let slotIndex = 0;

    for (const competition of competitions) {
      if (
        typeof competition.apiFootballLeagueId !== 'number' ||
        typeof competition.season !== 'number'
      ) {
        skipped += 2;
        continue;
      }

      const priority = this.getQueuePriority(competition.priority);

      const fixtureJob = await this.queueService.addJob({
        jobType: ApiFootballQueueJobType.FIXTURES,

        competitionId: competition.competitionId,

        apiFootballLeagueId: competition.apiFootballLeagueId,

        season: competition.season,

        collectionDate,

        priority,

        scheduledFor: this.addMinutes(start, slotIndex * interval),
      });

      queued += fixtureJob ? 1 : 0;
      skipped += fixtureJob ? 0 : 1;

      slotIndex += 1;

      const standingsJob = await this.queueService.addJob({
        jobType: ApiFootballQueueJobType.STANDINGS,

        competitionId: competition.competitionId,

        apiFootballLeagueId: competition.apiFootballLeagueId,

        season: competition.season,

        collectionDate,

        priority,

        scheduledFor: this.addMinutes(start, slotIndex * interval),
      });

      queued += standingsJob ? 1 : 0;
      skipped += standingsJob ? 0 : 1;

      slotIndex += 1;
    }

    return {
      queued,
      skipped,
    };
  }

  private async getEligibleCompetitions(): Promise<
    ActiveCompetitionDocument[]
  > {
    return this.activeCompetitionModel
      .find({
        status: {
          $in: [
            ActiveCompetitionStatus.UPCOMING,
            ActiveCompetitionStatus.ACTIVE,
          ],
        },

        apiFootballLeagueId: {
          $exists: true,
          $ne: null,
        },

        season: {
          $exists: true,
          $ne: null,
        },
      })
      .sort({
        priority: 1,
        name: 1,
      })
      .lean()
      .exec();
  }

  private async getRecentMatchCompetitions(): Promise<
    ActiveCompetitionDocument[]
  > {
    const now = new Date();

    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const recentFixtures = await this.fixtureModel
      .find({
        fixtureDate: {
          $gte: since,
          $lt: now,
        },

        statusShort: {
          $in: ['FT', 'AET', 'PEN'],
        },
      })
      .select({
        leagueId: 1,
        season: 1,
      })
      .lean()
      .exec();

    if (recentFixtures.length === 0) {
      return [];
    }

    const competitionKeys = new Set<string>();

    for (const fixture of recentFixtures) {
      if (
        typeof fixture.leagueId !== 'number' ||
        typeof fixture.season !== 'number'
      ) {
        continue;
      }

      competitionKeys.add(`${fixture.leagueId}:${fixture.season}`);
    }

    if (competitionKeys.size === 0) {
      return [];
    }

    const leagueIds: number[] = [];
    const seasons: number[] = [];

    for (const key of competitionKeys) {
      const [leagueIdValue, seasonValue] = key.split(':');

      const leagueId = Number(leagueIdValue);
      const season = Number(seasonValue);

      if (!Number.isInteger(leagueId) || !Number.isInteger(season)) {
        continue;
      }

      leagueIds.push(leagueId);
      seasons.push(season);
    }

    if (leagueIds.length === 0 || seasons.length === 0) {
      return [];
    }

    const competitions = await this.activeCompetitionModel
      .find({
        status: {
          $in: [
            ActiveCompetitionStatus.UPCOMING,
            ActiveCompetitionStatus.ACTIVE,
          ],
        },

        apiFootballLeagueId: {
          $in: [...new Set(leagueIds)],
        },

        season: {
          $in: [...new Set(seasons)],
        },
      })
      .sort({
        priority: 1,
        name: 1,
      })
      .lean()
      .exec();

    return competitions.filter((competition) => {
      if (
        typeof competition.apiFootballLeagueId !== 'number' ||
        typeof competition.season !== 'number'
      ) {
        return false;
      }

      return competitionKeys.has(
        `${competition.apiFootballLeagueId}:${competition.season}`,
      );
    });
  }

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
    }
  }

  private getWATDate(): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Lagos',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    return formatter.format(new Date());
  }

  private getCollectionStart(): Date {
    const now = new Date();

    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Lagos',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const [year, month, day] = formatter.format(now).split('-').map(Number);

    // 01:00 WAT = 00:00 UTC.
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  }

  private addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60_000);
  }
}
