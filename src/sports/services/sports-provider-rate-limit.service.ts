import { Injectable, Logger } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import { SPORTS_DATA_COLLECTION_CONFIG } from '../config/sports-data-collection.config';

import {
  SportsProviderRateLimit,
  SportsProviderRateLimitDocument,
} from '../schemas/sports-provider-rate-limit.schema';

export type SportsProvider =
  | 'api-football'
  | 'football-data'
  | 'odds-api'
  | 'youtube';

interface ProviderLimit {
  minIntervalSeconds: number;
  dailyRequestLimit?: number;
  monthlyRequestLimit?: number;
}

@Injectable()
export class SportsProviderRateLimitService {
  private readonly logger = new Logger(SportsProviderRateLimitService.name);

  constructor(
    @InjectModel(SportsProviderRateLimit.name)
    private readonly rateLimitModel: Model<SportsProviderRateLimitDocument>,
  ) {}

  // ============================================================
  // EXECUTE
  // ============================================================

  /**
   * Reserves one outbound request slot before executing the
   * provider request.
   *
   * The slot and applicable quota are consumed even when the
   * provider request later fails.
   *
   * Therefore retries are treated exactly like normal requests.
   */
  async execute<T>(
    provider: SportsProvider,
    request: () => Promise<T>,
  ): Promise<T> {
    const limit = this.getProviderLimit(provider);

    await this.acquireSlot(provider, limit);

    try {
      return await request();
    } catch (error) {
      this.logger.warn(
        `${provider} request failed after consuming its request slot`,
      );

      throw error;
    }
  }

  // ============================================================
  // DAILY USAGE
  // ============================================================

  async getDailyUsage(provider: SportsProvider): Promise<number> {
    const limit = this.getProviderLimit(provider);

    if (limit.dailyRequestLimit === undefined) {
      return 0;
    }

    const state = await this.getState(provider);

    if (!state || state.dailyPeriod !== this.getDailyPeriod()) {
      return 0;
    }

    return state.dailyRequests;
  }

  async getRemainingDailyRequests(
    provider: SportsProvider,
  ): Promise<number | null> {
    const limit = this.getProviderLimit(provider);

    if (limit.dailyRequestLimit === undefined) {
      return null;
    }

    const used = await this.getDailyUsage(provider);

    return Math.max(limit.dailyRequestLimit - used, 0);
  }

  // ============================================================
  // MONTHLY USAGE
  // ============================================================

  async getMonthlyUsage(provider: SportsProvider): Promise<number> {
    const limit = this.getProviderLimit(provider);

    if (limit.monthlyRequestLimit === undefined) {
      return 0;
    }

    const state = await this.getState(provider);

    if (!state || state.monthlyPeriod !== this.getMonthlyPeriod()) {
      return 0;
    }

    return state.monthlyRequests;
  }

  async getRemainingMonthlyRequests(
    provider: SportsProvider,
  ): Promise<number | null> {
    const limit = this.getProviderLimit(provider);

    if (limit.monthlyRequestLimit === undefined) {
      return null;
    }

    const used = await this.getMonthlyUsage(provider);

    return Math.max(limit.monthlyRequestLimit - used, 0);
  }

  // ============================================================
  // SLOT ACQUISITION
  // ============================================================

  private async acquireSlot(
    provider: SportsProvider,
    limit: ProviderLimit,
  ): Promise<void> {
    const intervalMs = limit.minIntervalSeconds * 1000;

    while (true) {
      const now = new Date();

      const dailyPeriod = this.getDailyPeriod();

      const monthlyPeriod = this.getMonthlyPeriod();

      const lockedUntil = new Date(now.getTime() + intervalMs);

      try {
        const state = await this.rateLimitModel
          .findOneAndUpdate(
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

                this.buildDailyQuotaFilter(
                  dailyPeriod,
                  limit.dailyRequestLimit,
                ),

                this.buildMonthlyQuotaFilter(
                  monthlyPeriod,
                  limit.monthlyRequestLimit,
                ),
              ],
            },
            [
              {
                $set: {
                  provider,

                  lastRequestAt: now,

                  lockedUntil,

                  dailyPeriod,

                  monthlyPeriod,

                  dailyRequests: {
                    $cond: [
                      {
                        $eq: ['$dailyPeriod', dailyPeriod],
                      },
                      {
                        $add: [
                          {
                            $ifNull: ['$dailyRequests', 0],
                          },
                          1,
                        ],
                      },
                      1,
                    ],
                  },

                  monthlyRequests: {
                    $cond: [
                      {
                        $eq: ['$monthlyPeriod', monthlyPeriod],
                      },
                      {
                        $add: [
                          {
                            $ifNull: ['$monthlyRequests', 0],
                          },
                          1,
                        ],
                      },
                      1,
                    ],
                  },
                },
              },
            ],
            {
              upsert: true,
              returnDocument: 'after',
              setDefaultsOnInsert: true,
              updatePipeline: true,
            },
          )
          .lean()
          .exec();

        if (state) {
          return;
        }
      } catch (error) {
        /**
         * Multiple application instances can attempt to create
         * the same provider limiter document at startup.
         *
         * The provider field is unique, so one process may win
         * the insert while another receives a duplicate-key error.
         *
         * In that case we simply retry the atomic acquisition.
         */
        if (this.isDuplicateKeyError(error)) {
          continue;
        }

        throw error;
      }

      const current = await this.getState(provider);

      if (
        current?.lockedUntil &&
        current.lockedUntil.getTime() > now.getTime()
      ) {
        await this.sleep(current.lockedUntil.getTime() - now.getTime());

        continue;
      }

      /**
       * No slot was available but there was no
       * active lock. Retry shortly so another process
       * cannot permanently block the caller.
       */
      await this.sleep(1000);
    }
  }

  // ============================================================
  // QUOTA FILTERS
  // ============================================================

  private buildDailyQuotaFilter(
    period: string,
    limit?: number,
  ): Record<string, unknown> {
    if (limit === undefined) {
      return {};
    }

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
    limit?: number,
  ): Record<string, unknown> {
    if (limit === undefined) {
      return {};
    }

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

  // ============================================================
  // PROVIDER LIMITS
  // ============================================================

  private getProviderLimit(provider: SportsProvider): ProviderLimit {
    switch (provider) {
      case 'api-football':
        return {
          minIntervalSeconds:
            SPORTS_DATA_COLLECTION_CONFIG.API_FOOTBALL.rateLimit
              .minIntervalSeconds,

          dailyRequestLimit:
            SPORTS_DATA_COLLECTION_CONFIG.API_FOOTBALL.dailyRequestLimit,
        };

      case 'football-data':
        return {
          minIntervalSeconds:
            SPORTS_DATA_COLLECTION_CONFIG.FOOTBALL_DATA.rateLimit
              .minIntervalSeconds,
        };

      case 'odds-api':
        return {
          minIntervalSeconds:
            SPORTS_DATA_COLLECTION_CONFIG.ODDS_API.rateLimit.minIntervalSeconds,

          monthlyRequestLimit:
            SPORTS_DATA_COLLECTION_CONFIG.ODDS_API.monthlyRequestLimit,
        };

      case 'youtube':
        return {
          minIntervalSeconds:
            SPORTS_DATA_COLLECTION_CONFIG.YOUTUBE.rateLimit.minIntervalSeconds,

          dailyRequestLimit:
            SPORTS_DATA_COLLECTION_CONFIG.YOUTUBE.dailyRequestLimit,
        };
    }
  }

  // ============================================================
  // STATE
  // ============================================================

  private async getState(
    provider: SportsProvider,
  ): Promise<SportsProviderRateLimitDocument | null> {
    return this.rateLimitModel
      .findOne({
        provider,
      })
      .lean()
      .exec();
  }

  // ============================================================
  // PERIODS
  // ============================================================

  /**
   * Request quotas are tracked using UTC periods.
   */
  private getDailyPeriod(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private getMonthlyPeriod(): string {
    return new Date().toISOString().slice(0, 7);
  }

  // ============================================================
  // ERROR HELPERS
  // ============================================================

  private isDuplicateKeyError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const value = error as {
      code?: number;
    };

    return value.code === 11000;
  }

  // ============================================================
  // SLEEP
  // ============================================================

  private async sleep(milliseconds: number): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  }
}
