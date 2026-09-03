import { Injectable, Logger } from '@nestjs/common';

import { SupportedCompetitionService } from './supported-competition.service';

import { SportsCollectionService } from './sports-collection.service';

import { ApiFootballQueueBuilderService } from './api-football-queue-builder.service';

import { ActiveCompetitionService } from './active-competition.service';

import { YoutubeHighlightService } from './youtube-highlight.service';

@Injectable()
export class SportsStartupService {
  private readonly logger = new Logger(SportsStartupService.name);

  private hasRun = false;

  constructor(
    private readonly supportedCompetitionService: SupportedCompetitionService,

    private readonly sportsCollectionService: SportsCollectionService,

    private readonly apiFootballQueueBuilderService: ApiFootballQueueBuilderService,

    private readonly activeCompetitionService: ActiveCompetitionService,

    private readonly youtubeHighlightService: YoutubeHighlightService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.hasRun) {
      return;
    }

    this.hasRun = true;

    try {
      this.logger.log('Sports startup bootstrap started');

      await this.initializeCompetitionData();

      await this.initializeOddsData();

      await this.initializeApiFootballQueue();

      await this.initializeApiFootballWorker();

      await this.initializeYoutubeWorker();

      this.logger.log('Sports startup bootstrap completed');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(`Sports startup bootstrap failed: ${message}`);
    }
  }

  // ============================================================
  // COMPETITIONS
  // ============================================================

  private async initializeCompetitionData(): Promise<void> {
    const competitions = this.supportedCompetitionService.getAll();

    this.logger.log(
      `Initializing ${competitions.length} supported competitions`,
    );

    /*
     * Football-Data competitions can be collected immediately
     * because their competition codes are already configured.
     *
     * Other providers are intentionally handled only when their
     * provider mappings and season/activity information exist.
     */
    for (const competition of competitions) {
      if (!competition.enabled) {
        continue;
      }

      const footballDataCode = competition.providers.footballDataCode;

      if (!footballDataCode) {
        continue;
      }

      try {
        await this.sportsCollectionService.collectFootballDataCompetition(
          footballDataCode,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        this.logger.warn(
          `Initial collection failed for ${competition.id}: ${message}`,
        );
      }
    }

    /*
     * Refresh the known active-competition records after the
     * first source collection.
     */
    try {
      await this.activeCompetitionService.refreshStatuses();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.warn(`Initial competition status refresh failed: ${message}`);
    }
  }

  // ============================================================
  // ODDS
  // ============================================================

  private async initializeOddsData(): Promise<void> {
    try {
      await this.sportsCollectionService.collectOddsSports();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.warn(`Initial Odds sports collection failed: ${message}`);
    }

    /*
     * Soccer is the application's live football category.
     */
    try {
      await this.sportsCollectionService.collectOddsEvents('soccer');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.warn(`Initial Odds events collection failed: ${message}`);
    }

    try {
      await this.sportsCollectionService.collectOddsScores('soccer', 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.warn(`Initial Odds scores collection failed: ${message}`);
    }
  }

  // ============================================================
  // API-FOOTBALL QUEUE
  // ============================================================

  private async initializeApiFootballQueue(): Promise<void> {
    try {
      await this.apiFootballQueueBuilderService.buildDailyQueue();

      this.logger.log('Initial API-Football queue built');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.warn(`Initial API-Football queue build failed: ${message}`);
    }
  }

  // ============================================================
  // API-FOOTBALL WORKER
  // ============================================================

  private async initializeApiFootballWorker(): Promise<void> {
    /*
     * Process the first queued job immediately instead of
     * waiting for the first one-minute cron tick.
     *
     * The normal scheduler continues processing the remaining
     * queue every minute.
     */
    try {
      const processed =
        await this.sportsCollectionService.processNextApiFootballJob();

      if (processed) {
        this.logger.log('Initial API-Football queue job processed');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.warn(`Initial API-Football worker failed: ${message}`);
    }
  }

  // ============================================================
  // YOUTUBE
  // ============================================================

  private async initializeYoutubeWorker(): Promise<void> {
    /*
     * Your normal YouTube scheduler continues every 20 minutes.
     * This simply gives the queue its first immediate opportunity.
     */
    try {
      await this.youtubeHighlightService.processNext();

      this.logger.log('Initial YouTube highlight job processed');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.warn(`Initial YouTube worker failed: ${message}`);
    }
  }
}
