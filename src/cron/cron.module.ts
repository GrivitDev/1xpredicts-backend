// src/cron/cron.module.ts

import { Module } from '@nestjs/common';

import { CronService } from './cron.service';

import { SettlementCronService } from './settlement.cron.service';

import { UsersModule } from '../users/users.module';

import { PaymentsModule } from '../payments/payments.module';

import { PredictionsModule } from '../predictions/predictions.module';

import { CommunityModule } from '../community/community.module';

import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [
    UsersModule,

    PaymentsModule,

    PredictionsModule,

    CommunityModule,

    TelegramModule,
  ],

  providers: [CronService, SettlementCronService],
})
export class CronModule {}
