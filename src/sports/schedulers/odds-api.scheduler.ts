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
  // MONDAY 12:05 AM
  // ============================================================

  @Cron('0 5 0 * * 1', {
    name: 'odds-api-sports-discovery',
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
  // ============================================================

  @Cron('0 15 0 * * *', {
    name: 'odds-api-events',
  })
  async collectEvents(): Promise<void> {
    try {
      const sportKey = await this.selectSportKey(0);

      if (!sportKey) {
        this.logger.log('No Odds API sport key has an upcoming match');

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
  // SCORES
  // DAILY
  // ============================================================

  @Cron('0 15 6 * * *', {
    name: 'odds-api-scores',
  })
  async collectScores(): Promise<void> {
    try {
      const sportKey = await this.selectSportKey(3);

      if (!sportKey) {
        this.logger.log('No Odds API sport key has an upcoming match');

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
  // ODDS
  // 12 TIMES DAILY
  // ============================================================

  @Cron('0 15 */2 * * *', {
    name: 'odds-api-targeted-odds',
  })
  async collectTargetedOdds(): Promise<void> {
    try {
      const hour = new Date().getHours();

      const slot = Math.floor(hour / 2);

      const sportKey = await this.selectSportKey(slot);

      if (!sportKey) {
        this.logger.log('No Odds API sport key has an upcoming match');

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
