import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  SportsProviderRateLimit,
  SportsProviderRateLimitDocument,
} from '../schemas/sports-provider-rate-limit.schema';

export type SportsProvider = 'espn' | 'football-data' | 'odds-api' | 'youtube';

export class SportsProviderQuotaExceededError extends Error {
  constructor(
    public readonly provider: SportsProvider,
    public readonly period: 'daily' | 'monthly',
  ) {
    super(`${provider} ${period} request quota has been exhausted`);

    this.name = 'SportsProviderQuotaExceededError';
  }
}

interface ProviderLimitConfig {
  minIntervalSeconds: number;
  dailyLimit?: number;
  monthlyLimit?: number;
}

@Injectable()
export class SportsProviderRateLimitService {
  private readonly logger = new Logger(SportsProviderRateLimitService.name);

  /**
   * One provider-wide request slot.
   *
   * The limiter is global by provider rather than
   * separate per endpoint.
   */
  private readonly limits: Record<SportsProvider, ProviderLimitConfig> = {
    espn: {
      minIntervalSeconds: 60,
    },

    'football-data': {
      minIntervalSeconds: 60,
    },

    'odds-api': {
      minIntervalSeconds: 60,
      monthlyLimit: 500,
    },

    youtube: {
      minIntervalSeconds: 60,
      dailyLimit: 10_000,
    },
  };

  /**
   * Slightly longer than the provider interval so that
   * concurrent callers cannot immediately reuse a slot.
   */
  private readonly lockSeconds = 65;

  constructor(
    @InjectModel(SportsProviderRateLimit.name)
    private readonly rateLimitModel: Model<SportsProviderRateLimitDocument>,
  ) {}

  async execute<T>(
    provider: SportsProvider,
    operation: () => Promise<T>,
  ): Promise<T> {
    await this.acquireSlot(provider);

    return operation();
  }

  async acquireSlot(provider: SportsProvider): Promise<void> {
    const config = this.limits[provider];

    if (!config) {
      throw new Error(
        `No rate-limit configuration exists for provider: ${provider}`,
      );
    }

    while (true) {
      const now = new Date();

      await this.ensurePeriodState(provider, now);

      await this.assertQuotaAvailable(provider, now);

      const state = await this.rateLimitModel
        .findOne({
          provider,
        })
        .lean()
        .exec();

      const lastRequestAt = state?.lastRequestAt
        ? new Date(state.lastRequestAt)
        : null;

      const nextAllowedAt = lastRequestAt
        ? new Date(lastRequestAt.getTime() + config.minIntervalSeconds * 1000)
        : now;

      if (nextAllowedAt.getTime() > now.getTime()) {
        await this.sleep(nextAllowedAt.getTime() - now.getTime());

        continue;
      }

      const lockedUntil = new Date(now.getTime() + this.lockSeconds * 1000);

      const currentDailyPeriod = this.getDailyPeriod(now);
      const currentMonthlyPeriod = this.getMonthlyPeriod(now);

      const filters: Record<string, unknown>[] = [];

      if (config.dailyLimit !== undefined) {
        filters.push(
          this.buildDailyQuotaFilter(currentDailyPeriod, config.dailyLimit),
        );
      }

      if (config.monthlyLimit !== undefined) {
        filters.push(
          this.buildMonthlyQuotaFilter(
            currentMonthlyPeriod,
            config.monthlyLimit,
          ),
        );
      }

      try {
        /**
         * Atomically acquire the provider request slot.
         *
         * Mongoose timestamps manage createdAt/updatedAt.
         */
        const updated = await this.rateLimitModel.findOneAndUpdate(
          {
            provider,

            $and: [
              {
                $or: [
                  {
                    lockedUntil: {
                      $exists: false,
                    },
                  },
                  {
                    lockedUntil: {
                      $lte: now,
                    },
                  },
                ],
              },

              {
                $or: [
                  {
                    lastRequestAt: {
                      $exists: false,
                    },
                  },
                  {
                    lastRequestAt: {
                      $lte: new Date(
                        now.getTime() - config.minIntervalSeconds * 1000,
                      ),
                    },
                  },
                ],
              },

              ...filters,
            ],
          },

          {
            $set: {
              provider,
              lastRequestAt: now,
              lockedUntil,
              dailyPeriod: currentDailyPeriod,
              monthlyPeriod: currentMonthlyPeriod,
            },

            $inc: {
              dailyRequests: 1,
              monthlyRequests: 1,
            },
          },

          {
            returnDocument: 'after',
            upsert: true,
          },
        );

        if (updated) {
          return;
        }
      } catch (error) {
        /**
         * Another concurrent caller may have created the provider
         * state between ensurePeriodState() and this atomic upsert.
         *
         * The unique provider index correctly rejects that insert.
         * Re-read the state and retry instead of treating it as a
         * provider failure.
         */
        if (this.isDuplicateProviderKeyError(error)) {
          await this.sleep(100);

          continue;
        }

        throw error;
      }

      await this.sleep(1000);
    }
  }

  async getRemainingDailyRequests(
    provider: SportsProvider,
  ): Promise<number | null> {
    const config = this.limits[provider];

    if (config.dailyLimit === undefined) {
      return null;
    }

    const now = new Date();

    await this.ensurePeriodState(provider, now);

    const state = await this.rateLimitModel
      .findOne({
        provider,
      })
      .lean()
      .exec();

    return Math.max(0, config.dailyLimit - (state?.dailyRequests ?? 0));
  }

  async getRemainingMonthlyRequests(
    provider: SportsProvider,
  ): Promise<number | null> {
    const config = this.limits[provider];

    if (config.monthlyLimit === undefined) {
      return null;
    }

    const now = new Date();

    await this.ensurePeriodState(provider, now);

    const state = await this.rateLimitModel
      .findOne({
        provider,
      })
      .lean()
      .exec();

    return Math.max(0, config.monthlyLimit - (state?.monthlyRequests ?? 0));
  }

  async getDailyUsage(provider: SportsProvider): Promise<number> {
    const now = new Date();

    await this.ensurePeriodState(provider, now);

    const state = await this.rateLimitModel
      .findOne({
        provider,
      })
      .lean()
      .exec();

    return state?.dailyRequests ?? 0;
  }

  async getMonthlyUsage(provider: SportsProvider): Promise<number> {
    const now = new Date();

    await this.ensurePeriodState(provider, now);

    const state = await this.rateLimitModel
      .findOne({
        provider,
      })
      .lean()
      .exec();

    return state?.monthlyRequests ?? 0;
  }

  async isQuotaAvailable(provider: SportsProvider): Promise<boolean> {
    try {
      await this.assertQuotaAvailable(provider, new Date());

      return true;
    } catch (error) {
      if (error instanceof SportsProviderQuotaExceededError) {
        return false;
      }

      throw error;
    }
  }

  async getProviderState(
    provider: SportsProvider,
  ): Promise<SportsProviderRateLimitDocument | null> {
    await this.ensurePeriodState(provider, new Date());

    return this.rateLimitModel
      .findOne({
        provider,
      })
      .exec();
  }

  async clearExpiredLocks(): Promise<number> {
    const result = await this.rateLimitModel.updateMany(
      {
        lockedUntil: {
          $lt: new Date(),
        },
      },
      {
        $unset: {
          lockedUntil: 1,
        },
      },
    );

    return result.modifiedCount;
  }

  private async assertQuotaAvailable(
    provider: SportsProvider,
    now: Date,
  ): Promise<void> {
    const config = this.limits[provider];

    const state = await this.rateLimitModel
      .findOne({
        provider,
      })
      .lean()
      .exec();

    if (!state) {
      return;
    }

    const currentDailyPeriod = this.getDailyPeriod(now);

    const currentMonthlyPeriod = this.getMonthlyPeriod(now);

    if (
      config.dailyLimit !== undefined &&
      state.dailyPeriod === currentDailyPeriod &&
      state.dailyRequests >= config.dailyLimit
    ) {
      throw new SportsProviderQuotaExceededError(provider, 'daily');
    }

    if (
      config.monthlyLimit !== undefined &&
      state.monthlyPeriod === currentMonthlyPeriod &&
      state.monthlyRequests >= config.monthlyLimit
    ) {
      throw new SportsProviderQuotaExceededError(provider, 'monthly');
    }
  }

  private buildDailyQuotaFilter(
    period: string,
    limit: number,
  ): Record<string, unknown> {
    return {
      $or: [
        {
          dailyPeriod: {
            $ne: period,
          },
        },
        {
          dailyRequests: {
            $lt: limit,
          },
        },
      ],
    };
  }

  private buildMonthlyQuotaFilter(
    period: string,
    limit: number,
  ): Record<string, unknown> {
    return {
      $or: [
        {
          monthlyPeriod: {
            $ne: period,
          },
        },
        {
          monthlyRequests: {
            $lt: limit,
          },
        },
      ],
    };
  }

  private async ensurePeriodState(
    provider: SportsProvider,
    now: Date,
  ): Promise<void> {
    const dailyPeriod = this.getDailyPeriod(now);
    const monthlyPeriod = this.getMonthlyPeriod(now);

    const existing = await this.rateLimitModel
      .findOne({
        provider,
      })
      .lean()
      .exec();

    if (!existing) {
      try {
        await this.rateLimitModel.create({
          provider,
          lockedUntil: undefined,
          lastRequestAt: undefined,
          dailyPeriod,
          dailyRequests: 0,
          monthlyPeriod,
          monthlyRequests: 0,
        });
      } catch (error) {
        /**
         * Multiple startup workers may initialize the same
         * provider simultaneously. A unique provider index is
         * expected and protects against duplicate state.
         *
         * If another worker won the race, simply continue.
         */
        if (this.isDuplicateProviderKeyError(error)) {
          return;
        }

        throw error;
      }

      return;
    }

    const update: Record<string, unknown> = {};

    if (existing.dailyPeriod !== dailyPeriod) {
      update.dailyPeriod = dailyPeriod;
      update.dailyRequests = 0;
    }

    if (existing.monthlyPeriod !== monthlyPeriod) {
      update.monthlyPeriod = monthlyPeriod;
      update.monthlyRequests = 0;
    }

    if (Object.keys(update).length === 0) {
      return;
    }

    /**
     * Mongoose timestamps manage updatedAt automatically.
     */
    await this.rateLimitModel.updateOne(
      {
        provider,
      },
      {
        $set: update,
      },
    );
  }

  private isDuplicateProviderKeyError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const candidate = error as {
      code?: number;
      keyPattern?: Record<string, unknown>;
      keyValue?: Record<string, unknown>;
    };

    return (
      candidate.code === 11000 &&
      Boolean(candidate.keyPattern?.provider) &&
      Boolean(candidate.keyValue?.provider)
    );
  }

  private getDailyPeriod(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private getMonthlyPeriod(date: Date): string {
    return date.toISOString().slice(0, 7);
  }

  private async sleep(milliseconds: number): Promise<void> {
    await new Promise<void>((resolve) =>
      setTimeout(resolve, Math.max(0, milliseconds)),
    );
  }
}
