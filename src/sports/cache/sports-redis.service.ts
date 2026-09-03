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

  private connectionPromise: Promise<void> | null = null;

  async onModuleInit(): Promise<void> {
    const redisUrl = process.env.REDIS_URL?.trim();

    if (!redisUrl) {
      this.logger.warn(
        'REDIS_URL is not configured. Sports Redis cache is disabled.',
      );

      return;
    }

    this.redis = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      connectTimeout: 10_000,
    });

    this.redis.on('error', (error) => {
      this.logger.error(`Redis error: ${error.message}`);
    });

    this.redis.on('ready', () => {
      this.logger.log('Sports Redis cache is ready');
    });

    this.connectionPromise = this.connect();

    await this.connectionPromise;
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.redis) {
      return;
    }

    try {
      if (this.redis.status === 'ready') {
        await this.redis.quit();
      } else {
        this.redis.disconnect();
      }
    } finally {
      this.redis = null;
      this.connectionPromise = null;
    }
  }

  // ============================================================
  // CONNECTION
  // ============================================================

  private async connect(): Promise<void> {
    if (!this.redis) {
      return;
    }

    if (this.redis.status === 'ready') {
      return;
    }

    if (this.redis.status === 'connecting') {
      return;
    }

    try {
      await this.redis.connect();
    } catch (error) {
      this.logger.error(
        'Failed to connect to Redis',
        error instanceof Error ? error.stack : String(error),
      );

      this.redis.disconnect();
      this.redis = null;
    }
  }

  isAvailable(): boolean {
    return this.redis !== null && this.redis.status === 'ready';
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
      const result = await this.redis!.exists(key);

      return result === 1;
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

        if (!keys.length) {
          continue;
        }

        deleted += await this.redis!.del(...keys);
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
