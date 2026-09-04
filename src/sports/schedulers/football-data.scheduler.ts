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
  // COLLECTION WINDOW: 1:00 PM - 2:00 AM WAT
  // ============================================================

  @Cron('0 15 13-23/2 * * *', {
    name: 'football-data-competition-collection-afternoon',
    timeZone: 'Africa/Lagos',
  })
  async collectNextCompetitionAfternoon(): Promise<void> {
    await this.collectNextCompetition();
  }

  @Cron('0 15 0-1/2 * * *', {
    name: 'football-data-competition-collection-night',
    timeZone: 'Africa/Lagos',
  })
  async collectNextCompetitionNight(): Promise<void> {
    await this.collectNextCompetition();
  }

  private async collectNextCompetition(): Promise<void> {
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

      const collectionSlot = this.getCollectionSlot(hour);

      const competition = relevant[collectionSlot % relevant.length];

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
  // MONDAY 1:00 PM WAT
  // ============================================================

  @Cron('0 0 13 * * 1', {
    name: 'football-data-season-refresh',
    timeZone: 'Africa/Lagos',
  })
  async refreshSeason(): Promise<void> {
    try {
      const available = await this.footballDataService.getCompetitions();

      const relevant = this.getRelevantCompetitions(available);

      if (!relevant.length) {
        this.logger.warn(
          'Football-Data season refresh found no relevant competitions',
        );

        return;
      }

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
  // COLLECTION SLOT
  // ============================================================

  private getCollectionSlot(hour: number): number {
    /*
     * Collection window:
     *
     * 13:00 - 14:00 -> slot 0
     * 15:00 - 16:00 -> slot 1
     * 17:00 - 18:00 -> slot 2
     * 19:00 - 20:00 -> slot 3
     * 21:00 - 22:00 -> slot 4
     * 23:00 - 00:00 -> slot 5
     * 01:00 - 02:00 -> slot 6
     *
     * This keeps the competition rotation independent
     * of the absolute hour of the day.
     */

    if (hour >= 13) {
      return Math.floor((hour - 13) / 2);
    }

    return 5 + Math.floor(hour / 2);
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
