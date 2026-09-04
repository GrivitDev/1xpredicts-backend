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
  // ============================================================

  @Cron('0 30 0 * * 1')
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
  // ============================================================

  @Cron('0 0 1 * * *')
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
  // ============================================================

  @Cron('0 30 2 * * 1')
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
  // Refresh a small batch of recently completed
  // events. The provider rate limiter controls the
  // actual one-request-per-60-seconds spacing.
  // ============================================================

  @Cron('0 0 */6 * * *')
  async refreshCompletedEvents(): Promise<void> {
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
  // LIVE EVENT DETAILS
  //
  // Target recently scheduled/live events so the
  // detailed event data stays reasonably fresh.
  // ============================================================

  @Cron('0 */30 * * * *')
  async refreshRecentEvents(): Promise<void> {
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
  // WEEKLY PLAYER / VENUE REFRESH
  //
  // Uses already-known teams and players from MongoDB.
  // ============================================================

  @Cron('0 30 3 * * 1')
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
