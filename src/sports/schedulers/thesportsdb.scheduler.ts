import { Injectable, Logger } from '@nestjs/common';

import { Cron } from '@nestjs/schedule';

import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import { SportsCollectionService } from '../services/sports-collection.service';

import {
  ActiveCompetition,
  ActiveCompetitionDocument,
} from '../schemas/active-competition.schema';

import {
  TheSportsDbEvent,
  TheSportsDbEventDocument,
} from '../schemas/thesportsdb/thesportsdb-event.schema';

@Injectable()
export class ThesportsdbScheduler {
  private readonly logger = new Logger(ThesportsdbScheduler.name);

  constructor(
    private readonly sportsCollectionService: SportsCollectionService,

    @InjectModel(ActiveCompetition.name)
    private readonly activeCompetitionModel: Model<ActiveCompetitionDocument>,

    @InjectModel(TheSportsDbEvent.name)
    private readonly theSportsDbEventModel: Model<TheSportsDbEventDocument>,
  ) {}

  // ============================================================
  // WEEKLY SEASON REFRESH
  // MONDAY 1:30 PM WAT
  // ============================================================

  @Cron('0 30 13 * * 1', {
    name: 'thesportsdb-season-refresh',
    timeZone: 'Africa/Lagos',
  })
  async refreshSeasons(): Promise<void> {
    const competitions = await this.getEligibleCompetitions();

    for (const competition of competitions) {
      if (
        competition.sportsDbLeagueId === undefined ||
        competition.season === undefined
      ) {
        continue;
      }

      try {
        const season = String(competition.season);

        await this.sportsCollectionService.collectTheSportsDbSeason(
          competition.sportsDbLeagueId,
          season,
        );
      } catch (error) {
        this.logError(
          `Season refresh failed for league ${competition.sportsDbLeagueId}`,
          error,
        );
      }
    }
  }

  // ============================================================
  // DAILY SEASON EVENTS
  // 2:00 PM WAT
  // ============================================================

  @Cron('0 0 14 * * *', {
    name: 'thesportsdb-season-events',
    timeZone: 'Africa/Lagos',
  })
  async refreshSeasonEvents(): Promise<void> {
    const competitions = await this.getEligibleCompetitions();

    for (const competition of competitions) {
      if (
        competition.sportsDbLeagueId === undefined ||
        competition.season === undefined
      ) {
        continue;
      }

      try {
        const season = String(competition.season);

        await this.sportsCollectionService.collectTheSportsDbSeasonEvents(
          competition.sportsDbLeagueId,
          season,
        );
      } catch (error) {
        this.logError(
          `Season events refresh failed for league ${competition.sportsDbLeagueId}`,
          error,
        );
      }
    }
  }

  // ============================================================
  // WEEKLY TEAMS
  // MONDAY 3:00 PM WAT
  // ============================================================

  @Cron('0 0 15 * * 1', {
    name: 'thesportsdb-team-refresh',
    timeZone: 'Africa/Lagos',
  })
  async refreshTeams(): Promise<void> {
    const competitions = await this.getEligibleCompetitions();

    for (const competition of competitions) {
      if (competition.sportsDbLeagueId === undefined) {
        continue;
      }

      try {
        await this.sportsCollectionService.collectTheSportsDbTeams(
          competition.sportsDbLeagueId,
        );
      } catch (error) {
        this.logError(
          `Team refresh failed for league ${competition.sportsDbLeagueId}`,
          error,
        );
      }
    }
  }

  // ============================================================
  // TARGETED COMPLETED EVENTS
  //
  // Every 6 hours during the collection window.
  //
  // 3:00 PM
  // 9:00 PM
  // 1:00 AM
  //
  // Recently completed events receive detailed refreshes.
  // ============================================================

  @Cron('0 0 15,21 * * *', {
    name: 'thesportsdb-completed-events-day',
    timeZone: 'Africa/Lagos',
  })
  async refreshCompletedEventsDay(): Promise<void> {
    await this.refreshCompletedEvents();
  }

  @Cron('0 0 1 * * *', {
    name: 'thesportsdb-completed-events-night',
    timeZone: 'Africa/Lagos',
  })
  async refreshCompletedEventsNight(): Promise<void> {
    await this.refreshCompletedEvents();
  }

  private async refreshCompletedEvents(): Promise<void> {
    const now = new Date();

    const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const to = now;

    const events = await this.theSportsDbEventModel
      .find({
        eventDate: {
          $gte: from,
          $lte: to,
        },
      })
      .sort({
        eventDate: -1,
      })
      .limit(10)
      .lean()
      .exec();

    for (const event of events) {
      if (event.eventId === undefined || event.eventId === null) {
        continue;
      }

      try {
        await this.refreshCompletedEvent(event.eventId);
      } catch (error) {
        this.logError(
          `Completed event refresh failed for event ${event.eventId}`,
          error,
        );
      }
    }
  }

  // ============================================================
  // RECENT / LIVE EVENT DETAILS
  //
  // Every 30 minutes during the collection window.
  //
  // This keeps event and timeline information fresh without
  // making requests outside the collection period.
  // ============================================================

  @Cron('0 */30 13-23 * * *', {
    name: 'thesportsdb-recent-events-day',
    timeZone: 'Africa/Lagos',
  })
  async refreshRecentEventsDay(): Promise<void> {
    await this.refreshRecentEvents();
  }

  @Cron('0 */30 0-1 * * *', {
    name: 'thesportsdb-recent-events-night',
    timeZone: 'Africa/Lagos',
  })
  async refreshRecentEventsNight(): Promise<void> {
    await this.refreshRecentEvents();
  }

  private async refreshRecentEvents(): Promise<void> {
    const now = new Date();

    const from = new Date(now.getTime() - 3 * 60 * 60 * 1000);

    const to = new Date(now.getTime() + 12 * 60 * 60 * 1000);

    const events = await this.theSportsDbEventModel
      .find({
        eventDate: {
          $gte: from,
          $lte: to,
        },
      })
      .sort({
        eventDate: 1,
      })
      .limit(5)
      .lean()
      .exec();

    for (const event of events) {
      if (event.eventId === undefined || event.eventId === null) {
        continue;
      }

      try {
        await this.sportsCollectionService.collectTheSportsDbEvent(
          event.eventId,
        );

        await this.sportsCollectionService.collectTheSportsDbTimeline(
          event.eventId,
        );
      } catch (error) {
        this.logError(
          `Recent event refresh failed for event ${event.eventId}`,
          error,
        );
      }
    }
  }

  // ============================================================
  // WEEKLY PLAYER REFRESH
  // MONDAY 4:00 PM WAT
  // ============================================================

  @Cron('0 0 16 * * 1', {
    name: 'thesportsdb-player-refresh',
    timeZone: 'Africa/Lagos',
  })
  async refreshPlayersAndVenues(): Promise<void> {
    const teams = await this.getTeamsForEligibleCompetitions();

    for (const team of teams) {
      if (team.teamId === undefined || team.teamId === null) {
        continue;
      }

      try {
        await this.sportsCollectionService.collectTheSportsDbPlayers(
          team.teamId,
        );
      } catch (error) {
        this.logError(`Player refresh failed for team ${team.teamId}`, error);
      }
    }
  }

  // ============================================================
  // ELIGIBLE COMPETITIONS
  // ============================================================

  private async getEligibleCompetitions(): Promise<
    ActiveCompetitionDocument[]
  > {
    return this.activeCompetitionModel
      .find({
        sportsDbLeagueId: {
          $exists: true,
          $ne: null,
        },
      })
      .sort({
        priority: 1,
      })
      .lean()
      .exec();
  }

  // ============================================================
  // KNOWN TEAMS
  // ============================================================

  private async getTeamsForEligibleCompetitions(): Promise<
    Array<{
      teamId: number;
      leagueId: number;
    }>
  > {
    const competitions = await this.getEligibleCompetitions();

    const leagueIds = competitions
      .map((competition) => competition.sportsDbLeagueId)
      .filter(
        (leagueId): leagueId is number =>
          leagueId !== undefined && leagueId !== null,
      );

    if (!leagueIds.length) {
      return [];
    }

    const teams = await this.theSportsDbEventModel
      .aggregate([
        {
          $match: {
            leagueId: {
              $in: leagueIds,
            },
          },
        },
        {
          $project: {
            teamIds: ['$homeTeamId', '$awayTeamId'],
            leagueId: 1,
          },
        },
        {
          $unwind: '$teamIds',
        },
        {
          $match: {
            teamIds: {
              $gt: 0,
            },
          },
        },
        {
          $group: {
            _id: {
              teamId: '$teamIds',
              leagueId: '$leagueId',
            },
          },
        },
        {
          $project: {
            _id: 0,
            teamId: '$_id.teamId',
            leagueId: '$_id.leagueId',
          },
        },
      ])
      .exec();

    return teams as Array<{
      teamId: number;
      leagueId: number;
    }>;
  }

  // ============================================================
  // COMPLETED EVENT REFRESH
  // ============================================================

  private async refreshCompletedEvent(eventId: number): Promise<void> {
    await this.sportsCollectionService.collectTheSportsDbEvent(eventId);

    await this.sportsCollectionService.collectTheSportsDbEventResults(eventId);

    await this.sportsCollectionService.collectTheSportsDbTimeline(eventId);

    await this.sportsCollectionService.collectTheSportsDbLineup(eventId);

    await this.sportsCollectionService.collectTheSportsDbStatistics(eventId);
  }

  // ============================================================
  // ERROR HANDLING
  // ============================================================

  private logError(message: string, error: unknown): void {
    const details = error instanceof Error ? error.message : String(error);

    this.logger.error(`${message}: ${details}`);
  }
}
