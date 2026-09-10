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
   * Prevents a second request from starting
   * before the provider interval expires.
   */
  @Prop({
    type: Date,
    index: true,
  })
  lockedUntil?: Date;

  /**
   * Last provider request slot acquisition.
   */
  @Prop({
    type: Date,
    index: true,
  })
  lastRequestAt?: Date;

  /**
   * Current UTC day: YYYY-MM-DD
   */
  @Prop({
    required: true,
    default: '',
    index: true,
  })
  dailyPeriod!: string;

  /**
   * Requests used during dailyPeriod.
   */
  @Prop({
    required: true,
    default: 0,
    min: 0,
  })
  dailyRequests!: number;

  /**
   * Current UTC month: YYYY-MM
   */
  @Prop({
    required: true,
    default: '',
    index: true,
  })
  monthlyPeriod!: string;

  /**
   * Requests used during monthlyPeriod.
   */
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
