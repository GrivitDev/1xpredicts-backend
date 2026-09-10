import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  EspnFixture,
  EspnFixtureDocument,
} from '../schemas/espn/espn-fixture.schema';

import { EspnQueueService } from './espn-queue.service';
import { EspnActiveCompetitionService } from './espn-active-competition.service';
import { PriorityCompetitionService } from './priority-competition.service';

import { CompetitionPriority } from '../enums/competition-priority.enum';

@Injectable()
export class EspnQueueBuilderService {
  private readonly logger = new Logger(EspnQueueBuilderService.name);

  private readonly upcomingWindowDays = 4;
  private readonly finishedLookbackHours = 12;
  private readonly finishedDelayHours = 3;

  constructor(
    @InjectModel(EspnFixture.name)
    private readonly fixtureModel: Model<EspnFixtureDocument>,

    private readonly queueService: EspnQueueService,

    private readonly espnActiveCompetitionService: EspnActiveCompetitionService,

    private readonly priorityCompetitionService: PriorityCompetitionService,
  ) {}

  // ============================================================
  // INITIAL LEAGUE QUEUE
  // ============================================================

  async buildInitialLeagueQueue(): Promise<number> {
    const leagues = await this.espnActiveCompetitionService.getOrderedLeagues();

    let queued = 0;

    for (const league of leagues) {
      const priority = this.getQueuePriority(
        league.priority as CompetitionPriority | undefined,
      );

      await this.queueService.addLeagueRefreshJob({
        leagueId: league.leagueId,
        season: this.extractLeagueSeason(league),
        priority,
        scheduledFor: new Date(),
      });

      queued += 1;
    }

    this.logger.log(`Built ${queued} ESPN league refresh jobs`);

    return queued;
  }

  // ============================================================
  // MATCH QUEUE
  // ============================================================

  async buildMatchQueue(): Promise<{
    upcoming: number;
    finished: number;
  }> {
    const now = new Date();

    const upcomingEnd = new Date(
      now.getTime() + this.upcomingWindowDays * 24 * 60 * 60 * 1000,
    );

    const finishedStart = new Date(
      now.getTime() - this.finishedLookbackHours * 60 * 60 * 1000,
    );

    const upcomingFixtures = await this.fixtureModel
      .find({
        fixtureDate: {
          $gte: now,
          $lte: upcomingEnd,
        },
        completed: {
          $ne: true,
        },
      })
      .sort({
        fixtureDate: 1,
      })
      .lean()
      .exec();

    const finishedFixtures = await this.fixtureModel
      .find({
        fixtureDate: {
          $gte: finishedStart,
          $lte: now,
        },
        completed: true,
      })
      .sort({
        fixtureDate: 1,
      })
      .lean()
      .exec();

    let upcoming = 0;
    let finished = 0;

    for (const fixture of upcomingFixtures) {
      if (!this.isPriorityLeague(fixture.leagueId)) {
        continue;
      }

      const competitionId = this.extractCompetitionId(fixture.payload);

      if (!competitionId) {
        continue;
      }

      const priority = this.getQueuePriorityFromCompetition(competitionId);

      await this.queueService.addUpcomingMatchJob({
        leagueId: fixture.leagueId,
        eventId: fixture.eventId,
        season: fixture.season,
        priority,
        scheduledFor: this.getFixtureStartTime(fixture),
      });

      upcoming += 1;
    }

    for (const fixture of finishedFixtures) {
      if (!this.isPriorityLeague(fixture.leagueId)) {
        continue;
      }

      const competitionId = this.extractCompetitionId(fixture.payload);

      if (!competitionId) {
        continue;
      }

      const priority = this.getQueuePriorityFromCompetition(competitionId);

      const kickoff = this.getFixtureStartTime(fixture);

      const scheduledFor = new Date(
        kickoff.getTime() + this.finishedDelayHours * 60 * 60 * 1000,
      );

      await this.queueService.addFinishedMatchJob({
        leagueId: fixture.leagueId,
        eventId: fixture.eventId,
        season: fixture.season,
        priority,
        scheduledFor: scheduledFor > now ? scheduledFor : now,
      });

      finished += 1;
    }

    this.logger.log(
      `Built ESPN match queue: ${upcoming} upcoming, ${finished} finished`,
    );

    return {
      upcoming,
      finished,
    };
  }

  // ============================================================
  // LEAGUE MATCH JOBS
  // ============================================================

  async buildLeagueMatchJobs(
    leagueId: string,
    season?: number,
  ): Promise<{
    upcoming: number;
    finished: number;
  }> {
    const normalizedLeagueId = leagueId.trim().toLowerCase();

    if (!this.isPriorityLeague(normalizedLeagueId)) {
      return {
        upcoming: 0,
        finished: 0,
      };
    }

    const now = new Date();

    const upcomingEnd = new Date(
      now.getTime() + this.upcomingWindowDays * 24 * 60 * 60 * 1000,
    );

    const finishedStart = new Date(
      now.getTime() - this.finishedLookbackHours * 60 * 60 * 1000,
    );

    const upcomingFilter: Record<string, unknown> = {
      leagueId: normalizedLeagueId,
      fixtureDate: {
        $gte: now,
        $lte: upcomingEnd,
      },
      completed: {
        $ne: true,
      },
    };

    const finishedFilter: Record<string, unknown> = {
      leagueId: normalizedLeagueId,
      fixtureDate: {
        $gte: finishedStart,
        $lte: now,
      },
      completed: true,
    };

    if (season !== undefined) {
      upcomingFilter.season = season;
      finishedFilter.season = season;
    }

    const upcomingFixtures = await this.fixtureModel
      .find(upcomingFilter)
      .sort({
        fixtureDate: 1,
      })
      .lean()
      .exec();

    const finishedFixtures = await this.fixtureModel
      .find(finishedFilter)
      .sort({
        fixtureDate: 1,
      })
      .lean()
      .exec();

    let upcoming = 0;
    let finished = 0;

    for (const fixture of upcomingFixtures) {
      const competitionId = this.extractCompetitionId(fixture.payload);

      if (!competitionId) {
        continue;
      }

      await this.queueService.addUpcomingMatchJob({
        leagueId: fixture.leagueId,
        eventId: fixture.eventId,
        season: fixture.season,
        priority: this.getQueuePriorityFromCompetition(competitionId),
        scheduledFor: this.getFixtureStartTime(fixture),
      });

      upcoming += 1;
    }

    for (const fixture of finishedFixtures) {
      const competitionId = this.extractCompetitionId(fixture.payload);

      if (!competitionId) {
        continue;
      }

      const kickoff = this.getFixtureStartTime(fixture);

      const scheduledFor = new Date(
        kickoff.getTime() + this.finishedDelayHours * 60 * 60 * 1000,
      );

      await this.queueService.addFinishedMatchJob({
        leagueId: fixture.leagueId,
        eventId: fixture.eventId,
        season: fixture.season,
        priority: this.getQueuePriorityFromCompetition(competitionId),
        scheduledFor: scheduledFor > now ? scheduledFor : now,
      });

      finished += 1;
    }

    return {
      upcoming,
      finished,
    };
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private isPriorityLeague(leagueId: string): boolean {
    return this.espnActiveCompetitionService
      ? Boolean(this.priorityCompetitionService.getById(leagueId)) ||
          Boolean(this.espnActiveCompetitionService.getByLeagueId(leagueId))
      : false;
  }

  private getQueuePriorityFromCompetition(competitionId: string): number {
    const competition = this.priorityCompetitionService.getById(competitionId);

    return this.getQueuePriority(competition?.priority);
  }

  private getQueuePriority(priority?: CompetitionPriority): number {
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

  private getFixtureStartTime(fixture: EspnFixtureDocument): Date {
    const value = fixture.fixtureDate;

    if (!(value instanceof Date)) {
      throw new Error(`Invalid fixture date for ESPN event ${fixture.eventId}`);
    }

    if (Number.isNaN(value.getTime())) {
      throw new Error(`Invalid fixture date for ESPN event ${fixture.eventId}`);
    }

    return value;
  }

  private extractCompetitionId(
    payload: Record<string, unknown>,
  ): string | undefined {
    const direct = payload['competitionId'];

    if (typeof direct === 'string' && direct.trim()) {
      return direct.trim();
    }

    const competition = payload['competition'];

    if (competition && typeof competition === 'object') {
      const id = (competition as Record<string, unknown>)['id'];

      if (typeof id === 'string' && id.trim()) {
        return id.trim();
      }

      if (typeof id === 'number' && Number.isFinite(id)) {
        return String(id);
      }
    }

    return undefined;
  }

  private extractLeagueSeason(league: unknown): number | undefined {
    if (!league || typeof league !== 'object') {
      return undefined;
    }

    const season = (league as Record<string, unknown>)['season'];

    if (typeof season === 'number' && Number.isFinite(season)) {
      return season;
    }

    return undefined;
  }
}
