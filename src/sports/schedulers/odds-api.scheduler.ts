import { Injectable, Logger } from '@nestjs/common';

import { Cron } from '@nestjs/schedule';

import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import { CompetitionPriority } from '../enums/competition-priority.enum';

import { SupportedCompetitionService } from '../services/supported-competition.service';

import { SportsCollectionService } from '../services/sports-collection.service';

import { ActiveCompetitionService } from '../services/active-competition.service';

import {
  ApiFootballFixture,
  ApiFootballFixtureDocument,
} from '../schemas/api-football/api-football-fixture.schema';

@Injectable()
export class OddsApiScheduler {
  private readonly logger = new Logger(OddsApiScheduler.name);

  private readonly predictionWindowDays = 10;

  constructor(
    private readonly supportedCompetitionService: SupportedCompetitionService,

    private readonly sportsCollectionService: SportsCollectionService,

    private readonly activeCompetitionService: ActiveCompetitionService,

    @InjectModel(ApiFootballFixture.name)
    private readonly apiFootballFixtureModel: Model<ApiFootballFixtureDocument>,
  ) {}

  // ============================================================
  // SPORTS DISCOVERY
  // MONDAY 1:05 PM WAT
  // ============================================================

  @Cron('0 5 13 * * 1', {
    name: 'odds-api-sports-discovery',
    timeZone: 'Africa/Lagos',
  })
  async discoverSports(): Promise<void> {
    try {
      await this.sportsCollectionService.collectOddsSports();

      this.logger.log('Odds API sports discovery completed');
    } catch (error) {
      this.logger.error(
        'Odds API sports discovery failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ============================================================
  // EVENTS
  // DAILY
  // 1:15 PM WAT
  //
  // Collects the sport with the highest-priority upcoming
  // supported competition.
  // ============================================================

  @Cron('0 15 13 * * *', {
    name: 'odds-api-events',
    timeZone: 'Africa/Lagos',
  })
  async collectEvents(): Promise<void> {
    try {
      const sportKey = await this.selectSportKey(0);

      if (!sportKey) {
        this.logger.log(
          'No Odds API sport key has an upcoming supported fixture',
        );

        return;
      }

      await this.sportsCollectionService.collectOddsEvents(sportKey);

      this.logger.log(`Odds API events collected for ${sportKey}`);
    } catch (error) {
      this.logger.error(
        'Odds API events collection failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ============================================================
  // TARGETED ODDS
  //
  // Runs throughout the collection window.
  //
  // The scheduler rotates through eligible competitions instead
  // of repeatedly requesting the same sport.
  //
  // Actual API calls remain controlled by the central provider
  // rate limiter and monthly quota.
  // ============================================================

  @Cron('0 15 15-23/2 * * *', {
    name: 'odds-api-targeted-odds-afternoon',
    timeZone: 'Africa/Lagos',
  })
  async collectTargetedOddsAfternoon(): Promise<void> {
    await this.collectTargetedOdds();
  }

  @Cron('0 15 1 * * *', {
    name: 'odds-api-targeted-odds-night',
    timeZone: 'Africa/Lagos',
  })
  async collectTargetedOddsNight(): Promise<void> {
    await this.collectTargetedOdds();
  }

  private async collectTargetedOdds(): Promise<void> {
    try {
      const hour = new Date().getHours();

      const slot = this.getCollectionSlot(hour);

      const sportKey = await this.selectSportKey(slot);

      if (!sportKey) {
        this.logger.log(
          'No Odds API sport key has an upcoming supported fixture',
        );

        return;
      }

      await this.sportsCollectionService.collectOdds(
        sportKey,
        'ng',
        'h2h,totals,spreads',
      );

      this.logger.log(`Targeted Odds API odds collected for ${sportKey}`);
    } catch (error) {
      this.logger.error(
        'Odds API odds collection failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ============================================================
  // LATE-STAGE SCORES
  //
  // Scores are more useful toward the end of the collection
  // window, after matches have had time to finish.
  // ============================================================

  @Cron('0 15 23 * * *', {
    name: 'odds-api-scores-late',
    timeZone: 'Africa/Lagos',
  })
  async collectScoresLate(): Promise<void> {
    await this.collectScores();
  }

  @Cron('0 15 1 * * *', {
    name: 'odds-api-scores-final',
    timeZone: 'Africa/Lagos',
  })
  async collectScoresFinal(): Promise<void> {
    await this.collectScores();
  }

  private async collectScores(): Promise<void> {
    try {
      const sportKey = await this.selectSportKey(
        this.getCollectionSlot(new Date().getHours()),
      );

      if (!sportKey) {
        this.logger.log(
          'No Odds API sport key has an upcoming supported fixture',
        );

        return;
      }

      await this.sportsCollectionService.collectOddsScores(sportKey, 1);

      this.logger.log(`Odds API scores collected for ${sportKey}`);
    } catch (error) {
      this.logger.error(
        'Odds API scores collection failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ============================================================
  // COLLECTION SLOT
  //
  // 13:00 -> 0
  // 15:00 -> 1
  // 17:00 -> 2
  // 19:00 -> 3
  // 21:00 -> 4
  // 23:00 -> 5
  // 01:00 -> 6
  // ============================================================

  private getCollectionSlot(hour: number): number {
    if (hour >= 13) {
      return Math.floor((hour - 13) / 2);
    }

    return 5 + Math.floor(hour / 2);
  }

  // ============================================================
  // SELECT SPORT BY PRIORITY
  // ============================================================

  private async selectSportKey(slot: number): Promise<string | undefined> {
    const competitions = this.supportedCompetitionService
      .getOddsEnabled()
      .filter((competition) => Boolean(competition.providers.oddsApiSportKey))
      .sort(
        (a, b) => this.getPriority(a.priority) - this.getPriority(b.priority),
      );

    const eligible: Array<{
      sportKey: string;
      priority: number;
    }> = [];

    for (const competition of competitions) {
      const activeCompetition =
        await this.activeCompetitionService.getByCompetitionId(competition.id);

      if (
        !activeCompetition ||
        activeCompetition.apiFootballLeagueId === undefined ||
        activeCompetition.season === undefined
      ) {
        continue;
      }

      const season = Number.parseInt(activeCompetition.season, 10);

      if (!Number.isInteger(season) || season <= 0) {
        continue;
      }

      const now = new Date();

      const windowEnd = new Date(
        now.getTime() + this.predictionWindowDays * 24 * 60 * 60 * 1000,
      );

      const hasFixture = await this.apiFootballFixtureModel.exists({
        leagueId: activeCompetition.apiFootballLeagueId,

        season,

        fixtureDate: {
          $gte: now,

          $lte: windowEnd,
        },
      });

      if (!hasFixture) {
        continue;
      }

      eligible.push({
        sportKey: competition.providers.oddsApiSportKey!,
        priority: this.getPriority(competition.priority),
      });
    }

    if (!eligible.length) {
      return undefined;
    }

    return eligible[slot % eligible.length].sportKey;
  }

  // ============================================================
  // PRIORITY
  // ============================================================

  private getPriority(priority: CompetitionPriority): number {
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
}
