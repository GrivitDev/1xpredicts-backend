import { Injectable, Logger } from '@nestjs/common';

import { Cron } from '@nestjs/schedule';

import { SupportedCompetitionService } from '../services/supported-competition.service';

import { ActiveCompetitionService } from '../services/active-competition.service';

import { ApiFootballQueueBuilderService } from '../services/api-football-queue-builder.service';

import { SportsCollectionService } from '../services/sports-collection.service';

import { FootballDataService } from '../providers/football-data.service';

@Injectable()
export class SportsSourceScheduler {
  private readonly logger = new Logger(SportsSourceScheduler.name);

  constructor(
    private readonly supportedCompetitionService: SupportedCompetitionService,

    private readonly activeCompetitionService: ActiveCompetitionService,

    private readonly apiFootballQueueBuilderService: ApiFootballQueueBuilderService,

    private readonly sportsCollectionService: SportsCollectionService,

    private readonly footballDataService: FootballDataService,
  ) {}

  // ============================================================
  // DAILY ACTIVE COMPETITION STATUS
  // 10:45 PM
  // ============================================================

  @Cron('0 45 22 * * *', {
    name: 'sports-active-competition-status',
  })
  async refreshActiveCompetitionStatuses(): Promise<void> {
    try {
      await this.activeCompetitionService.refreshStatuses();
    } catch (error) {
      this.logger.error(
        'Failed to refresh active competition statuses',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ============================================================
  // DAILY SOURCE COLLECTION
  // 11:00 PM
  // ============================================================

  @Cron('0 0 23 * * *', {
    name: 'sports-daily-source-collection',
  })
  async runDailyCollection(): Promise<void> {
    this.logger.log('Starting daily sports source collection');

    const competitions = this.supportedCompetitionService
      .getEnabled()
      .filter((competition) => competition.gender !== 'WOMEN');

    // ----------------------------------------------------------
    // FOOTBALL-DATA
    // ----------------------------------------------------------

    for (const competition of competitions) {
      const code = competition.providers.footballDataCode;

      if (!code) {
        continue;
      }

      try {
        await this.sportsCollectionService.collectFootballDataCompetition(code);
      } catch (error) {
        this.logger.error(
          `Football-Data collection failed for ${competition.name}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    // ----------------------------------------------------------
    // API-FOOTBALL QUEUE
    // ----------------------------------------------------------

    try {
      const result =
        await this.apiFootballQueueBuilderService.buildDailyQueue();

      this.logger.log(
        `API-Football queue: ${result.queued} queued, ${result.skipped} skipped, ${result.remainingQuota} requests remaining`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to build API-Football queue',
        error instanceof Error ? error.stack : String(error),
      );
    }

    // ----------------------------------------------------------
    // REFRESH ACTIVE STATUS
    // ----------------------------------------------------------

    await this.activeCompetitionService.refreshStatuses();

    this.logger.log('Daily sports source collection completed');
  }

  // ============================================================
  // WEEKLY SEASON REGISTRY
  // TUESDAY 11:30 PM
  // ============================================================

  @Cron('0 30 23 * * 2', {
    name: 'sports-weekly-season-refresh',
  })
  async refreshCompetitionSeasons(): Promise<void> {
    this.logger.log('Starting weekly competition season refresh');

    const competitions = this.supportedCompetitionService
      .getEnabled()
      .filter((competition) => competition.gender !== 'WOMEN');

    let updated = 0;

    for (const competition of competitions) {
      const code = competition.providers.footballDataCode;

      if (!code) {
        continue;
      }

      try {
        const data = await this.footballDataService.getCompetition(code);

        const season = data.currentSeason;

        if (!season) {
          continue;
        }

        const seasonStart = new Date(season.startDate);

        const seasonEnd = new Date(season.endDate);

        await this.activeCompetitionService.upsert(competition, {
          season: season.id,

          seasonStartDate: seasonStart,

          seasonEndDate: seasonEnd,

          status: this.activeCompetitionService.calculateStatus(
            seasonStart,
            seasonEnd,
          ),
        });

        updated += 1;
      } catch (error) {
        this.logger.error(
          `Season refresh failed for ${competition.name}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    await this.activeCompetitionService.refreshStatuses();

    this.logger.log(`Weekly season refresh completed: ${updated} competitions`);
  }

  // ============================================================
  // ODDS EVENTS
  // EVERY 30 MINUTES
  // ============================================================

  @Cron('0 */30 * * * *', {
    name: 'sports-odds-events-collection',
  })
  async collectOddsEvents(): Promise<void> {
    const competitions = this.supportedCompetitionService.getOddsEnabled();

    /*
     * Only competitions with an explicit
     * Odds API sport key are collected.
     */

    const sportKeys = new Set<string>();

    for (const competition of competitions) {
      const sportKey = competition.providers.oddsApiSportKey;

      if (sportKey) {
        sportKeys.add(sportKey);
      }
    }

    for (const sportKey of sportKeys) {
      try {
        await this.sportsCollectionService.collectOddsEvents(sportKey);
      } catch (error) {
        this.logger.error(
          `Odds events collection failed for ${sportKey}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }

  // ============================================================
  // ODDS SNAPSHOTS
  // EVERY 5 MINUTES
  // ============================================================

  @Cron('0 */5 * * * *', {
    name: 'sports-odds-snapshot-collection',
  })
  async collectOddsSnapshots(): Promise<void> {
    const competitions = this.supportedCompetitionService.getOddsEnabled();

    const sportKeys = new Set<string>();

    for (const competition of competitions) {
      const sportKey = competition.providers.oddsApiSportKey;

      if (sportKey) {
        sportKeys.add(sportKey);
      }
    }

    for (const sportKey of sportKeys) {
      try {
        await this.sportsCollectionService.collectOdds(
          sportKey,
          'ng',
          'h2h,totals,spreads',
        );
      } catch (error) {
        this.logger.error(
          `Odds snapshot collection failed for ${sportKey}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }

  // ============================================================
  // ODDS SPORTS DISCOVERY
  // MONDAY 12:00 AM
  // ============================================================

  @Cron('0 0 0 * * 1', {
    name: 'sports-odds-sports-discovery',
  })
  async collectOddsSports(): Promise<void> {
    try {
      await this.sportsCollectionService.collectOddsSports();
    } catch (error) {
      this.logger.error(
        'Odds sports discovery failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
