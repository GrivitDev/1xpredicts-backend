import { Module } from '@nestjs/common';

import { MongooseModule } from '@nestjs/mongoose';

import { WebsiteAnalyticsController } from './website-analytics.controller';

import { WebsiteAnalyticsService } from './website-analytics.service';

import { WebsiteAnalyticsSessionService } from './website-analytics-session.service';

import { WebsiteAnalyticsAggregationService } from './website-analytics-aggregation.service';

import {
  AnalyticsEvent,
  AnalyticsEventSchema,
} from './schemas/analytics-event.schema';

import {
  AnalyticsVisitor,
  AnalyticsVisitorSchema,
} from './schemas/analytics-visitor.schema';

import {
  AnalyticsSession,
  AnalyticsSessionSchema,
} from './schemas/analytics-session.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: AnalyticsEvent.name,
        schema: AnalyticsEventSchema,
      },

      {
        name: AnalyticsVisitor.name,
        schema: AnalyticsVisitorSchema,
      },

      {
        name: AnalyticsSession.name,
        schema: AnalyticsSessionSchema,
      },
    ]),
  ],

  controllers: [WebsiteAnalyticsController],

  providers: [
    WebsiteAnalyticsService,
    WebsiteAnalyticsSessionService,
    WebsiteAnalyticsAggregationService,
  ],

  exports: [
    WebsiteAnalyticsService,
    WebsiteAnalyticsSessionService,
    WebsiteAnalyticsAggregationService,
  ],
})
export class WebsiteAnalyticsModule {}
