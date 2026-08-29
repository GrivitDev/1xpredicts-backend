import { Injectable } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model, Types } from 'mongoose';

import {
  AnalyticsSession,
  AnalyticsSessionDocument,
} from './schemas/analytics-session.schema';

import { AnalyticsVisitorType } from './enums/analytics-visitor-type.enum';

import { TrackSessionDto } from './dto/track-session.dto';

@Injectable()
export class WebsiteAnalyticsSessionService {
  constructor(
    @InjectModel(AnalyticsSession.name)
    private readonly sessionModel: Model<AnalyticsSessionDocument>,
  ) {}

  // =========================================================
  // CREATE OR UPDATE SESSION
  // =========================================================

  async trackSession(payload: TrackSessionDto, userId?: string) {
    const now = this.parseDate(payload.timestamp);

    const visitorType = userId
      ? AnalyticsVisitorType.REGISTERED
      : (payload.visitorType ?? AnalyticsVisitorType.ANONYMOUS);

    let session = await this.sessionModel.findOne({
      sessionId: payload.sessionId,
    });

    // =======================================================
    // CREATE
    // =======================================================

    if (!session) {
      session = await this.sessionModel.create({
        sessionId: payload.sessionId,

        visitorId: payload.visitorId,

        userId: userId ? new Types.ObjectId(userId) : null,

        visitorType,

        startedAt: now,

        lastActiveAt: now,

        endedAt: null,

        durationMs: payload.durationMs ?? 0,

        activeTimeMs: payload.activeTimeMs ?? 0,

        landingPage: payload.landingPage ?? payload.path ?? '',

        exitPage: payload.exitPage ?? payload.path ?? '',

        currentPage: payload.path ?? '',

        pageViews: payload.pageViews ?? 0,

        eventCount: payload.eventCount ?? 0,

        bounced: payload.bounced ?? true,

        isActive: payload.isActive ?? true,

        deviceType: payload.deviceType ?? '',

        browser: payload.browser ?? '',

        operatingSystem: payload.operatingSystem ?? '',

        screenWidth: payload.screenWidth ?? 0,

        screenHeight: payload.screenHeight ?? 0,

        referrer: payload.referrer ?? '',

        utmSource: payload.utmSource ?? '',

        utmMedium: payload.utmMedium ?? '',

        utmCampaign: payload.utmCampaign ?? '',

        utmTerm: payload.utmTerm ?? '',

        utmContent: payload.utmContent ?? '',

        country: payload.country ?? '',

        countryCode: payload.countryCode ?? '',

        region: payload.region ?? '',

        city: payload.city ?? '',
      });

      return {
        sessionId: session.sessionId,

        created: true,

        durationMs: session.durationMs,

        activeTimeMs: session.activeTimeMs,
      };
    }

    // =======================================================
    // UPDATE
    // =======================================================

    const calculatedDurationMs = Math.max(
      0,
      now.getTime() - session.startedAt.getTime(),
    );

    if (userId) {
      session.userId = new Types.ObjectId(userId);

      session.visitorType = AnalyticsVisitorType.REGISTERED;
    }

    session.lastActiveAt = now;

    session.durationMs = Math.max(
      session.durationMs,
      calculatedDurationMs,
      payload.durationMs ?? 0,
    );

    session.activeTimeMs = Math.max(
      session.activeTimeMs,
      payload.activeTimeMs ?? 0,
    );

    if (payload.path) {
      session.currentPage = payload.path;

      session.exitPage = payload.path;
    }

    if (typeof payload.pageViews === 'number') {
      session.pageViews = Math.max(session.pageViews, payload.pageViews);
    }

    if (typeof payload.eventCount === 'number') {
      session.eventCount = Math.max(session.eventCount, payload.eventCount);
    }

    if (typeof payload.isActive === 'boolean') {
      session.isActive = payload.isActive;
    }

    if (typeof payload.bounced === 'boolean') {
      session.bounced = payload.bounced;
    }

    await session.save();

    return {
      sessionId: session.sessionId,

      created: false,

      durationMs: session.durationMs,

      activeTimeMs: session.activeTimeMs,
    };
  }

  // =========================================================
  // END SESSION
  // =========================================================

  async endSession(
    sessionId: string,
    payload?: {
      timestamp?: string;
      path?: string;
      durationMs?: number;
      activeTimeMs?: number;
      pageViews?: number;
      eventCount?: number;
    },
    userId?: string,
  ) {
    const session = await this.sessionModel.findOne({
      sessionId,
    });

    if (!session) {
      return null;
    }
    if (userId) {
      session.userId = new Types.ObjectId(userId);
      session.visitorType = AnalyticsVisitorType.REGISTERED;
    }
    const endedAt = this.parseDate(payload?.timestamp);

    const durationMs = Math.max(
      session.durationMs,
      endedAt.getTime() - session.startedAt.getTime(),
      payload?.durationMs ?? 0,
    );

    const activeTimeMs = Math.max(
      session.activeTimeMs,
      payload?.activeTimeMs ?? 0,
    );

    session.endedAt = endedAt;

    session.lastActiveAt = endedAt;

    session.isActive = false;

    session.durationMs = durationMs;

    session.activeTimeMs = activeTimeMs;

    if (payload?.path) {
      session.currentPage = payload.path;

      session.exitPage = payload.path;
    }

    if (typeof payload?.pageViews === 'number') {
      session.pageViews = Math.max(session.pageViews, payload.pageViews);
    }

    if (typeof payload?.eventCount === 'number') {
      session.eventCount = Math.max(session.eventCount, payload.eventCount);
    }

    session.bounced = session.pageViews <= 1;

    await session.save();

    return {
      sessionId: session.sessionId,

      durationMs: session.durationMs,

      activeTimeMs: session.activeTimeMs,

      pageViews: session.pageViews,

      bounced: session.bounced,
    };
  }

  // =========================================================
  // CLEANUP INACTIVE SESSIONS
  // =========================================================

  async cleanupInactiveSessions(inactivityMs = 5 * 60 * 1000) {
    const cutoff = new Date(Date.now() - inactivityMs);

    const result = await this.sessionModel.updateMany(
      {
        isActive: true,

        lastActiveAt: {
          $lt: cutoff,
        },
      },
      {
        $set: {
          isActive: false,

          endedAt: new Date(),
        },
      },
    );

    return {
      modified: result.modifiedCount,
    };
  }

  // =========================================================
  // DATE
  // =========================================================

  private parseDate(value?: string): Date {
    if (!value) {
      return new Date();
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? new Date() : date;
  }
}
