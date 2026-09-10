import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  EspnFixture,
  EspnFixtureDocument,
} from '../schemas/espn/espn-fixture.schema';

import {
  EspnLeague,
  EspnLeagueDocument,
} from '../schemas/espn/espn-league.schema';

import { CompetitionPriority } from '../enums/competition-priority.enum';

import { EspnQueueService } from './espn-queue.service';
import { EspnActiveCompetitionService } from './espn-active-competition.service';

@Injectable()
export class EspnQueueBuilderService {
  private readonly logger = new Logger(EspnQueueBuilderService.name);

  private readonly upcomingWindowDays = 4;

  private readonly finishedLookbackHours = 12;

  private readonly finishedDelayHours = 3;

  constructor(
    private readonly espnQueueService: EspnQueueService,

    private readonly espnActiveCompetitionService: EspnActiveCompetitionService,

    @InjectModel(EspnFixture.name)
    private readonly espnFixtureModel: Model<EspnFixtureDocument>,

    @InjectModel(EspnLeague.name)
    private readonly espnLeagueModel: Model<EspnLeagueDocument>,
  ) {}

  // ============================================================
  // INITIAL LEAGUE QUEUE
  // ============================================================

  /**
   * Build the initial league-refresh queue after:
   *
   * 1. ESPN catalogue discovery
   * 2. ESPN league detail discovery
   * 3. Current-season identification
   * 4. Active-season identification
   * 5. Priority classification
   *
   * Only leagues whose current season is active are queued.
   *
   * The stored catalogue is already sorted by:
   *
   * ELITE
   * HIGH
   * REGIONAL
   * SELECTIVE
   */
  async buildInitialLeagueQueue(): Promise<{
    queued: number;
    skipped: number;
  }> {
    const leagues = await this.espnActiveCompetitionService.getActiveLeagues();

    let queued = 0;
    let skipped = 0;

    for (const league of leagues) {
      /*
       * Activity has already been determined by the league-detail
       * synchronization. This service does not determine it again.
       */
      if (!league.isActive) {
        skipped += 1;
        continue;
      }

      if (!this.hasUsableSeason(league)) {
        skipped += 1;

        this.logger.debug(
          `Skipping active ESPN league ${league.leagueId} because ` +
            `no usable season is stored`,
        );

        continue;
      }

      const priority = this.getQueuePriority(this.getLeaguePriority(league));

      try {
        const job = await this.espnQueueService.addLeagueRefreshJob({
          leagueId: league.leagueId,
          season: league.season,
          priority,
          scheduledFor: new Date(),
        });

        if (job) {
          queued += 1;
        } else {
          skipped += 1;
        }
      } catch (error) {
        skipped += 1;

        this.logger.warn(
          `Unable to queue ESPN league ${league.leagueId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    this.logger.log(
      `Initial ESPN league queue built: queued=${queued}, skipped=${skipped}`,
    );

    return {
      queued,
      skipped,
    };
  }

  // ============================================================
  // MATCH QUEUE
  // ============================================================

  /**
   * Build upcoming and recently finished match jobs from the
   * locally stored ESPN fixture database.
   *
   * This runs after league refreshes have populated fixtures.
   *
   * Only fixtures belonging to currently active ESPN leagues
   * are converted into match jobs.
   */
  async buildMatchQueue(): Promise<{
    upcoming: number;
    finished: number;
  }> {
    const now = new Date();

    const upcomingUntil = new Date(
      now.getTime() + this.upcomingWindowDays * 24 * 60 * 60 * 1000,
    );

    const finishedSince = new Date(
      now.getTime() - this.finishedLookbackHours * 60 * 60 * 1000,
    );

    const [upcomingFixtures, finishedFixtures] = await Promise.all([
      this.espnFixtureModel
        .find({
          fixtureDate: {
            $gte: now,
            $lte: upcomingUntil,
          },
        })
        .sort({
          fixtureDate: 1,
        })
        .lean()
        .exec(),

      this.espnFixtureModel
        .find({
          fixtureDate: {
            $gte: finishedSince,
            $lte: now,
          },

          status: {
            $in: ['FINAL', 'FINISHED', 'POST', 'FT'],
          },
        })
        .sort({
          fixtureDate: 1,
        })
        .lean()
        .exec(),
    ]);

    let upcoming = 0;
    let finished = 0;

    for (const fixture of upcomingFixtures) {
      if (!(await this.isActiveLeague(fixture.leagueId))) {
        continue;
      }

      if (await this.addUpcomingFixtureJob(fixture)) {
        upcoming += 1;
      }
    }

    for (const fixture of finishedFixtures) {
      if (!(await this.isActiveLeague(fixture.leagueId))) {
        continue;
      }

      if (await this.addFinishedFixtureJob(fixture)) {
        finished += 1;
      }
    }

    return {
      upcoming,
      finished,
    };
  }

  // ============================================================
  // LEAGUE MATCH JOBS
  // ============================================================

  /**
   * Build match jobs after a league's initial league-refresh job
   * has collected its fixtures.
   */
  async buildLeagueMatchJobs(
    leagueId: string,
    season?: number,
  ): Promise<{
    upcoming: number;
    finished: number;
  }> {
    const league =
      await this.espnActiveCompetitionService.getByLeagueId(leagueId);

    if (!league || !league.isActive) {
      return {
        upcoming: 0,
        finished: 0,
      };
    }

    const effectiveSeason = typeof season === 'number' ? season : league.season;

    const now = new Date();

    const upcomingUntil = new Date(
      now.getTime() + this.upcomingWindowDays * 24 * 60 * 60 * 1000,
    );

    const finishedSince = new Date(
      now.getTime() - this.finishedLookbackHours * 60 * 60 * 1000,
    );

    const seasonFilter: Record<string, unknown> = {};

    if (typeof effectiveSeason === 'number') {
      seasonFilter.season = effectiveSeason;
    }

    const [upcomingFixtures, finishedFixtures] = await Promise.all([
      this.espnFixtureModel
        .find({
          leagueId: league.leagueId,

          ...seasonFilter,

          fixtureDate: {
            $gte: now,
            $lte: upcomingUntil,
          },
        })
        .sort({
          fixtureDate: 1,
        })
        .lean()
        .exec(),

      this.espnFixtureModel
        .find({
          leagueId: league.leagueId,

          ...seasonFilter,

          fixtureDate: {
            $gte: finishedSince,
            $lte: now,
          },

          status: {
            $in: ['FINAL', 'FINISHED', 'POST', 'FT'],
          },
        })
        .sort({
          fixtureDate: 1,
        })
        .lean()
        .exec(),
    ]);

    let upcoming = 0;
    let finished = 0;

    for (const fixture of upcomingFixtures) {
      if (await this.addUpcomingFixtureJob(fixture)) {
        upcoming += 1;
      }
    }

    for (const fixture of finishedFixtures) {
      if (await this.addFinishedFixtureJob(fixture)) {
        finished += 1;
      }
    }

    return {
      upcoming,
      finished,
    };
  }

  // ============================================================
  // PRIORITY / ACTIVITY
  // ============================================================

  private async isActiveLeague(leagueId: string): Promise<boolean> {
    const league =
      await this.espnActiveCompetitionService.getByLeagueId(leagueId);

    return Boolean(league?.isActive);
  }

  private getLeaguePriority(league: EspnLeagueDocument): CompetitionPriority {
    if (Object.values(CompetitionPriority).includes(league.priority)) {
      return league.priority;
    }

    return CompetitionPriority.SELECTIVE;
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
      default:
        return 4;
    }
  }

  // ============================================================
  // UPCOMING
  // ============================================================

  private async addUpcomingFixtureJob(
    fixture: EspnFixtureDocument,
  ): Promise<boolean> {
    if (!fixture.eventId) {
      return false;
    }

    if (typeof fixture.season !== 'number') {
      return false;
    }

    const priority = await this.getFixtureQueuePriority(fixture.leagueId);

    if (priority === null) {
      return false;
    }

    const scheduledFor = fixture.fixtureDate
      ? new Date(fixture.fixtureDate)
      : new Date();

    const job = await this.espnQueueService.addUpcomingMatchJob({
      leagueId: fixture.leagueId,
      eventId: fixture.eventId,
      season: fixture.season,
      priority,
      scheduledFor,
    });

    return Boolean(job);
  }

  // ============================================================
  // FINISHED
  // ============================================================

  private async addFinishedFixtureJob(
    fixture: EspnFixtureDocument,
  ): Promise<boolean> {
    if (!fixture.eventId) {
      return false;
    }

    if (typeof fixture.season !== 'number') {
      return false;
    }

    const priority = await this.getFixtureQueuePriority(fixture.leagueId);

    if (priority === null) {
      return false;
    }

    const fixtureDate = fixture.fixtureDate
      ? new Date(fixture.fixtureDate)
      : new Date();

    const scheduledFor = new Date(
      fixtureDate.getTime() + this.finishedDelayHours * 60 * 60 * 1000,
    );

    if (scheduledFor.getTime() < Date.now()) {
      scheduledFor.setTime(Date.now());
    }

    const job = await this.espnQueueService.addFinishedMatchJob({
      leagueId: fixture.leagueId,
      eventId: fixture.eventId,
      season: fixture.season,
      priority,
      scheduledFor,
    });

    return Boolean(job);
  }

  private async getFixtureQueuePriority(
    leagueId: string,
  ): Promise<number | null> {
    const league =
      await this.espnActiveCompetitionService.getByLeagueId(leagueId);

    if (!league || !league.isActive) {
      return null;
    }

    return this.getQueuePriority(this.getLeaguePriority(league));
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private hasUsableSeason(league: EspnLeagueDocument): boolean {
    return typeof league.season === 'number' && Number.isFinite(league.season);
  }
}
