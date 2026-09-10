// src/predictions-engine/services/fixture-analysis.service.ts

import { Injectable, Logger } from '@nestjs/common';

import { SportsDataReadService } from '../../sports/services/sports-data-read.service';

import {
  FixtureAnalysis,
  FixtureAnalysisFixture,
} from '../interfaces/fixture-analysis.interface';

interface StoredFixturePayload {
  fixture?: {
    id?: number | string;
    date?: string | number;
    status?: {
      short?: string;
    };
  };

  teams?: {
    home?: {
      id?: number | string;
      name?: string;
    };

    away?: {
      id?: number | string;
      name?: string;
    };
  };

  league?: {
    id?: number | string;
    season?: number | string;
  };

  oddsEventId?: string;
}

interface StoredFixture {
  fixtureId?: number | string;
  matchId?: number | string;

  fixtureDate?: string | number | Date;
  utcDate?: string | number | Date;

  homeTeamId?: number | string;
  awayTeamId?: number | string;

  homeTeamName?: string;
  awayTeamName?: string;

  leagueId?: number | string;
  season?: number | string;

  statusShort?: string;
  status?: string;

  oddsEventId?: string;

  payload?: StoredFixturePayload;
}

@Injectable()
export class FixtureAnalysisService {
  private readonly logger = new Logger(FixtureAnalysisService.name);

  constructor(private readonly sportsDataReadService: SportsDataReadService) {}

  async build(fixtureId: number): Promise<FixtureAnalysis | null> {
    const now = new Date();

    const from = new Date(now.getTime() - 60 * 1000);

    const to = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 60 * 1000);

    const fixtures = await this.sportsDataReadService.getUpcomingFixtures(
      from,
      to,
    );

    const storedFixtures = fixtures as unknown as StoredFixture[];

    const fixture = storedFixtures.find(
      (candidate) =>
        Number(
          candidate.fixtureId ??
            candidate.matchId ??
            candidate.payload?.fixture?.id,
        ) === fixtureId,
    );

    if (!fixture) {
      this.logger.warn(
        `Fixture ${fixtureId} was not found in stored upcoming fixtures`,
      );

      return null;
    }

    const fixtureDate = this.toDate(
      fixture.fixtureDate ?? fixture.utcDate ?? fixture.payload?.fixture?.date,
    );

    if (!fixtureDate) {
      this.logger.warn(`Fixture ${fixtureId} has no valid kickoff date`);

      return null;
    }

    const homeTeamId = this.toNumber(
      fixture.homeTeamId ?? fixture.payload?.teams?.home?.id,
    );

    const awayTeamId = this.toNumber(
      fixture.awayTeamId ?? fixture.payload?.teams?.away?.id,
    );

    if (homeTeamId <= 0 || awayTeamId <= 0) {
      return null;
    }

    const leagueId = this.toNumber(
      fixture.leagueId ?? fixture.payload?.league?.id,
    );

    const season = this.toNumber(
      fixture.season ?? fixture.payload?.league?.season,
    );

    if (leagueId <= 0 || season <= 0) {
      return null;
    }

    const competitionId = await this.resolveCompetitionId(leagueId, season);

    if (!competitionId) {
      this.logger.warn(
        `No supported competition mapping found for league ${leagueId}, season ${season}`,
      );

      return null;
    }

    const [homeTeamStats, awayTeamStats, headToHead, odds] = await Promise.all([
      this.sportsDataReadService.getTeamStats(
        competitionId,
        season,
        homeTeamId,
      ),

      this.sportsDataReadService.getTeamStats(
        competitionId,
        season,
        awayTeamId,
      ),

      this.sportsDataReadService.getHeadToHead(homeTeamId, awayTeamId),

      this.resolveOdds(fixture),
    ]);

    const homeTeamName = String(
      fixture.payload?.teams?.home?.name ??
        fixture.homeTeamName ??
        `Team ${homeTeamId}`,
    );

    const awayTeamName = String(
      fixture.payload?.teams?.away?.name ??
        fixture.awayTeamName ??
        `Team ${awayTeamId}`,
    );

    const fixtureAnalysisFixture: FixtureAnalysisFixture = {
      fixtureId,

      competitionId,

      leagueId,

      season,

      kickoff: fixtureDate,

      status: String(
        fixture.statusShort ??
          fixture.status ??
          fixture.payload?.fixture?.status?.short ??
          'NS',
      ),

      homeTeam: {
        teamId: homeTeamId,
        teamName: homeTeamName,
        isHome: true,
      },

      awayTeam: {
        teamId: awayTeamId,
        teamName: awayTeamName,
        isHome: false,
      },

      payload: (fixture.payload ?? {}) as Record<string, unknown>,
    };

    const dataQuality = this.calculateDataQuality({
      fixture: fixtureAnalysisFixture,
      homeTeamStats,
      awayTeamStats,
      headToHead,
      odds,
    });

    return {
      fixture: fixtureAnalysisFixture,

      homeTeamStats,

      awayTeamStats,

      headToHead,

      odds,

      dataQuality,

      analyzedAt: new Date(),
    };
  }

  async analyze(fixtureId: number): Promise<FixtureAnalysis | null> {
    return this.build(fixtureId);
  }

  async analyzeFixture(fixtureId: string): Promise<FixtureAnalysis | null> {
    const numericFixtureId = Number(fixtureId);

    if (!Number.isInteger(numericFixtureId) || numericFixtureId <= 0) {
      this.logger.warn(`Invalid fixture ID: ${fixtureId}`);

      return null;
    }

    return this.build(numericFixtureId);
  }

  private async resolveCompetitionId(
    leagueId: number,
    season: number,
  ): Promise<string | null> {
    const competitions = await this.sportsDataReadService.getCompetitions();

    interface CompetitionRecord {
      providers?: {
        apiFootballLeagueId?: number | string;
      };

      apiFootballLeagueId?: number | string;

      season?: number;

      id?: string;
    }

    for (const competition of competitions as unknown[]) {
      if (typeof competition !== 'object' || competition === null) {
        continue;
      }

      const record = competition as CompetitionRecord;

      const providerLeagueId =
        record.providers?.apiFootballLeagueId ?? record.apiFootballLeagueId;

      if (Number(providerLeagueId) !== leagueId) {
        continue;
      }

      if (typeof record.season === 'number' && record.season !== season) {
        continue;
      }

      if (typeof record.id === 'string' && record.id.trim()) {
        return record.id.trim().toLowerCase();
      }
    }

    return null;
  }

  private async resolveOdds(
    fixture: StoredFixture,
  ): Promise<FixtureAnalysis['odds']> {
    const eventId =
      typeof fixture.payload?.oddsEventId === 'string'
        ? fixture.payload.oddsEventId.trim()
        : typeof fixture.oddsEventId === 'string'
          ? fixture.oddsEventId.trim()
          : null;

    if (!eventId) {
      return null;
    }

    const odds = await this.sportsDataReadService.getOddsForEvent(eventId);

    if (Array.isArray(odds)) {
      return (odds[0] ?? null) as FixtureAnalysis['odds'];
    }

    return odds;
  }

  private calculateDataQuality(
    input: Omit<FixtureAnalysis, 'dataQuality' | 'analyzedAt'>,
  ): number {
    let score = 0;

    if (input.fixture.payload) {
      score += 20;
    }

    if (input.homeTeamStats) {
      score += 30;
    }

    if (input.awayTeamStats) {
      score += 30;
    }

    if (input.headToHead) {
      score += 10;
    }

    if (input.odds) {
      score += 10;
    }

    return Math.min(100, score);
  }

  private toNumber(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    const converted = Number(value);

    return Number.isFinite(converted) ? converted : 0;
  }

  private toDate(value: unknown): Date | null {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

    if (typeof value !== 'string' && typeof value !== 'number') {
      return null;
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
  }
}
