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
   * Endpoint interval throttling.
   *
   * Quota counters are provider-wide and are tracked
   * separately from these endpoint slots.
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
   * Special provider-wide accounting record.
   *
   * This record does not participate in endpoint throttling.
   */
  private readonly PROVIDER_QUOTA_ENDPOINT = '__provider_quota__';

  /**
   * Temporary endpoint lock.
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
   * Execute one outbound provider request.
   *
   * 1. Acquire endpoint slot.
   * 2. Reserve/increment provider-wide request counter.
   * 3. Execute actual provider request.
   * 4. Release endpoint slot.
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

  async acquireSlot(provider: SportsProvider, endpoint: string): Promise<void> {
    const normalizedEndpoint = this.normalizeEndpoint(endpoint);

    const config = this.getConfig(provider);

    while (true) {
      const now = new Date();

      /*
       * Always ensure the provider-wide counter record exists
       * and is on the current daily/monthly period.
       */
      await this.ensurePeriodState(provider, now);

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

      /*
       * Claim this endpoint slot atomically.
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
        if (this.isDuplicateEndpointKeyError(error)) {
          await this.sleep(100);
          continue;
        }

        throw error;
      }

      if (!updated) {
        await this.sleep(250);
        continue;
      }

      /*
       * Now reserve one provider-wide request.
       *
       * This ALWAYS increments the counters.
       *
       * Providers without configured limits are still counted.
       */
      const quotaReserved = await this.reserveProviderQuota(provider, now);

      if (!quotaReserved) {
        /*
         * Release endpoint ownership because the request
         * is not allowed to proceed.
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

      /*
       * Request is officially allowed to leave the application.
       *
       * Record the actual request start time on the endpoint slot.
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

  // ============================================================
  // RELEASE SLOT
  // ============================================================

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
      this.logger.warn(
        `Failed to release rate-limit lock for ${provider}/${normalizedEndpoint}`,
        error,
      );
    }
  }

  // ============================================================
  // PROVIDER QUOTA
  // ============================================================

  /**
   * Provider-wide atomic request accounting.
   *
   * Every provider request increments the appropriate counters.
   *
   * Limits are enforced only when configured.
   */
  private async reserveProviderQuota(
    provider: SportsProvider,
    now: Date,
  ): Promise<boolean> {
    const config = this.getConfig(provider);

    const dailyPeriod = this.getDailyPeriod(now);

    const monthlyPeriod = this.getMonthlyPeriod(now);

    /*
     * First make sure the provider quota record exists
     * and has current period values.
     */
    await this.ensurePeriodState(provider, now);

    const filter: Record<string, unknown> = {
      provider,
      endpoint: this.PROVIDER_QUOTA_ENDPOINT,
      dailyPeriod,
      monthlyPeriod,
    };

    /*
     * Apply limits only when configured.
     */
    if (config.dailyLimit !== undefined) {
      filter.dailyRequests = {
        $lt: config.dailyLimit,
      };
    }

    if (config.monthlyLimit !== undefined) {
      filter.monthlyRequests = {
        ...(filter.monthlyRequests && typeof filter.monthlyRequests === 'object'
          ? filter.monthlyRequests
          : {}),
        $lt: config.monthlyLimit,
      };
    }

    /*
     * Increment every configured counter.
     *
     * At the moment daily/monthly counters exist for
     * every provider, even when no limit is configured.
     */
    const updated = await this.rateLimitModel
      .findOneAndUpdate(
        filter,
        {
          $inc: {
            dailyRequests: 1,
            monthlyRequests: 1,
          },

          $set: {
            provider,
            endpoint: this.PROVIDER_QUOTA_ENDPOINT,
            dailyPeriod,
            monthlyPeriod,
          },
        },
        {
          returnDocument: 'after',
        },
      )
      .exec();

    return Boolean(updated);
  }

  // ============================================================
  // REMAINING DAILY
  // ============================================================

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

  // ============================================================
  // REMAINING MONTHLY
  // ============================================================

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

  // ============================================================
  // DAILY USAGE
  // ============================================================

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

  // ============================================================
  // MONTHLY USAGE
  // ============================================================

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

  // ============================================================
  // QUOTA AVAILABILITY
  // ============================================================

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

  // ============================================================
  // ASSERT QUOTA
  // ============================================================

  private async assertQuotaAvailable(
    provider: SportsProvider,
    now: Date,
  ): Promise<void> {
    const config = this.getConfig(provider);

    /*
     * No configured limits means unlimited,
     * but usage is still tracked.
     */
    if (config.dailyLimit === undefined && config.monthlyLimit === undefined) {
      return;
    }

    await this.ensurePeriodState(provider, now);

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

  // ============================================================
  // QUOTA ERROR
  // ============================================================

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

    const monthlyPeriod = this.getMonthlyPeriod(now);

    if (
      config.dailyLimit !== undefined &&
      state?.dailyPeriod === dailyPeriod &&
      (state.dailyRequests ?? 0) >= config.dailyLimit
    ) {
      return new SportsProviderQuotaExceededError(provider, 'daily');
    }

    if (
      config.monthlyLimit !== undefined &&
      state?.monthlyPeriod === monthlyPeriod &&
      (state.monthlyRequests ?? 0) >= config.monthlyLimit
    ) {
      return new SportsProviderQuotaExceededError(provider, 'monthly');
    }

    /*
     * This should only be reached in an unexpected state,
     * but monthly is the safest fallback.
     */
    return new SportsProviderQuotaExceededError(provider, 'monthly');
  }

  // ============================================================
  // PERIOD STATE
  // ============================================================

  /**
   * Every provider gets a provider-wide quota record,
   * regardless of whether a quota limit is configured.
   */
  private async ensurePeriodState(
    provider: SportsProvider,
    now: Date,
  ): Promise<void> {
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
        await this.rateLimitModel.create({
          provider,

          endpoint: this.PROVIDER_QUOTA_ENDPOINT,

          dailyPeriod,

          dailyRequests: 0,

          monthlyPeriod,

          monthlyRequests: 0,
        });

        return;
      } catch (error) {
        if (this.isDuplicateEndpointKeyError(error)) {
          return;
        }

        throw error;
      }
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
