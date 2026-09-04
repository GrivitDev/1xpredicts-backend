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
}

@Injectable()
export class SportsProviderRateLimitService {
  private readonly logger = new Logger(SportsProviderRateLimitService.name);

  constructor(private readonly redisService: SportsRedisService) {}

  // ============================================================
  // EXECUTE PROVIDER REQUEST
  // ============================================================

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
    const usageKey = this.getUsageKey(provider);

    while (true) {
      if (limit.dailyRequestLimit !== undefined) {
        const used = await this.getUsage(usageKey);

        if (used >= limit.dailyRequestLimit) {
          throw new ServiceUnavailableException(
            `${provider} daily request limit reached (${limit.dailyRequestLimit})`,
          );
        }
      }

      const lockAcquired = await this.redisService.setIfNotExists(
        lockKey,
        Date.now().toString(),
        limit.minIntervalSeconds,
      );

      if (lockAcquired) {
        break;
      }

      const ttl = await this.redisService.ttl(lockKey);

      const waitSeconds = ttl > 0 ? ttl : 1;

      await this.sleep(waitSeconds * 1000);
    }

    /*
     * Re-check the daily limit after waiting for the provider lock.
     * Another waiting caller may have consumed the remaining quota.
     */
    if (limit.dailyRequestLimit !== undefined) {
      const used = await this.getUsage(usageKey);

      if (used >= limit.dailyRequestLimit) {
        throw new ServiceUnavailableException(
          `${provider} daily request limit reached (${limit.dailyRequestLimit})`,
        );
      }
    }

    /*
     * Count the request before sending it.
     *
     * The provider request has now been admitted and is therefore
     * counted even if the external provider later returns an error.
     */
    await this.incrementUsage(usageKey);

    try {
      return await request();
    } catch (error) {
      this.logger.warn(`${provider} request failed after rate-limit admission`);

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

    return this.getUsage(this.getUsageKey(provider));
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
  // LIMIT CONFIGURATION
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

          dailyRequestLimit:
            SPORTS_DATA_COLLECTION_CONFIG.ODDS_API.dailyRequestLimit,
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

  private getUsageKey(provider: SportsProvider): string {
    const date = new Date().toISOString().slice(0, 10);

    return `2xpredict:sports:provider-usage:${provider}:${date}`;
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

  private async incrementUsage(key: string): Promise<void> {
    const value = await this.redisService.increment(key);

    if (value === null) {
      throw new ServiceUnavailableException(
        'Provider request blocked because Redis usage tracking failed',
      );
    }
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
