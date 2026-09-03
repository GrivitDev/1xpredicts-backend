import { Injectable, Logger } from '@nestjs/common';

import { SupportedCompetitionService } from './supported-competition.service';

import { SportsCollectionService } from './sports-collection.service';

import { ApiFootballQueueBuilderService } from './api-football-queue-builder.service';

import { ActiveCompetitionService } from './active-competition.service';

import { YoutubeHighlightService } from './youtube-highlight.service';

import { OddsApiSport } from '../providers/the-odds-api.interfaces';

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
  // ODDS API
  // ============================================================

  private async initializeOddsData(): Promise<void> {
    let discoveredSports: OddsApiSport[] = [];

    /*
     * First discover the sports/competition keys supported by
     * The Odds API.
     *
     * This is important because "soccer" is NOT a valid Odds API
     * sport key. The API returns keys such as:
     *
     * soccer_epl
     * soccer_italy_serie_a
     * soccer_germany_bundesliga
     * soccer_uefa_champs_league
     *
     * The discovered list is persisted by SportsCollectionService.
     */
    try {
      discoveredSports = await this.sportsCollectionService.collectOddsSports();

      this.logger.log(
        `Initial Odds API discovery completed: ${discoveredSports.length} sports discovered`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.warn(`Initial Odds sports collection failed: ${message}`);

      return;
    }

    if (!discoveredSports.length) {
      this.logger.warn(
        'The Odds API returned no sports during startup discovery',
      );

      return;
    }

    /*
     * Only use active sport keys returned by The Odds API.
     */
    const availableSportKeys = new Set(
      discoveredSports
        .filter((sport) => sport.active === true)
        .map((sport) => sport.key),
    );

    /*
     * Get the competitions that the application has explicitly
     * configured for The Odds API.
     *
     * The application mapping remains authoritative. The Odds API
     * discovery is used to verify that those mappings currently
     * exist and are active.
     */
    const oddsCompetitions = this.supportedCompetitionService.getOddsEnabled();

    const configuredSportKeys = [
      ...new Set(
        oddsCompetitions
          .map((competition) => competition.providers.oddsApiSportKey)
          .filter(
            (sportKey): sportKey is string =>
              typeof sportKey === 'string' && sportKey.trim().length > 0,
          ),
      ),
    ];

    if (!configuredSportKeys.length) {
      this.logger.warn(
        'No Odds API sport keys are configured for the enabled competitions',
      );

      return;
    }

    /*
     * Only collect competitions that:
     *
     * 1. Are configured by 2xPredict.
     * 2. Exist in the current Odds API sports discovery.
     * 3. Are currently active.
     */
    const availableConfiguredSportKeys = configuredSportKeys.filter(
      (sportKey) => availableSportKeys.has(sportKey),
    );

    /*
     * Report mappings that are configured locally but are not
     * currently available from The Odds API.
     */
    const unavailableConfiguredSportKeys = configuredSportKeys.filter(
      (sportKey) => !availableSportKeys.has(sportKey),
    );

    if (unavailableConfiguredSportKeys.length) {
      this.logger.warn(
        `Configured Odds API sport keys currently unavailable: ${unavailableConfiguredSportKeys.join(
          ', ',
        )}`,
      );
    }

    if (!availableConfiguredSportKeys.length) {
      this.logger.warn(
        'No configured Odds API sport keys are currently available or active',
      );

      return;
    }

    this.logger.log(
      `Initializing Odds API data for ${availableConfiguredSportKeys.length} configured competitions`,
    );

    // ==========================================================
    // EVENTS
    // ==========================================================

    for (const sportKey of availableConfiguredSportKeys) {
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

    /*
     * Collect up to three days of scores so the initial cache
     * contains recent results as well as current score data.
     *
     * Individual unsupported competitions are isolated so one
     * failed sport key does not stop the remaining collections.
     */
    for (const sportKey of availableConfiguredSportKeys) {
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
