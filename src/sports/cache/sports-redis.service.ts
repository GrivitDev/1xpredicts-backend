import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import Redis from 'ioredis';

@Injectable()
export class SportsRedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SportsRedisService.name);

  private redis: Redis | null = null;

  async onModuleInit(): Promise<void> {
    const redisUrl = process.env.REDIS_URL?.trim();

    if (!redisUrl) {
      this.logger.warn(
        'REDIS_URL is not configured. Sports Redis cache is disabled.',
      );

      return;
    }

    if (!redisUrl.startsWith('rediss://')) {
      this.logger.error(
        'REDIS_URL must use rediss:// for the configured Upstash Redis instance.',
      );

      return;
    }

    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      connectTimeout: 10_000,

      retryStrategy: (times) => {
        const delay = Math.min(times * 1_000, 10_000);

        this.logger.warn(`Redis reconnect attempt ${times} in ${delay}ms`);

        return delay;
      },
    });

    this.redis.on('connect', () => {
      this.logger.log('Sports Redis connection established');
    });

    this.redis.on('ready', () => {
      this.logger.log('Sports Redis cache is ready');
    });

    this.redis.on('error', (error) => {
      this.logger.error(`Redis error: ${error.message}`);
    });

    this.redis.on('close', () => {
      this.logger.warn('Sports Redis connection closed');
    });

    this.redis.on('reconnecting', (delay) => {
      this.logger.warn(`Sports Redis reconnecting in ${delay}ms`);
    });

    try {
      await this.redis.ping();

      this.logger.log('Sports Redis PING successful');
    } catch (error) {
      this.logger.error(
        'Initial Redis connection failed',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.redis) {
      return;
    }

    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect();
    } finally {
      this.redis = null;
    }
  }

  // ============================================================
  // CONNECTION
  // ============================================================

  isAvailable(): boolean {
    return this.redis?.status === 'ready';
  }

  // ============================================================
  // GET
  // ============================================================

  async get<T>(key: string): Promise<T | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const value = await this.redis!.get(key);

      if (value === null || value === undefined) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error(
        `Redis GET failed for ${key}`,
        error instanceof Error ? error.message : String(error),
      );

      return null;
    }
  }

  // ============================================================
  // SET
  // ============================================================

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      await this.redis!.set(key, JSON.stringify(value), 'EX', ttlSeconds);

      return true;
    } catch (error) {
      this.logger.error(
        `Redis SET failed for ${key}`,
        error instanceof Error ? error.message : String(error),
      );

      return false;
    }
  }

  // ============================================================
  // SET IF NOT EXISTS
  // ============================================================

  async setIfNotExists(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const result = await this.redis!.set(key, value, 'EX', ttlSeconds, 'NX');

      return result === 'OK';
    } catch (error) {
      this.logger.error(
        `Redis SET NX failed for ${key}`,
        error instanceof Error ? error.message : String(error),
      );

      return false;
    }
  }

  // ============================================================
  // INCREMENT
  // ============================================================

  async increment(key: string): Promise<number | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      return await this.redis!.incr(key);
    } catch (error) {
      this.logger.error(
        `Redis INCR failed for ${key}`,
        error instanceof Error ? error.message : String(error),
      );

      return null;
    }
  }

  // ============================================================
  // DELETE
  // ============================================================

  async delete(key: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      await this.redis!.del(key);

      return true;
    } catch (error) {
      this.logger.error(
        `Redis DELETE failed for ${key}`,
        error instanceof Error ? error.message : String(error),
      );

      return false;
    }
  }

  // ============================================================
  // EXISTS
  // ============================================================

  async exists(key: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      return (await this.redis!.exists(key)) === 1;
    } catch (error) {
      this.logger.error(
        `Redis EXISTS failed for ${key}`,
        error instanceof Error ? error.message : String(error),
      );

      return false;
    }
  }

  // ============================================================
  // TTL
  // ============================================================

  async ttl(key: string): Promise<number> {
    if (!this.isAvailable()) {
      return -1;
    }

    try {
      return await this.redis!.ttl(key);
    } catch (error) {
      this.logger.error(
        `Redis TTL failed for ${key}`,
        error instanceof Error ? error.message : String(error),
      );

      return -1;
    }
  }

  // ============================================================
  // DELETE BY PREFIX
  // ============================================================

  async deleteByPrefix(prefix: string): Promise<number> {
    if (!this.isAvailable()) {
      return 0;
    }

    let cursor = '0';
    let deleted = 0;

    try {
      do {
        const [nextCursor, keys] = await this.redis!.scan(
          cursor,
          'MATCH',
          `${prefix}*`,
          'COUNT',
          100,
        );

        cursor = nextCursor;

        if (keys.length > 0) {
          deleted += await this.redis!.del(...keys);
        }
      } while (cursor !== '0');

      return deleted;
    } catch (error) {
      this.logger.error(
        `Redis prefix deletion failed for ${prefix}`,
        error instanceof Error ? error.message : String(error),
      );

      return deleted;
    }
  }

  // ============================================================
  // FLUSH SPORTS CACHE
  // ============================================================

  async clearSportsCache(): Promise<number> {
    return this.deleteByPrefix('2xpredict:sports:');
  }
}
