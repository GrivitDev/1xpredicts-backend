import { Injectable, Logger } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model, Types } from 'mongoose';

import {
  AnalyticsEvent,
  AnalyticsEventDocument,
} from './schemas/analytics-event.schema';

import {
  AnalyticsVisitor,
  AnalyticsVisitorDocument,
} from './schemas/analytics-visitor.schema';

import { TrackEventDto, TrackEventsDto } from './dto/track-events.dto';

import { AnalyticsVisitorType } from './enums/analytics-visitor-type.enum';

@Injectable()
export class WebsiteAnalyticsService {
  private readonly logger = new Logger(WebsiteAnalyticsService.name);

  constructor(
    @InjectModel(AnalyticsEvent.name)
    private readonly eventModel: Model<AnalyticsEventDocument>,

    @InjectModel(AnalyticsVisitor.name)
    private readonly visitorModel: Model<AnalyticsVisitorDocument>,
  ) {}

  // =========================================================
  // TRACK EVENTS
  // =========================================================

  async trackEvents(payload: TrackEventsDto, userId?: string) {
    if (!payload.events?.length) {
      return {
        accepted: 0,
        duplicate: 0,
      };
    }

    const events = payload.events
      .slice(0, 50)
      .map((event) => this.normalizeEvent(event, userId));

    const eventIds = events
      .map((event) => event.eventId)
      .filter((id): id is string => Boolean(id));

    // ---------------------------------------------------------
    // Find events that were already stored.
    // ---------------------------------------------------------

    const existing = eventIds.length
      ? await this.eventModel
          .find(
            {
              eventId: {
                $in: eventIds,
              },
            },
            {
              eventId: 1,
            },
          )
          .lean()
      : [];

    const existingIds = new Set(existing.map((event) => event.eventId));

    const newEvents = events.filter(
      (event) => event.eventId && !existingIds.has(event.eventId),
    );

    if (!newEvents.length) {
      return {
        accepted: 0,
        duplicate: events.length,
      };
    }

    // ---------------------------------------------------------
    // Insert only new events.
    // ---------------------------------------------------------

    try {
      await this.eventModel.insertMany(newEvents, {
        ordered: false,
      });
    } catch (error: any) {
      /*
       * Another request may have inserted the same
       * event between the lookup above and insertMany().
       *
       * Duplicate-key errors are therefore safely ignored.
       */

      if (error?.code !== 11000 && !Array.isArray(error?.writeErrors)) {
        this.logger.error('Failed to store analytics events', error);

        throw error;
      }
    }

    await this.updateVisitors(newEvents);

    return {
      accepted: newEvents.length,
      duplicate: events.length - newEvents.length,
    };
  }

  // =========================================================
  // NORMALIZE EVENT
  // =========================================================

  private normalizeEvent(
    event: TrackEventDto,
    userId?: string,
  ): Partial<AnalyticsEvent> {
    const occurredAt = new Date(event.occurredAt);

    const visitorType = userId
      ? AnalyticsVisitorType.REGISTERED
      : AnalyticsVisitorType.ANONYMOUS;

    return {
      eventId: event.eventId,

      visitorId: event.visitorId,

      sessionId: event.sessionId,

      userId: userId ? new Types.ObjectId(userId) : null,

      visitorType,

      eventType: event.eventType,

      eventName: event.eventName,

      path: event.path,

      pageTitle: event.pageTitle ?? '',

      url: event.url ?? '',

      properties: event.properties ?? {},

      occurredAt: Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt,

      durationMs: event.durationMs ?? 0,

      deviceType: event.deviceType ?? '',

      browser: event.browser ?? '',

      operatingSystem: event.operatingSystem ?? '',

      screenWidth: event.screenWidth ?? 0,

      screenHeight: event.screenHeight ?? 0,

      referrer: event.referrer ?? '',

      utmSource: event.utmSource ?? '',

      utmMedium: event.utmMedium ?? '',

      utmCampaign: event.utmCampaign ?? '',

      utmTerm: event.utmTerm ?? '',

      utmContent: event.utmContent ?? '',

      country: event.country ?? '',

      countryCode: event.countryCode ?? '',

      region: event.region ?? '',

      city: event.city ?? '',

      userAgent: event.userAgent ?? '',
    };
  }

  // =========================================================
  // UPDATE VISITOR SUMMARY
  // =========================================================

  private async updateVisitors(events: Partial<AnalyticsEvent>[]) {
    const visitorMap = new Map<string, Partial<AnalyticsEvent>[]>();

    for (const event of events) {
      if (!event.visitorId) {
        continue;
      }

      const existing = visitorMap.get(event.visitorId) ?? [];

      existing.push(event);

      visitorMap.set(event.visitorId, existing);
    }

    if (!visitorMap.size) {
      return;
    }

    const operations = Array.from(visitorMap.entries()).map(
      ([visitorId, visitorEvents]) => {
        const sorted = [...visitorEvents].sort(
          (a, b) =>
            new Date(b.occurredAt!).getTime() -
            new Date(a.occurredAt!).getTime(),
        );

        const latest = sorted[0];

        const first = sorted[sorted.length - 1];

        const pageViews = visitorEvents.filter(
          (event) => event.eventType === 'page_view',
        ).length;

        const eventCount = visitorEvents.length;

        /*
         * Do not count HEARTBEAT duration as
         * visitor time. Heartbeats represent the
         * current active-time total and are not
         * individual duration intervals.
         *
         * Session/page timing will be maintained
         * by analytics_sessions.
         */
        const totalTimeMs = visitorEvents
          .filter(
            (event) =>
              event.eventType === 'page_exit' ||
              event.eventType === 'session_end',
          )
          .reduce((total, event) => total + (event.durationMs ?? 0), 0);

        return {
          updateOne: {
            filter: {
              visitorId,
            },

            update: {
              $set: {
                userId: latest?.userId ?? null,

                visitorType:
                  latest?.visitorType ?? AnalyticsVisitorType.ANONYMOUS,

                lastSeenAt: latest?.occurredAt ?? new Date(),

                lastPath: latest?.path ?? '',

                deviceType: latest?.deviceType ?? '',

                browser: latest?.browser ?? '',

                operatingSystem: latest?.operatingSystem ?? '',

                country: latest?.country ?? '',

                countryCode: latest?.countryCode ?? '',

                region: latest?.region ?? '',

                city: latest?.city ?? '',
              },

              $setOnInsert: {
                firstSeenAt: first?.occurredAt ?? new Date(),

                firstReferrer: first?.referrer ?? '',

                firstUtmSource: first?.utmSource ?? '',

                firstUtmMedium: first?.utmMedium ?? '',

                firstUtmCampaign: first?.utmCampaign ?? '',
              },

              $inc: {
                totalPageViews: pageViews,

                totalEvents: eventCount,

                totalTimeMs: totalTimeMs,
              },
            },

            upsert: true,
          },
        };
      },
    );

    try {
      await this.visitorModel.bulkWrite(operations, {
        ordered: false,
      });
    } catch (error) {
      this.logger.error('Failed to update analytics visitors', error);
    }
  }
}
