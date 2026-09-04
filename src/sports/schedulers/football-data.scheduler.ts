import { Injectable, Logger } from '@nestjs/common';

import { Cron } from '@nestjs/schedule';

import { FootballDataCompetition } from '../providers/football-data.interfaces';

import { FootballDataService } from '../providers/football-data.service';

import { SportsCollectionService } from '../services/sports-collection.service';

import { FOOTBALL_DATA_COVERAGE } from '../config/football-data-coverage.config';

@Injectable()
export class FootballDataScheduler {
  private readonly logger = new Logger(FootballDataScheduler.name);

  constructor(
    private readonly footballDataService: FootballDataService,

    private readonly sportsCollectionService: SportsCollectionService,
  ) {}

  // ============================================================
  // COMPETITION DATA
  // EVERY 2 HOURS
  // ============================================================

  @Cron('0 15 */2 * * *', {
    name: 'football-data-competition-collection',
  })
  async collectNextCompetition(): Promise<void> {
    try {
      const available = await this.footballDataService.getCompetitions();

      const relevant = this.getRelevantCompetitions(available);

      if (!relevant.length) {
        this.logger.warn(
          'Football-Data returned no relevant supported competitions',
        );

        return;
      }

      const hour = new Date().getHours();

      const slot = Math.floor(hour / 2);

      const competition = relevant[slot % relevant.length];

      await this.sportsCollectionService.collectFootballDataCompetition(
        competition.code!,
      );

      this.logger.log(
        `Football-Data collection completed for ${competition.code} (${competition.name})`,
      );
    } catch (error) {
      this.logger.error(
        'Football-Data competition collection failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ============================================================
  // WEEKLY SEASON REFRESH
  // MONDAY 1:00 AM
  // ============================================================

  @Cron('0 0 1 * * 1', {
    name: 'football-data-season-refresh',
  })
  async refreshSeason(): Promise<void> {
    try {
      const available = await this.footballDataService.getCompetitions();

      const relevant = this.getRelevantCompetitions(available);

      if (!relevant.length) {
        return;
      }

      /*
       * One competition is refreshed per weekly execution.
       * The normal two-hour collector continues to refresh
       * competition data during the week.
       */
      const competition = relevant[0];

      await this.sportsCollectionService.collectFootballDataCompetition(
        competition.code!,
      );

      this.logger.log(
        `Football-Data season refresh completed for ${competition.code}`,
      );
    } catch (error) {
      this.logger.error(
        'Football-Data season refresh failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ============================================================
  // RELEVANT COMPETITIONS
  // ============================================================

  private getRelevantCompetitions(
    available: FootballDataCompetition[],
  ): FootballDataCompetition[] {
    const configuredCodes = new Set(
      FOOTBALL_DATA_COVERAGE.map((item) => item.code.toUpperCase()),
    );

    return available
      .filter(
        (competition) =>
          competition.code !== null &&
          configuredCodes.has(competition.code.toUpperCase()),
      )
      .sort((a, b) => {
        const aIndex = FOOTBALL_DATA_COVERAGE.findIndex(
          (item) => item.code.toUpperCase() === a.code?.toUpperCase(),
        );

        const bIndex = FOOTBALL_DATA_COVERAGE.findIndex(
          (item) => item.code.toUpperCase() === b.code?.toUpperCase(),
        );

        return aIndex - bIndex;
      });
  }
}
