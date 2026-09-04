import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

import { SportsRedisService } from '../cache/sports-redis.service';

import { SPORTS_DATA_COLLECTION_CONFIG } from '../config/sports-data-collection.config';

export type SportsProvider =
  | 'api-football'
  | 'odds-api'
  | 'football-data'
  | 'thesportsdb'
  | 'youtube';

interface ProviderLimit {
  minIntervalSeconds: number;
  dailyRequestLimit?: number;
  monthlyRequestLimit?: number;
}

@Injectable()
export class SportsProviderRateLimitService {
  private readonly logger = new Logger(SportsProviderRateLimitService.name);

  constructor(private readonly redisService: SportsRedisService) {}

  /**
   * Executes exactly one outbound provider request.
   *
   * Every admitted request:
   *
   * 1. consumes one 60-second provider slot;
   * 2. consumes one configured provider quota unit;
   * 3. applies equally to normal requests and retries.
   *
   * The actual HTTP request MUST be passed through this callback.
   */
  async execute<T>(
    provider: SportsProvider,
    request: () => Promise<T>,
  ): Promise<T> {
    const limit = this.getProviderLimit(provider);

    if (!this.redisService.isAvailable()) {
      throw new ServiceUnavailableException(
        `${provider} request blocked because Redis rate limiting is unavailable`,
      );
    }

    const lockKey = this.getLockKey(provider);

    /*
     * Each provider has its own lock.
     *
     * Therefore:
     *
     * API-Football waiting does not block Odds API.
     * Odds API waiting does not block YouTube.
     * YouTube waiting does not block TheSportsDB.
     */
    while (true) {
      await this.assertQuotaAvailable(provider, limit);

      const lockAcquired = await this.redisService.setIfNotExists(
        lockKey,
        Date.now().toString(),
        limit.minIntervalSeconds,
      );

      if (lockAcquired) {
        break;
      }

      const ttl = await this.redisService.ttl(lockKey);

      /*
       * Redis TTL is returned in seconds.
       *
       * If the lock disappears between SET NX and TTL, simply retry
       * immediately. The loop will safely attempt to acquire the slot.
       */
      const waitSeconds = ttl > 0 ? ttl : 1;

      await this.sleep(waitSeconds * 1000);
    }

    /*
     * The request may have waited for the slot.
     *
     * During that wait another worker could have consumed the final
     * daily/monthly quota unit, so check the quota again before
     * consuming this slot.
     */
    await this.assertQuotaAvailable(provider, limit);

    /*
     * Count the request BEFORE executing it.
     *
     * An HTTP request that receives a 4xx/5xx/network error has still
     * been sent to the provider and therefore still consumes the
     * provider's external API request allowance.
     *
     * A retry must therefore come through execute() again and consume
     * another slot and another quota unit.
     */
    await this.incrementUsage(provider, limit);

    try {
      return await request();
    } catch (error) {
      this.logger.warn(
        `${provider} request failed after consuming rate-limit slot and quota`,
      );

      throw error;
    }
  }

  // ============================================================
  // DAILY USAGE
  // ============================================================

  async getDailyUsage(provider: SportsProvider): Promise<number> {
    if (!this.redisService.isAvailable()) {
      return 0;
    }

    const limit = this.getProviderLimit(provider);

    if (limit.dailyRequestLimit === undefined) {
      return 0;
    }

    return this.getUsage(this.getDailyUsageKey(provider));
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
    if (!this.redisService.isAvailable()) {
      return 0;
    }

    const limit = this.getProviderLimit(provider);

    if (limit.monthlyRequestLimit === undefined) {
      return 0;
    }

    return this.getUsage(this.getMonthlyUsageKey(provider));
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
  // QUOTA
  // ============================================================

  private async assertQuotaAvailable(
    provider: SportsProvider,
    limit: ProviderLimit,
  ): Promise<void> {
    if (limit.dailyRequestLimit !== undefined) {
      const dailyUsage = await this.getUsage(this.getDailyUsageKey(provider));

      if (dailyUsage >= limit.dailyRequestLimit) {
        throw new ServiceUnavailableException(
          `${provider} daily request limit reached (${limit.dailyRequestLimit})`,
        );
      }
    }

    if (limit.monthlyRequestLimit !== undefined) {
      const monthlyUsage = await this.getUsage(
        this.getMonthlyUsageKey(provider),
      );

      if (monthlyUsage >= limit.monthlyRequestLimit) {
        throw new ServiceUnavailableException(
          `${provider} monthly request limit reached (${limit.monthlyRequestLimit})`,
        );
      }
    }
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

      case 'odds-api':
        return {
          minIntervalSeconds:
            SPORTS_DATA_COLLECTION_CONFIG.ODDS_API.rateLimit.minIntervalSeconds,

          monthlyRequestLimit:
            SPORTS_DATA_COLLECTION_CONFIG.ODDS_API.monthlyRequestLimit,
        };

      case 'football-data':
        return {
          minIntervalSeconds:
            SPORTS_DATA_COLLECTION_CONFIG.FOOTBALL_DATA.rateLimit
              .minIntervalSeconds,
        };

      case 'thesportsdb':
        return {
          minIntervalSeconds:
            SPORTS_DATA_COLLECTION_CONFIG.THESPORTSDB.rateLimit
              .minIntervalSeconds,
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
  // REDIS KEYS
  // ============================================================

  private getLockKey(provider: SportsProvider): string {
    return `2xpredict:sports:provider-lock:${provider}`;
  }

  private getDailyUsageKey(provider: SportsProvider): string {
    const date = new Date().toISOString().slice(0, 10);

    return `2xpredict:sports:provider-usage:${provider}:daily:${date}`;
  }

  private getMonthlyUsageKey(provider: SportsProvider): string {
    const month = new Date().toISOString().slice(0, 7);

    return `2xpredict:sports:provider-usage:${provider}:monthly:${month}`;
  }

  // ============================================================
  // USAGE
  // ============================================================

  private async getUsage(key: string): Promise<number> {
    const value = await this.redisService.get<string>(key);

    if (value === null) {
      return 0;
    }

    const usage = Number(value);

    return Number.isFinite(usage) ? usage : 0;
  }

  private async incrementUsage(
    provider: SportsProvider,
    limit: ProviderLimit,
  ): Promise<void> {
    if (limit.dailyRequestLimit !== undefined) {
      const value = await this.redisService.incrementWithTtl(
        this.getDailyUsageKey(provider),
        this.getDailyUsageTtlSeconds(),
      );

      if (value === null) {
        throw new ServiceUnavailableException(
          `${provider} request blocked because Redis daily usage tracking failed`,
        );
      }

      return;
    }

    if (limit.monthlyRequestLimit !== undefined) {
      const value = await this.redisService.incrementWithTtl(
        this.getMonthlyUsageKey(provider),
        this.getMonthlyUsageTtlSeconds(),
      );

      if (value === null) {
        throw new ServiceUnavailableException(
          `${provider} request blocked because Redis monthly usage tracking failed`,
        );
      }
    }
  }

  // ============================================================
  // USAGE TTL
  // ============================================================

  private getDailyUsageTtlSeconds(): number {
    /*
     * 25 hours.
     *
     * The key itself contains the UTC date, so this buffer simply
     * guarantees that the counter survives the entire relevant day
     * even around a date boundary.
     */
    return 25 * 60 * 60;
  }

  private getMonthlyUsageTtlSeconds(): number {
    /*
     * 32 days.
     *
     * The key contains YYYY-MM, so the counter naturally changes
     * with the month. The extended TTL prevents premature deletion
     * during longer calendar months.
     */
    return 32 * 24 * 60 * 60;
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
