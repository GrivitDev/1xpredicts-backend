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

    try {
      await this.activeCompetitionService.refreshStatuses();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.warn(`Initial competition status refresh failed: ${message}`);
    }
  }

  // ============================================================
  // ODDS API
  // ============================================================

  private async initializeOddsData(): Promise<void> {
    /*
     * The application's supported competitions are the source
     * of truth for The Odds API.
     *
     * We do not use The Odds API /sports endpoint to determine
     * which leagues 2xPredict supports.
     *
     * Each competition should already contain its configured
     * Odds API sport key.
     */
    const competitions = this.supportedCompetitionService.getOddsEnabled();

    const sportKeys = [
      ...new Set(
        competitions
          .map((competition) => competition.providers.oddsApiSportKey)
          .filter(
            (sportKey): sportKey is string =>
              typeof sportKey === 'string' && sportKey.trim().length > 0,
          ),
      ),
    ];

    if (!sportKeys.length) {
      this.logger.warn(
        'No Odds API sport keys are configured for the enabled competitions',
      );

      return;
    }

    this.logger.log(
      `Initializing Odds API data for ${sportKeys.length} configured competitions`,
    );

    // ==========================================================
    // EVENTS
    // ==========================================================

    for (const sportKey of sportKeys) {
      try {
        await this.sportsCollectionService.collectOddsEvents(sportKey);

        this.logger.log(`Initial Odds events collected: ${sportKey}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        this.logger.warn(
          `Initial Odds events collection failed for ${sportKey}: ${message}`,
        );
      }
    }

    // ==========================================================
    // SCORES
    // ==========================================================

    for (const sportKey of sportKeys) {
      try {
        await this.sportsCollectionService.collectOddsScores(sportKey, 3);

        this.logger.log(`Initial Odds scores collected: ${sportKey}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        this.logger.warn(
          `Initial Odds scores collection failed for ${sportKey}: ${message}`,
        );
      }
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
    try {
      await this.youtubeHighlightService.processNext();

      this.logger.log('Initial YouTube highlight job processed');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.warn(`Initial YouTube worker failed: ${message}`);
    }
  }
}
