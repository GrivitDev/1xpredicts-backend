import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

export type SportsProviderRateLimitDocument =
  HydratedDocument<SportsProviderRateLimit>;

@Schema({
  timestamps: true,
  collection: 'sports_provider_rate_limits',
})
export class SportsProviderRateLimit {
  @Prop({
    required: true,
    unique: true,
    index: true,
    trim: true,
  })
  provider!: string;

  /**
   * Prevents another request from being started before
   * the provider's minimum interval has elapsed.
   */
  @Prop({
    type: Date,
    index: true,
  })
  lockedUntil?: Date;

  /**
   * Time at which the last request slot was acquired.
   */
  @Prop({
    type: Date,
    index: true,
  })
  lastRequestAt?: Date;

  /**
   * Current UTC day represented by dailyRequests.
   *
   * Format: YYYY-MM-DD
   */
  @Prop({
    required: true,
    default: '',
    index: true,
  })
  dailyPeriod!: string;

  @Prop({
    required: true,
    default: 0,
    min: 0,
  })
  dailyRequests!: number;

  /**
   * Current UTC month represented by monthlyRequests.
   *
   * Format: YYYY-MM
   */
  @Prop({
    required: true,
    default: '',
    index: true,
  })
  monthlyPeriod!: string;

  @Prop({
    required: true,
    default: 0,
    min: 0,
  })
  monthlyRequests!: number;
}

export const SportsProviderRateLimitSchema = SchemaFactory.createForClass(
  SportsProviderRateLimit,
);

SportsProviderRateLimitSchema.index({
  provider: 1,
  lockedUntil: 1,
});

SportsProviderRateLimitSchema.index({
  provider: 1,
  dailyPeriod: 1,
});

SportsProviderRateLimitSchema.index({
  provider: 1,
  monthlyPeriod: 1,
});
