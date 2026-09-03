import { Global, Module } from '@nestjs/common';

import { SportsRedisService } from './sports-redis.service';

@Global()
@Module({
  providers: [SportsRedisService],

  exports: [SportsRedisService],
})
export class SportsCacheModule {}
