import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { AnalyticsVisitorType } from '../enums/analytics-visitor-type.enum';

export type AnalyticsVisitorDocument = HydratedDocument<AnalyticsVisitor>;

@Schema({
  timestamps: true,
  collection: 'analytics_visitors',
})
export class AnalyticsVisitor {
  // ==========================================
  // IDENTIFICATION
  // ==========================================

  @Prop({
    required: true,
    unique: true,
    index: true,
  })
  visitorId!: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  })
  userId?: Types.ObjectId | null;

  @Prop({
    enum: AnalyticsVisitorType,
    required: true,
    index: true,
  })
  visitorType!: AnalyticsVisitorType;

  // ==========================================
  // VISIT STATISTICS
  // ==========================================

  @Prop({
    default: 0,
  })
  totalSessions!: number;

  @Prop({
    default: 0,
  })
  totalPageViews!: number;

  @Prop({
    default: 0,
  })
  totalEvents!: number;

  @Prop({
    default: 0,
  })
  totalTimeMs!: number;

  // ==========================================
  // FIRST / LAST ACTIVITY
  // ==========================================

  @Prop({
    default: null,
    index: true,
  })
  firstSeenAt?: Date | null;

  @Prop({
    default: null,
    index: true,
  })
  lastSeenAt?: Date | null;

  // ==========================================
  // LAST KNOWN PAGE
  // ==========================================

  @Prop({
    default: '',
  })
  lastPath!: string;

  // ==========================================
  // DEVICE
  // ==========================================

  @Prop({
    default: '',
  })
  deviceType!: string;

  @Prop({
    default: '',
  })
  browser!: string;

  @Prop({
    default: '',
  })
  operatingSystem!: string;

  // ==========================================
  // LOCATION
  // ==========================================

  @Prop({
    default: '',
  })
  country!: string;

  @Prop({
    default: '',
  })
  countryCode!: string;

  @Prop({
    default: '',
  })
  region!: string;

  @Prop({
    default: '',
  })
  city!: string;

  // ==========================================
  // TRAFFIC SOURCE
  // ==========================================

  @Prop({
    default: '',
  })
  firstReferrer!: string;

  @Prop({
    default: '',
  })
  firstUtmSource!: string;

  @Prop({
    default: '',
  })
  firstUtmMedium!: string;

  @Prop({
    default: '',
  })
  firstUtmCampaign!: string;
}

export const AnalyticsVisitorSchema =
  SchemaFactory.createForClass(AnalyticsVisitor);

AnalyticsVisitorSchema.index({
  lastSeenAt: -1,
});

AnalyticsVisitorSchema.index({
  userId: 1,
  lastSeenAt: -1,
});

AnalyticsVisitorSchema.index({
  visitorType: 1,
  lastSeenAt: -1,
});

AnalyticsVisitorSchema.index({
  countryCode: 1,
  lastSeenAt: -1,
});
