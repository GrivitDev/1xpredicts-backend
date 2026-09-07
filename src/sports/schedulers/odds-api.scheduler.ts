import { Injectable, Logger } from '@nestjs/common';

import { Cron } from '@nestjs/schedule';

import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import { ActiveCompetition } from '../schemas/active-competition.schema';

import {
  ApiFootballFixture,
  ApiFootballFixtureDocument,
} from '../schemas/api-football/api-football-fixture.schema';

import {
  FootballDataMatch,
  FootballDataMatchDocument,
} from '../schemas/football-data/football-data-match.schema';

import {
  OddsApiSport,
  OddsApiSportDocument,
} from '../schemas/odds-api-sport.schema';

import { TheOddsApiService } from '../providers/the-odds-api.service';

import { SportsCollectionService } from '../services/sports-collection.service';

@Injectable()
export class OddsApiScheduler {
  private readonly logger = new Logger(OddsApiScheduler.name);

  private running = false;

  private readonly markets = [
    'h2h',
    'totals',
    'btts',
    'spreads',
    'double_chance',
    'draw_no_bet',
  ];

  constructor(
    private readonly oddsApiService: TheOddsApiService,

    private readonly sportsCollectionService: SportsCollectionService,

    @InjectModel(ActiveCompetition.name)
    private readonly activeCompetitionModel: Model<any>,

    @InjectModel(ApiFootballFixture.name)
    private readonly apiFootballFixtureModel: Model<ApiFootballFixtureDocument>,

    @InjectModel(FootballDataMatch.name)
    private readonly footballDataMatchModel: Model<FootballDataMatchDocument>,

    @InjectModel(OddsApiSport.name)
    private readonly oddsApiSportModel: Model<OddsApiSportDocument>,
  ) {}

  @Cron('0 2 1 * *', {
    timeZone: 'Africa/Lagos',
  })
  async refreshSports(): Promise<void> {
    try {
      const sports = await this.oddsApiService.getSports();

      await this.sportsCollectionService.collectOddsSports(sports);
    } catch (error) {
      this.logger.error(
        'Odds API sport discovery failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  @Cron('0 8 * * *', {
    timeZone: 'Africa/Lagos',
  })
  async collectDailyOdds(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      const sportKeys = await this.getEligibleSportKeys();

      if (sportKeys.length === 0) {
        this.logger.log('No eligible Odds API sport keys for today');

        return;
      }

      for (const sportKey of sportKeys) {
        try {
          const odds = await this.oddsApiService.getOdds(
            sportKey,
            'us,uk,eu,au',
            this.markets,
          );

          await this.sportsCollectionService.collectOdds(odds);
        } catch (error) {
          this.logger.error(
            `Odds collection failed for ${sportKey}`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }
    } catch (error) {
      this.logger.error(
        'Daily Odds API collection failed',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }

  private async getEligibleSportKeys(): Promise<string[]> {
    const today = this.getWATDayRange();

    const [apiFootballFixtures, footballDataMatches] = await Promise.all([
      this.apiFootballFixtureModel
        .find({
          fixtureDate: {
            $gte: today.start,
            $lt: today.end,
          },
        })
        .lean()
        .exec(),

      this.footballDataMatchModel
        .find({
          utcDate: {
            $gte: today.start,
            $lt: today.end,
          },
        })
        .lean()
        .exec(),
    ]);

    const activeCompetitions = await this.activeCompetitionModel
      .find({
        oddsApiSportKey: {
          $exists: true,
          $nin: [null, ''],
        },
      })
      .lean()
      .exec();

    const activeByApiFootballLeague = new Map<number, string>();

    const activeByFootballDataCompetition = new Map<string, string>();

    for (const competition of activeCompetitions) {
      const sportKey = competition.oddsApiSportKey;

      if (!sportKey) {
        continue;
      }

      if (typeof competition.apiFootballLeagueId === 'number') {
        activeByApiFootballLeague.set(
          competition.apiFootballLeagueId,
          sportKey,
        );
      }

      if (competition.footballDataCode) {
        activeByFootballDataCompetition.set(
          competition.footballDataCode.toUpperCase(),
          sportKey,
        );
      }
    }

    const sportKeys = new Set<string>();

    for (const fixture of apiFootballFixtures) {
      const leagueId = fixture.leagueId;

      if (typeof leagueId !== 'number') {
        continue;
      }

      const sportKey = activeByApiFootballLeague.get(leagueId);

      if (sportKey) {
        sportKeys.add(sportKey);
      }
    }

    for (const match of footballDataMatches) {
      const competitionCode = match.competitionCode?.trim().toUpperCase();

      if (!competitionCode) {
        continue;
      }

      const sportKey = activeByFootballDataCompetition.get(competitionCode);

      if (sportKey) {
        sportKeys.add(sportKey);
      }
    }

    return [...sportKeys];
  }

  private getWATDayRange(): {
    start: Date;
    end: Date;
  } {
    const now = new Date();

    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Lagos',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const parts = formatter.formatToParts(now);

    const year = Number(parts.find((part) => part.type === 'year')?.value);

    const month = Number(parts.find((part) => part.type === 'month')?.value);

    const day = Number(parts.find((part) => part.type === 'day')?.value);

    const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

    // 00:00 WAT = 23:00 UTC on the previous day.
    start.setUTCHours(start.getUTCHours() - 1);

    const end = new Date(start);

    end.setUTCDate(end.getUTCDate() + 1);

    return {
      start,
      end,
    };
  }
}
