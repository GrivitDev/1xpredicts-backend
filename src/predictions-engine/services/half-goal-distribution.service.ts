import { Injectable, Logger } from '@nestjs/common';

import { SportsDataReadService } from '../../sports/services/sports-data-read.service';

import { HalfGoalProbabilityDistribution } from '../interfaces/half-goal-probability.interface';

interface HistoricalFixturePayload {
  fixture?: {
    status?: {
      short?: string;
    };
  };

  league?: {
    id?: number;
    season?: number;
  };

  teams?: {
    home?: {
      id?: number;
    };

    away?: {
      id?: number;
    };
  };

  goals?: {
    home?: number | null;
    away?: number | null;

    halftime?: {
      home?: number | null;
      away?: number | null;
    };

    fulltime?: {
      home?: number | null;
      away?: number | null;
    };
  };
}

interface HistoricalFixtureRecord {
  fixture?: {
    status?: {
      short?: string;
    };
  };

  season?: number | string;

  homeTeamId?: number | string;

  awayTeamId?: number | string;

  payload?: HistoricalFixturePayload;
}

@Injectable()
export class HalfGoalDistributionService {
  private readonly logger = new Logger(HalfGoalDistributionService.name);

  private readonly completedStatuses = new Set(['FT', 'AET', 'PEN']);

  constructor(private readonly sportsDataReadService: SportsDataReadService) {}

  async build(
    competitionId: string,
    season: number,
    before: Date,
    homeTeamId: number,
    _awayTeamId: number,
  ): Promise<HalfGoalProbabilityDistribution | null> {
    void _awayTeamId;

    const historicalFixtures =
      (await this.sportsDataReadService.getFinishedFixtures(
        undefined,
        before,
        competitionId,
      )) as unknown as HistoricalFixtureRecord[];

    const relevantFixtures = historicalFixtures.filter((fixture) => {
      const payload = fixture.payload;

      if (!this.completedStatuses.has(payload?.fixture?.status?.short ?? '')) {
        return false;
      }

      const fixtureSeason = Number(fixture.season ?? payload?.league?.season);

      if (fixtureSeason !== season) {
        return false;
      }

      const fixtureHomeId = Number(
        fixture.homeTeamId ?? payload?.teams?.home?.id,
      );

      const fixtureAwayId = Number(
        fixture.awayTeamId ?? payload?.teams?.away?.id,
      );

      return (
        fixtureHomeId > 0 &&
        fixtureAwayId > 0 &&
        fixtureHomeId !== fixtureAwayId
      );
    });

    if (relevantFixtures.length < 10) {
      this.logger.debug(
        `Insufficient half-goal history for ${competitionId}/${season}`,
      );

      return null;
    }

    const firstHalfCounts: Record<number, number> = {};

    const secondHalfCounts: Record<number, number> = {};

    let sampleSize = 0;

    for (const fixture of relevantFixtures) {
      const payload = fixture.payload;

      const halftime = payload?.goals?.halftime;

      const fulltime = payload?.goals?.fulltime ?? payload?.goals;

      const halfHome = this.toNullableNumber(halftime?.home);

      const halfAway = this.toNullableNumber(halftime?.away);

      const fullHome = this.toNullableNumber(fulltime?.home);

      const fullAway = this.toNullableNumber(fulltime?.away);

      if (
        halfHome === null ||
        halfAway === null ||
        fullHome === null ||
        fullAway === null
      ) {
        continue;
      }

      const firstHalfGoals = halfHome + halfAway;

      const secondHalfGoals = Math.max(0, fullHome + fullAway - firstHalfGoals);

      firstHalfCounts[firstHalfGoals] =
        (firstHalfCounts[firstHalfGoals] ?? 0) + 1;

      secondHalfCounts[secondHalfGoals] =
        (secondHalfCounts[secondHalfGoals] ?? 0) + 1;

      sampleSize += 1;
    }

    if (sampleSize < 10) {
      return null;
    }

    return {
      firstHalf: {
        totalGoals: this.toDistribution(firstHalfCounts, sampleSize),
      },

      secondHalf: {
        totalGoals: this.toDistribution(secondHalfCounts, sampleSize),
      },

      sampleSize,
    };
  }

  private toDistribution(
    counts: Record<number, number>,
    sampleSize: number,
  ): Record<number, number> {
    if (sampleSize <= 0) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(counts).map(([goals, count]) => [
        Number(goals),
        count / sampleSize,
      ]),
    );
  }

  private toNullableNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    return null;
  }
}
