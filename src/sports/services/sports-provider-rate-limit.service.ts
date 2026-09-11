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
   * The interval applies independently to each endpoint.
   *
   * Example:
   *
   * ESPN scoreboard -> 10 seconds
   * ESPN standings  -> 10 seconds
   *
   * A scoreboard request does NOT block a standings request.
   */
  private readonly limits: Record<SportsProvider, ProviderLimitConfig> = {
    espn: {
      minIntervalSeconds: 5,
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
   * Special endpoint used for provider-wide quota accounting.
   *
   * This record does NOT participate in endpoint throttling.
   */
  private readonly PROVIDER_QUOTA_ENDPOINT = '__provider_quota__';

  /**
   * Lock ownership must survive normal HTTP request duration.
   *
   * Axios timeout in EspnService is 15 seconds, so 30 seconds
   * gives sufficient protection against overlapping workers.
   *
   * The lock is released immediately after the request finishes,
   * so the 30-second value is only a crash-recovery ceiling.
   */
  private readonly lockSeconds = 30;

  constructor(
    @InjectModel(SportsProviderRateLimit.name)
    private readonly rateLimitModel: Model<SportsProviderRateLimitDocument>,
  ) {}

  // ============================================================
  // PUBLIC REQUEST EXECUTION
  // ============================================================

  /**
   * Execute one outbound request against a specific endpoint.
   *
   * IMPORTANT:
   *
   * endpoint is a stable logical endpoint identifier.
   *
   * Example:
   *
   * execute('espn', 'scoreboard', operation)
   *
   * Query parameters such as:
   *
   * ?dates=20260901-20260910
   *
   * must NOT become part of the endpoint key.
   *
   * Therefore all scoreboard pages share the same scoreboard
   * rate-limit slot.
   */
  async execute<T>(
    provider: SportsProvider,
    endpoint: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const normalizedEndpoint = this.normalizeEndpoint(endpoint);

    await this.acquireSlot(provider, normalizedEndpoint);

    try {
      return await operation();
    } finally {
      await this.releaseSlot(provider, normalizedEndpoint);
    }
  }

  // ============================================================
  // ENDPOINT SLOT
  // ============================================================

  /**
   * Acquire one endpoint-specific execution slot.
   *
   * This method waits rather than dropping requests.
   *
   * MongoDB provides cross-worker atomic ownership.
   */
  async acquireSlot(provider: SportsProvider, endpoint: string): Promise<void> {
    const normalizedEndpoint = this.normalizeEndpoint(endpoint);

    const config = this.getConfig(provider);

    while (true) {
      const now = new Date();

      await this.ensurePeriodState(provider, now);

      /**
       * First wait for the endpoint's own interval.
       *
       * This is NOT provider-wide.
       */
      const state = await this.rateLimitModel
        .findOne({
          provider,
          endpoint: normalizedEndpoint,
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

      /**
       * Atomic endpoint lock.
       *
       * We intentionally do NOT update lastRequestAt yet.
       *
       * This creates a temporary ownership lock while the
       * provider-wide quota is reserved.
       */
      const lockedUntil = new Date(now.getTime() + this.lockSeconds * 1000);

      let updated: SportsProviderRateLimitDocument | null = null;

      try {
        updated = await this.rateLimitModel
          .findOneAndUpdate(
            {
              provider,
              endpoint: normalizedEndpoint,

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
              ],
            },

            {
              $set: {
                provider,
                endpoint: normalizedEndpoint,
                lockedUntil,
              },
            },

            {
              returnDocument: 'after',
              upsert: true,
            },
          )
          .exec();
      } catch (error) {
        /**
         * Another worker may have created the endpoint record
         * concurrently.
         */
        if (this.isDuplicateEndpointKeyError(error)) {
          await this.sleep(100);
          continue;
        }

        throw error;
      }

      if (!updated) {
        /**
         * Another worker owns the endpoint.
         */
        await this.sleep(250);
        continue;
      }

      /**
       * Reserve provider-wide quota only after we own
       * the endpoint slot.
       *
       * Because this update is atomic, simultaneous requests
       * from different endpoints cannot exceed the quota.
       */
      const quotaReserved = await this.reserveProviderQuota(provider, now);

      if (!quotaReserved) {
        /**
         * We acquired the endpoint temporarily but the
         * provider-wide quota is exhausted.
         *
         * Release the endpoint immediately.
         */
        await this.rateLimitModel
          .updateOne(
            {
              provider,
              endpoint: normalizedEndpoint,
              lockedUntil,
            },
            {
              $unset: {
                lockedUntil: 1,
              },
            },
          )
          .exec();

        throw await this.createQuotaExceededError(provider);
      }

      /**
       * The quota has now been reserved and the request is
       * officially allowed to leave the application.
       *
       * lastRequestAt is therefore the actual request-start
       * timestamp.
       */
      await this.rateLimitModel
        .updateOne(
          {
            provider,
            endpoint: normalizedEndpoint,
            lockedUntil,
          },
          {
            $set: {
              lastRequestAt: now,
            },
          },
        )
        .exec();

      return;
    }
  }

  /**
   * Release an endpoint lock after the operation finishes.
   *
   * lastRequestAt remains untouched, so the endpoint still
   * respects its configured interval.
   */
  async releaseSlot(provider: SportsProvider, endpoint: string): Promise<void> {
    const normalizedEndpoint = this.normalizeEndpoint(endpoint);

    try {
      await this.rateLimitModel
        .updateOne(
          {
            provider,
            endpoint: normalizedEndpoint,
          },
          {
            $unset: {
              lockedUntil: 1,
            },
          },
        )
        .exec();
    } catch (error) {
      /**
       * A failed unlock is not allowed to fail the provider
       * operation. The TTL-style lock remains recoverable by
       * the next acquireSlot() call.
       */
      this.logger.warn(
        `Failed to release rate-limit lock for ${provider}/${normalizedEndpoint}`,
        error,
      );
    }
  }

  // ============================================================
  // QUOTA
  // ============================================================

  /**
   * Atomically reserve provider-wide quota.
   *
   * This is shared by ALL endpoints for that provider.
   */
  private async reserveProviderQuota(
    provider: SportsProvider,
    now: Date,
  ): Promise<boolean> {
    const config = this.getConfig(provider);

    /**
     * Providers without quota limits do not need quota
     * accounting to block execution.
     */
    if (config.dailyLimit === undefined && config.monthlyLimit === undefined) {
      return true;
    }

    const dailyPeriod = this.getDailyPeriod(now);
    const monthlyPeriod = this.getMonthlyPeriod(now);

    const filters: Record<string, unknown>[] = [
      {
        provider,
        endpoint: this.PROVIDER_QUOTA_ENDPOINT,
      },
    ];

    const periodFilters: Record<string, unknown>[] = [];

    if (config.dailyLimit !== undefined) {
      periodFilters.push({
        $or: [
          {
            dailyPeriod: {
              $ne: dailyPeriod,
            },
          },
          {
            dailyRequests: {
              $lt: config.dailyLimit,
            },
          },
        ],
      });
    }

    if (config.monthlyLimit !== undefined) {
      periodFilters.push({
        $or: [
          {
            monthlyPeriod: {
              $ne: monthlyPeriod,
            },
          },
          {
            monthlyRequests: {
              $lt: config.monthlyLimit,
            },
          },
        ],
      });
    }

    const filter: Record<string, unknown> = {
      $and: [...filters, ...periodFilters],
    };

    const increment: Record<string, number> = {};

    if (config.dailyLimit !== undefined) {
      increment.dailyRequests = 1;
    }

    if (config.monthlyLimit !== undefined) {
      increment.monthlyRequests = 1;
    }

    const updated = await this.rateLimitModel
      .findOneAndUpdate(
        filter,
        {
          $set: {
            provider,
            endpoint: this.PROVIDER_QUOTA_ENDPOINT,
            dailyPeriod,
            monthlyPeriod,
          },

          $inc: increment,
        },
        {
          returnDocument: 'after',
          upsert: true,
        },
      )
      .exec();

    if (updated) {
      return true;
    }

    return false;
  }

  async getRemainingDailyRequests(
    provider: SportsProvider,
  ): Promise<number | null> {
    const config = this.getConfig(provider);

    if (config.dailyLimit === undefined) {
      return null;
    }

    const now = new Date();

    await this.ensurePeriodState(provider, now);

    const state = await this.rateLimitModel
      .findOne({
        provider,
        endpoint: this.PROVIDER_QUOTA_ENDPOINT,
      })
      .lean()
      .exec();

    return Math.max(0, config.dailyLimit - (state?.dailyRequests ?? 0));
  }

  async getRemainingMonthlyRequests(
    provider: SportsProvider,
  ): Promise<number | null> {
    const config = this.getConfig(provider);

    if (config.monthlyLimit === undefined) {
      return null;
    }

    const now = new Date();

    await this.ensurePeriodState(provider, now);

    const state = await this.rateLimitModel
      .findOne({
        provider,
        endpoint: this.PROVIDER_QUOTA_ENDPOINT,
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
        endpoint: this.PROVIDER_QUOTA_ENDPOINT,
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
        endpoint: this.PROVIDER_QUOTA_ENDPOINT,
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
        endpoint: this.PROVIDER_QUOTA_ENDPOINT,
      })
      .exec();
  }

  private async assertQuotaAvailable(
    provider: SportsProvider,
    now: Date,
  ): Promise<void> {
    const config = this.getConfig(provider);

    if (config.dailyLimit === undefined && config.monthlyLimit === undefined) {
      return;
    }

    const state = await this.rateLimitModel
      .findOne({
        provider,
        endpoint: this.PROVIDER_QUOTA_ENDPOINT,
      })
      .lean()
      .exec();

    if (!state) {
      return;
    }

    const dailyPeriod = this.getDailyPeriod(now);
    const monthlyPeriod = this.getMonthlyPeriod(now);

    if (
      config.dailyLimit !== undefined &&
      state.dailyPeriod === dailyPeriod &&
      state.dailyRequests >= config.dailyLimit
    ) {
      throw new SportsProviderQuotaExceededError(provider, 'daily');
    }

    if (
      config.monthlyLimit !== undefined &&
      state.monthlyPeriod === monthlyPeriod &&
      state.monthlyRequests >= config.monthlyLimit
    ) {
      throw new SportsProviderQuotaExceededError(provider, 'monthly');
    }
  }

  private async createQuotaExceededError(
    provider: SportsProvider,
  ): Promise<SportsProviderQuotaExceededError> {
    const config = this.getConfig(provider);

    const now = new Date();

    const state = await this.rateLimitModel
      .findOne({
        provider,
        endpoint: this.PROVIDER_QUOTA_ENDPOINT,
      })
      .lean()
      .exec();

    const dailyPeriod = this.getDailyPeriod(now);

    if (
      config.dailyLimit !== undefined &&
      state?.dailyPeriod === dailyPeriod &&
      (state.dailyRequests ?? 0) >= config.dailyLimit
    ) {
      return new SportsProviderQuotaExceededError(provider, 'daily');
    }

    return new SportsProviderQuotaExceededError(provider, 'monthly');
  }

  // ============================================================
  // PERIOD STATE
  // ============================================================

  private async ensurePeriodState(
    provider: SportsProvider,
    now: Date,
  ): Promise<void> {
    const config = this.getConfig(provider);

    if (config.dailyLimit === undefined && config.monthlyLimit === undefined) {
      return;
    }

    const dailyPeriod = this.getDailyPeriod(now);
    const monthlyPeriod = this.getMonthlyPeriod(now);

    const existing = await this.rateLimitModel
      .findOne({
        provider,
        endpoint: this.PROVIDER_QUOTA_ENDPOINT,
      })
      .lean()
      .exec();

    if (!existing) {
      try {
        await new this.rateLimitModel({
          provider,
          endpoint: this.PROVIDER_QUOTA_ENDPOINT,

          dailyPeriod,
          dailyRequests: 0,

          monthlyPeriod,
          monthlyRequests: 0,
        }).save();

        return;
      } catch (error) {
        if (this.isDuplicateEndpointKeyError(error)) {
          return;
        }

        throw error;
      }
    }

    const update: Record<string, unknown> = {};

    if (
      config.dailyLimit !== undefined &&
      existing.dailyPeriod !== dailyPeriod
    ) {
      update.dailyPeriod = dailyPeriod;
      update.dailyRequests = 0;
    }

    if (
      config.monthlyLimit !== undefined &&
      existing.monthlyPeriod !== monthlyPeriod
    ) {
      update.monthlyPeriod = monthlyPeriod;
      update.monthlyRequests = 0;
    }

    if (Object.keys(update).length === 0) {
      return;
    }

    await this.rateLimitModel
      .updateOne(
        {
          provider,
          endpoint: this.PROVIDER_QUOTA_ENDPOINT,
        },
        {
          $set: update,
        },
      )
      .exec();
  }

  // ============================================================
  // LOCK CLEANUP
  // ============================================================

  async clearExpiredLocks(): Promise<number> {
    const result = await this.rateLimitModel
      .updateMany(
        {
          endpoint: {
            $ne: this.PROVIDER_QUOTA_ENDPOINT,
          },

          lockedUntil: {
            $lt: new Date(),
          },
        },
        {
          $unset: {
            lockedUntil: 1,
          },
        },
      )
      .exec();

    return result.modifiedCount;
  }

  // ============================================================
  // CONFIGURATION
  // ============================================================

  private getConfig(provider: SportsProvider): ProviderLimitConfig {
    const config = this.limits[provider];

    if (!config) {
      throw new Error(
        `No rate-limit configuration exists for provider: ${provider}`,
      );
    }

    return config;
  }

  private normalizeEndpoint(endpoint: string): string {
    const normalized = endpoint.trim().toLowerCase();

    if (!normalized) {
      throw new Error('Rate-limit endpoint cannot be empty');
    }

    if (normalized === this.PROVIDER_QUOTA_ENDPOINT) {
      throw new Error(
        `The endpoint name "${this.PROVIDER_QUOTA_ENDPOINT}" is reserved`,
      );
    }

    return normalized;
  }

  // ============================================================
  // ERRORS
  // ============================================================

  private isDuplicateEndpointKeyError(error: unknown): boolean {
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
      Boolean(candidate.keyPattern?.endpoint) &&
      Boolean(candidate.keyValue?.provider) &&
      Boolean(candidate.keyValue?.endpoint)
    );
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private getDailyPeriod(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private getMonthlyPeriod(date: Date): string {
    return date.toISOString().slice(0, 7);
  }

  private async sleep(milliseconds: number): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, Math.max(0, milliseconds));
    });
  }
}
