import { Injectable } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import {
  AnalyticsEvent,
  AnalyticsEventDocument,
} from './schemas/analytics-event.schema';

import {
  AnalyticsSession,
  AnalyticsSessionDocument,
} from './schemas/analytics-session.schema';

import {
  AnalyticsVisitor,
  AnalyticsVisitorDocument,
} from './schemas/analytics-visitor.schema';

import { AnalyticsEventType } from './enums/analytics-event-type.enum';

export interface AnalyticsDateQuery {
  from?: string;
  to?: string;
}

@Injectable()
export class WebsiteAnalyticsAggregationService {
  constructor(
    @InjectModel(AnalyticsEvent.name)
    private readonly eventModel: Model<AnalyticsEventDocument>,

    @InjectModel(AnalyticsSession.name)
    private readonly sessionModel: Model<AnalyticsSessionDocument>,

    @InjectModel(AnalyticsVisitor.name)
    private readonly visitorModel: Model<AnalyticsVisitorDocument>,
  ) {}

  // =========================================================
  // OVERVIEW
  // =========================================================

  async getOverview(query: AnalyticsDateQuery = {}) {
    const eventFilter = this.buildDateFilter('occurredAt', query);

    const sessionFilter = this.buildDateFilter('startedAt', query);

    const [
      visitors,
      sessions,
      activeSessions,
      pageViews,
      events,
      sessionTotals,
    ] = await Promise.all([
      this.eventModel.distinct('visitorId', eventFilter),

      this.sessionModel.countDocuments(sessionFilter),

      this.sessionModel.countDocuments({
        ...sessionFilter,

        isActive: true,
      }),

      this.eventModel.countDocuments({
        ...eventFilter,

        eventType: AnalyticsEventType.PAGE_VIEW,
      }),

      this.eventModel.countDocuments(eventFilter),

      this.sessionModel.aggregate<{
        totalTimeMs: number;
        totalActiveTimeMs: number;
        averageSessionDurationMs: number;
        bouncedSessions: number;
        totalSessions: number;
      }>([
        {
          $match: sessionFilter,
        },

        {
          $group: {
            _id: null,

            totalTimeMs: {
              $sum: {
                $ifNull: ['$durationMs', 0],
              },
            },

            totalActiveTimeMs: {
              $sum: {
                $ifNull: ['$activeTimeMs', 0],
              },
            },

            averageSessionDurationMs: {
              $avg: {
                $ifNull: ['$durationMs', 0],
              },
            },

            bouncedSessions: {
              $sum: {
                $cond: ['$bounced', 1, 0],
              },
            },

            totalSessions: {
              $sum: 1,
            },
          },
        },
      ]),
    ]);

    const totals = sessionTotals[0] ?? {
      totalTimeMs: 0,
      totalActiveTimeMs: 0,
      averageSessionDurationMs: 0,
      bouncedSessions: 0,
      totalSessions: sessions,
    };

    const bounceRate =
      sessions > 0
        ? Number(((totals.bouncedSessions / sessions) * 100).toFixed(2))
        : 0;

    return {
      visitors: visitors.length,

      sessions,

      activeSessions,

      pageViews,

      events,

      totalTimeMs: totals.totalTimeMs ?? 0,

      totalActiveTimeMs: totals.totalActiveTimeMs ?? 0,

      averageSessionDurationMs: Math.round(
        totals.averageSessionDurationMs ?? 0,
      ),

      averageActiveSessionTimeMs:
        sessions > 0
          ? Math.round((totals.totalActiveTimeMs ?? 0) / sessions)
          : 0,

      bounceRate,

      bouncedSessions: totals.bouncedSessions ?? 0,
    };
  }

  // =========================================================
  // DASHBOARD SUMMARY
  // =========================================================

  async getDashboardSummary(query: AnalyticsDateQuery = {}) {
    const overview = await this.getOverview(query);

    const [
      visitors,
      pages,
      devices,
      browsers,
      operatingSystems,
      countries,
      sources,
      events,
    ] = await Promise.all([
      this.getVisitorBreakdown(query),

      this.getTopPages(query, 10),

      this.getDevices(query),

      this.getBrowsers(query),

      this.getOperatingSystems(query),

      this.getCountries(query, 10),

      this.getTrafficSources(query, 10),

      this.getEventTypes(query, 10),
    ]);

    return {
      overview,

      visitors,

      pages,

      technology: {
        devices,

        browsers,

        operatingSystems,
      },

      geography: {
        countries,
      },

      traffic: {
        sources,
      },

      events,
    };
  }

  // =========================================================
  // VISITOR BREAKDOWN
  // =========================================================

  async getVisitorBreakdown(query: AnalyticsDateQuery = {}) {
    const filter = this.buildDateFilter('startedAt', query);

    const result = await this.sessionModel.aggregate<{
      _id: string;
      visitors: string[];
    }>([
      {
        $match: filter,
      },

      {
        $group: {
          _id: '$visitorType',

          visitors: {
            $addToSet: '$visitorId',
          },
        },
      },
    ]);

    return result.map((item) => ({
      visitorType: item._id,

      visitors: item.visitors.length,
    }));
  }

  // =========================================================
  // TOP PAGES
  // =========================================================

  async getTopPages(query: AnalyticsDateQuery = {}, limit = 20) {
    const filter = this.buildDateFilter('occurredAt', query);

    return this.eventModel.aggregate([
      {
        $match: {
          ...filter,

          eventType: AnalyticsEventType.PAGE_VIEW,
        },
      },

      {
        $group: {
          _id: '$path',

          views: {
            $sum: 1,
          },

          uniqueVisitors: {
            $addToSet: '$visitorId',
          },
        },
      },

      {
        $project: {
          _id: 0,

          path: '$_id',

          views: 1,

          uniqueVisitors: {
            $size: '$uniqueVisitors',
          },
        },
      },

      {
        $sort: {
          views: -1,
        },
      },

      {
        $limit: this.safeLimit(limit),
      },
    ]);
  }

  // =========================================================
  // ENTRY PAGES
  // =========================================================

  async getEntryPages(query: AnalyticsDateQuery = {}, limit = 10) {
    const filter = this.buildDateFilter('startedAt', query);

    return this.sessionModel.aggregate([
      {
        $match: filter,
      },

      {
        $match: {
          landingPage: {
            $nin: ['', null],
          },
        },
      },

      {
        $group: {
          _id: '$landingPage',

          views: {
            $sum: 1,
          },

          uniqueVisitors: {
            $addToSet: '$visitorId',
          },
        },
      },

      {
        $project: {
          _id: 0,

          path: '$_id',

          views: 1,

          uniqueVisitors: {
            $size: '$uniqueVisitors',
          },
        },
      },

      {
        $sort: {
          views: -1,
        },
      },

      {
        $limit: this.safeLimit(limit),
      },
    ]);
  }

  // =========================================================
  // EXIT PAGES
  // =========================================================

  async getExitPages(query: AnalyticsDateQuery = {}, limit = 10) {
    const filter = this.buildDateFilter('endedAt', query);

    return this.sessionModel.aggregate([
      {
        $match: {
          ...filter,

          endedAt: {
            $ne: null,
          },

          exitPage: {
            $nin: ['', null],
          },
        },
      },

      {
        $group: {
          _id: '$exitPage',

          views: {
            $sum: 1,
          },

          uniqueVisitors: {
            $addToSet: '$visitorId',
          },
        },
      },

      {
        $project: {
          _id: 0,

          path: '$_id',

          views: 1,

          uniqueVisitors: {
            $size: '$uniqueVisitors',
          },
        },
      },

      {
        $sort: {
          views: -1,
        },
      },

      {
        $limit: this.safeLimit(limit),
      },
    ]);
  }

  // =========================================================
  // PAGE ENGAGEMENT
  // =========================================================

  async getPageEngagement(query: AnalyticsDateQuery = {}, limit = 50) {
    const filter = this.buildDateFilter('occurredAt', query);

    const result = await this.eventModel.aggregate([
      {
        $match: {
          ...filter,

          eventType: {
            $in: ['page_view', AnalyticsEventType.PAGE_EXIT],
          },
        },
      },

      {
        $group: {
          _id: '$path',

          pageViews: {
            $sum: {
              $cond: [
                {
                  $eq: ['$eventType', 'page_view'],
                },
                1,
                0,
              ],
            },
          },

          uniqueVisitors: {
            $addToSet: '$visitorId',
          },

          durations: {
            $push: {
              $cond: [
                {
                  $and: [
                    {
                      $eq: ['$eventType', 'page_exit'],
                    },
                    {
                      $gt: [
                        {
                          $ifNull: ['$durationMs', 0],
                        },
                        0,
                      ],
                    },
                  ],
                },

                '$durationMs',

                null,
              ],
            },
          },
        },
      },

      {
        $project: {
          _id: 0,

          path: '$_id',

          pageViews: 1,

          uniqueVisitors: {
            $size: '$uniqueVisitors',
          },

          averageTimeMs: {
            $let: {
              vars: {
                validDurations: {
                  $filter: {
                    input: '$durations',

                    as: 'duration',

                    cond: {
                      $ne: ['$$duration', null],
                    },
                  },
                },
              },

              in: {
                $cond: [
                  {
                    $gt: [
                      {
                        $size: '$$validDurations',
                      },
                      0,
                    ],
                  },

                  {
                    $avg: '$$validDurations',
                  },

                  0,
                ],
              },
            },
          },
        },
      },

      {
        $sort: {
          pageViews: -1,
        },
      },

      {
        $limit: this.safeLimit(limit),
      },
    ]);

    return result.map((page) => ({
      ...page,

      averageTimeMs: Math.round(page.averageTimeMs ?? 0),
    }));
  }

  // =========================================================
  // NEW VS RETURNING
  // =========================================================

  async getNewVsReturningVisitors(query: AnalyticsDateQuery = {}) {
    const filter = this.buildDateFilter('startedAt', query);

    const visitorIds = await this.sessionModel.distinct('visitorId', filter);

    if (!visitorIds.length) {
      return {
        newVisitors: 0,
        returningVisitors: 0,
        totalVisitors: 0,
      };
    }

    const startDate = this.parseDate(query.from);

    const visitors = await this.visitorModel
      .find(
        {
          visitorId: {
            $in: visitorIds,
          },
        },
        {
          visitorId: 1,
          firstSeenAt: 1,
        },
      )
      .lean();

    let newVisitors = 0;

    let returningVisitors = 0;

    for (const visitor of visitors) {
      if (
        visitor.firstSeenAt &&
        startDate &&
        visitor.firstSeenAt >= startDate
      ) {
        newVisitors += 1;
      } else {
        returningVisitors += 1;
      }
    }

    return {
      newVisitors,

      returningVisitors,

      totalVisitors: newVisitors + returningVisitors,
    };
  }

  // =========================================================
  // CONVERSIONS
  // =========================================================

  async getConversions(query: AnalyticsDateQuery = {}) {
    const filter = this.buildDateFilter('occurredAt', query);

    const result = await this.eventModel.aggregate([
      {
        $match: filter,
      },

      {
        $group: {
          _id: '$eventType',

          total: {
            $sum: 1,
          },

          visitors: {
            $addToSet: '$visitorId',
          },
        },
      },
    ]);

    const byType = new Map<
      string,
      {
        total: number;
        visitors: number;
      }
    >();

    for (const item of result) {
      byType.set(item._id, {
        total: item.total ?? 0,

        visitors: item.visitors?.length ?? 0,
      });
    }

    const predictionViews = byType.get('prediction_view') ?? {
      total: 0,
      visitors: 0,
    };

    const predictionPurchases = byType.get('prediction_purchase') ?? {
      total: 0,
      visitors: 0,
    };

    const pricingViews = byType.get('pricing_view') ?? {
      total: 0,
      visitors: 0,
    };

    const subscriptionPurchases = byType.get('subscription_purchase') ?? {
      total: 0,
      visitors: 0,
    };

    const paymentSuccess = byType.get('payment_success') ?? {
      total: 0,
      visitors: 0,
    };

    return {
      predictions: {
        views: predictionViews.total,

        uniqueViewers: predictionViews.visitors,

        purchases: predictionPurchases.total,

        uniquePurchasers: predictionPurchases.visitors,

        conversionRate: this.conversionRate(
          predictionPurchases.visitors,
          predictionViews.visitors,
        ),
      },

      subscriptions: {
        pricingViews: pricingViews.total,

        uniquePricingVisitors: pricingViews.visitors,

        purchases: subscriptionPurchases.total,

        uniquePurchasers: subscriptionPurchases.visitors,

        conversionRate: this.conversionRate(
          subscriptionPurchases.visitors,
          pricingViews.visitors,
        ),
      },

      payments: {
        successful: paymentSuccess.total,

        uniqueUsers: paymentSuccess.visitors,
      },
    };
  }

  // =========================================================
  // TRAFFIC SOURCES
  // =========================================================

  async getTrafficSources(query: AnalyticsDateQuery = {}, limit = 20) {
    const filter = this.buildDateFilter('startedAt', query);

    return this.sessionModel.aggregate([
      {
        $match: filter,
      },

      {
        $group: {
          _id: {
            referrer: '$referrer',
            utmSource: '$utmSource',
            utmMedium: '$utmMedium',
            utmCampaign: '$utmCampaign',
          },

          sessions: {
            $sum: 1,
          },

          visitors: {
            $addToSet: '$visitorId',
          },
        },
      },

      {
        $project: {
          _id: 0,

          referrer: '$_id.referrer',

          utmSource: '$_id.utmSource',

          utmMedium: '$_id.utmMedium',

          utmCampaign: '$_id.utmCampaign',

          sessions: 1,

          visitors: {
            $size: '$visitors',
          },
        },
      },

      {
        $sort: {
          sessions: -1,
        },
      },

      {
        $limit: this.safeLimit(limit),
      },
    ]);
  }

  // =========================================================
  // COUNTRIES
  // =========================================================

  async getCountries(query: AnalyticsDateQuery = {}, limit = 20) {
    const filter = this.buildDateFilter('startedAt', query);

    return this.sessionModel.aggregate([
      {
        $match: filter,
      },

      {
        $group: {
          _id: {
            country: '$country',
            countryCode: '$countryCode',
          },

          sessions: {
            $sum: 1,
          },

          visitors: {
            $addToSet: '$visitorId',
          },
        },
      },

      {
        $project: {
          _id: 0,

          country: '$_id.country',

          countryCode: '$_id.countryCode',

          sessions: 1,

          visitors: {
            $size: '$visitors',
          },
        },
      },

      {
        $sort: {
          visitors: -1,
          sessions: -1,
        },
      },

      {
        $limit: this.safeLimit(limit),
      },
    ]);
  }

  // =========================================================
  // CITIES
  // =========================================================

  async getCities(query: AnalyticsDateQuery = {}, limit = 20) {
    const filter = this.buildDateFilter('startedAt', query);

    return this.sessionModel.aggregate([
      {
        $match: filter,
      },

      {
        $group: {
          _id: {
            city: '$city',
            region: '$region',
            country: '$country',
            countryCode: '$countryCode',
          },

          sessions: {
            $sum: 1,
          },

          visitors: {
            $addToSet: '$visitorId',
          },
        },
      },

      {
        $project: {
          _id: 0,

          city: '$_id.city',

          region: '$_id.region',

          country: '$_id.country',

          countryCode: '$_id.countryCode',

          sessions: 1,

          visitors: {
            $size: '$visitors',
          },
        },
      },

      {
        $sort: {
          visitors: -1,
          sessions: -1,
        },
      },

      {
        $limit: this.safeLimit(limit),
      },
    ]);
  }

  // =========================================================
  // DEVICES
  // =========================================================

  async getDevices(query: AnalyticsDateQuery = {}) {
    return this.groupTechnology('deviceType', query);
  }

  // =========================================================
  // BROWSERS
  // =========================================================

  async getBrowsers(query: AnalyticsDateQuery = {}) {
    return this.groupTechnology('browser', query);
  }

  // =========================================================
  // OPERATING SYSTEMS
  // =========================================================

  async getOperatingSystems(query: AnalyticsDateQuery = {}) {
    return this.groupTechnology('operatingSystem', query);
  }

  // =========================================================
  // EVENT TYPES
  // =========================================================

  async getEventTypes(query: AnalyticsDateQuery = {}, limit = 20) {
    const filter = this.buildDateFilter('occurredAt', query);

    return this.eventModel.aggregate([
      {
        $match: filter,
      },

      {
        $group: {
          _id: '$eventType',

          count: {
            $sum: 1,
          },

          visitors: {
            $addToSet: '$visitorId',
          },
        },
      },

      {
        $project: {
          _id: 0,

          eventType: '$_id',

          count: 1,

          visitors: {
            $size: '$visitors',
          },
        },
      },

      {
        $sort: {
          count: -1,
        },
      },

      {
        $limit: this.safeLimit(limit),
      },
    ]);
  }

  // =========================================================
  // EVENT NAMES
  // =========================================================

  async getEventNames(query: AnalyticsDateQuery = {}, limit = 20) {
    const filter = this.buildDateFilter('occurredAt', query);

    return this.eventModel.aggregate([
      {
        $match: filter,
      },

      {
        $group: {
          _id: '$eventName',

          count: {
            $sum: 1,
          },

          visitors: {
            $addToSet: '$visitorId',
          },
        },
      },

      {
        $project: {
          _id: 0,

          eventName: '$_id',

          count: 1,

          visitors: {
            $size: '$visitors',
          },
        },
      },

      {
        $sort: {
          count: -1,
        },
      },

      {
        $limit: this.safeLimit(limit),
      },
    ]);
  }

  // =========================================================
  // SEARCHES
  // =========================================================

  async getSearches(query: AnalyticsDateQuery = {}, limit = 20) {
    const filter = this.buildDateFilter('occurredAt', query);

    return this.eventModel.aggregate([
      {
        $match: {
          ...filter,

          eventType: AnalyticsEventType.SEARCH,
        },
      },

      {
        $project: {
          searchTerm: {
            $ifNull: ['$properties.searchTerm', '$properties.term'],
          },

          visitorId: 1,
        },
      },

      {
        $match: {
          searchTerm: {
            $nin: ['', null],
          },
        },
      },

      {
        $group: {
          _id: '$searchTerm',

          count: {
            $sum: 1,
          },

          visitors: {
            $addToSet: '$visitorId',
          },
        },
      },

      {
        $project: {
          _id: 0,

          searchTerm: '$_id',

          count: 1,

          visitors: {
            $size: '$visitors',
          },
        },
      },

      {
        $sort: {
          count: -1,
        },
      },

      {
        $limit: this.safeLimit(limit),
      },
    ]);
  }

  // =========================================================
  // FILTERS
  // =========================================================

  async getFilters(query: AnalyticsDateQuery = {}, limit = 20) {
    const filter = this.buildDateFilter('occurredAt', query);

    return this.eventModel.aggregate([
      {
        $match: {
          ...filter,

          eventType: AnalyticsEventType.FILTER,
        },
      },

      {
        $project: {
          filter: {
            $ifNull: ['$properties.filter', 'unknown'],
          },

          value: {
            $ifNull: ['$properties.value', ''],
          },

          visitorId: 1,
        },
      },

      {
        $group: {
          _id: {
            filter: '$filter',
            value: '$value',
          },

          count: {
            $sum: 1,
          },

          visitors: {
            $addToSet: '$visitorId',
          },
        },
      },

      {
        $project: {
          _id: 0,

          filter: '$_id.filter',

          value: '$_id.value',

          count: 1,

          visitors: {
            $size: '$visitors',
          },
        },
      },

      {
        $sort: {
          count: -1,
        },
      },

      {
        $limit: this.safeLimit(limit),
      },
    ]);
  }

  // =========================================================
  // HOURLY TREND
  // =========================================================

  async getHourlyTrend(query: AnalyticsDateQuery = {}) {
    const filter = this.buildDateFilter('occurredAt', query);

    return this.eventModel.aggregate([
      {
        $match: filter,
      },

      {
        $group: {
          _id: {
            hour: {
              $hour: '$occurredAt',
            },
          },

          events: {
            $sum: 1,
          },

          pageViews: {
            $sum: {
              $cond: [
                {
                  $eq: ['$eventType', 'page_view'],
                },
                1,
                0,
              ],
            },
          },

          visitors: {
            $addToSet: '$visitorId',
          },

          sessions: {
            $addToSet: '$sessionId',
          },
        },
      },

      {
        $project: {
          _id: 0,

          hour: '$_id.hour',

          events: 1,

          pageViews: 1,

          visitors: {
            $size: '$visitors',
          },

          sessions: {
            $size: '$sessions',
          },
        },
      },

      {
        $sort: {
          hour: 1,
        },
      },
    ]);
  }

  // =========================================================
  // DAILY TREND
  // =========================================================

  async getDailyTrend(query: AnalyticsDateQuery = {}) {
    const filter = this.buildDateFilter('occurredAt', query);

    return this.eventModel.aggregate([
      {
        $match: filter,
      },

      {
        $group: {
          _id: {
            year: {
              $year: '$occurredAt',
            },

            month: {
              $month: '$occurredAt',
            },

            day: {
              $dayOfMonth: '$occurredAt',
            },
          },

          events: {
            $sum: 1,
          },

          pageViews: {
            $sum: {
              $cond: [
                {
                  $eq: ['$eventType', 'page_view'],
                },
                1,
                0,
              ],
            },
          },

          visitors: {
            $addToSet: '$visitorId',
          },

          sessions: {
            $addToSet: '$sessionId',
          },
        },
      },

      {
        $project: {
          _id: 0,

          date: {
            $dateToString: {
              format: '%Y-%m-%d',

              date: {
                $dateFromParts: {
                  year: '$_id.year',

                  month: '$_id.month',

                  day: '$_id.day',
                },
              },
            },
          },

          events: 1,

          pageViews: 1,

          visitors: {
            $size: '$visitors',
          },

          sessions: {
            $size: '$sessions',
          },
        },
      },

      {
        $sort: {
          date: 1,
        },
      },
    ]);
  }

  // =========================================================
  // MONTHLY TREND
  // =========================================================

  async getMonthlyTrend(query: AnalyticsDateQuery = {}) {
    const filter = this.buildDateFilter('occurredAt', query);

    return this.eventModel.aggregate([
      {
        $match: filter,
      },

      {
        $group: {
          _id: {
            year: {
              $year: '$occurredAt',
            },

            month: {
              $month: '$occurredAt',
            },
          },

          events: {
            $sum: 1,
          },

          pageViews: {
            $sum: {
              $cond: [
                {
                  $eq: ['$eventType', 'page_view'],
                },
                1,
                0,
              ],
            },
          },

          visitors: {
            $addToSet: '$visitorId',
          },

          sessions: {
            $addToSet: '$sessionId',
          },
        },
      },

      {
        $project: {
          _id: 0,

          month: {
            $concat: [
              {
                $toString: '$_id.year',
              },

              '-',

              {
                $cond: [
                  {
                    $lt: ['$_id.month', 10],
                  },

                  {
                    $concat: [
                      '0',
                      {
                        $toString: '$_id.month',
                      },
                    ],
                  },

                  {
                    $toString: '$_id.month',
                  },
                ],
              },
            ],
          },

          events: 1,

          pageViews: 1,

          visitors: {
            $size: '$visitors',
          },

          sessions: {
            $size: '$sessions',
          },
        },
      },

      {
        $sort: {
          month: 1,
        },
      },
    ]);
  }

  // =========================================================
  // REALTIME
  // =========================================================

  async getRealtime() {
    const activeSince = new Date(Date.now() - 90 * 1000);

    const sessions = await this.sessionModel
      .find({
        isActive: true,

        lastActiveAt: {
          $gte: activeSince,
        },
      })
      .sort({
        lastActiveAt: -1,
      })
      .limit(200)
      .lean();

    const registered = sessions.filter(
      (session) => session.visitorType === 'registered',
    );

    const anonymous = sessions.filter(
      (session) => session.visitorType === 'anonymous',
    );

    const pages = new Map<string, number>();

    const countries = new Map<string, number>();

    const devices = new Map<string, number>();

    for (const session of sessions) {
      if (session.currentPage) {
        pages.set(
          session.currentPage,
          (pages.get(session.currentPage) ?? 0) + 1,
        );
      }

      const country = session.country || session.countryCode || 'Unknown';

      countries.set(country, (countries.get(country) ?? 0) + 1);

      const device = session.deviceType || 'Unknown';

      devices.set(device, (devices.get(device) ?? 0) + 1);
    }

    return {
      timestamp: new Date().toISOString(),

      totalActive: sessions.length,

      registered: registered.length,

      anonymous: anonymous.length,

      pages: this.mapCounts(pages, 'path'),

      countries: this.mapCounts(countries, 'country'),

      devices: this.mapCounts(devices, 'deviceType'),

      sessions: sessions.map((session) => ({
        sessionId: session.sessionId,

        visitorId: session.visitorId,

        userId: session.userId ?? null,

        visitorType: session.visitorType,

        currentPage: session.currentPage,

        startedAt: session.startedAt,

        lastActiveAt: session.lastActiveAt,

        durationMs: session.durationMs,

        activeTimeMs: session.activeTimeMs,

        pageViews: session.pageViews,

        deviceType: session.deviceType,

        browser: session.browser,

        operatingSystem: session.operatingSystem,

        country: session.country,

        countryCode: session.countryCode,

        region: session.region,

        city: session.city,
      })),
    };
  }

  // =========================================================
  // USER ANALYTICS
  // =========================================================

  async getUserAnalytics(userId: string) {
    const userSessions = await this.sessionModel
      .find({
        userId,
      })
      .sort({
        startedAt: -1,
      })
      .limit(100)
      .lean();

    const userEvents = await this.eventModel
      .find({
        userId,
      })
      .sort({
        occurredAt: -1,
      })
      .limit(200)
      .lean();

    const pageViews = await this.eventModel.aggregate([
      {
        $match: {
          userId,
          eventType: 'page_view',
        },
      },

      {
        $group: {
          _id: '$path',

          views: {
            $sum: 1,
          },
        },
      },

      {
        $sort: {
          views: -1,
        },
      },

      {
        $limit: 50,
      },

      {
        $project: {
          _id: 0,

          path: '$_id',

          views: 1,
        },
      },
    ]);

    const totalTimeMs = userSessions.reduce(
      (sum, session) => sum + (session.durationMs ?? 0),
      0,
    );

    const totalActiveTimeMs = userSessions.reduce(
      (sum, session) => sum + (session.activeTimeMs ?? 0),
      0,
    );

    const totalPageViews = userSessions.reduce(
      (sum, session) => sum + (session.pageViews ?? 0),
      0,
    );

    const totalEvents = userSessions.reduce(
      (sum, session) => sum + (session.eventCount ?? 0),
      0,
    );

    return {
      userId,

      summary: {
        totalSessions: userSessions.length,

        totalTimeMs,

        totalActiveTimeMs,

        totalPageViews,

        totalEvents,

        averageSessionDurationMs: userSessions.length
          ? Math.round(totalTimeMs / userSessions.length)
          : 0,
      },

      sessions: userSessions,

      pages: pageViews,

      recentEvents: userEvents,
    };
  }

  // =========================================================
  // VISITOR ANALYTICS
  // =========================================================

  async getVisitorAnalytics(visitorId: string) {
    const visitor = await this.visitorModel
      .findOne({
        visitorId,
      })
      .lean();

    if (!visitor) {
      return null;
    }

    const sessions = await this.sessionModel
      .find({
        visitorId,
      })
      .sort({
        startedAt: -1,
      })
      .limit(100)
      .lean();

    const events = await this.eventModel
      .find({
        visitorId,
      })
      .sort({
        occurredAt: -1,
      })
      .limit(200)
      .lean();

    const pages = await this.eventModel.aggregate([
      {
        $match: {
          visitorId,

          eventType: 'page_view',
        },
      },

      {
        $group: {
          _id: '$path',

          views: {
            $sum: 1,
          },
        },
      },

      {
        $sort: {
          views: -1,
        },
      },

      {
        $limit: 50,
      },

      {
        $project: {
          _id: 0,

          path: '$_id',

          views: 1,
        },
      },
    ]);

    const totalTimeMs = sessions.reduce(
      (sum, session) => sum + (session.durationMs ?? 0),
      0,
    );

    const totalActiveTimeMs = sessions.reduce(
      (sum, session) => sum + (session.activeTimeMs ?? 0),
      0,
    );

    const totalPageViews = sessions.reduce(
      (sum, session) => sum + (session.pageViews ?? 0),
      0,
    );

    const totalEvents = sessions.reduce(
      (sum, session) => sum + (session.eventCount ?? 0),
      0,
    );

    return {
      visitor,

      summary: {
        totalSessions: sessions.length,

        totalTimeMs,

        totalActiveTimeMs,

        totalPageViews,

        totalEvents,

        averageSessionDurationMs: sessions.length
          ? Math.round(totalTimeMs / sessions.length)
          : 0,
      },

      sessions,

      pages,

      recentEvents: events,
    };
  }

  // =========================================================
  // TECHNOLOGY GROUPING
  // =========================================================

  private async groupTechnology(
    field: 'deviceType' | 'browser' | 'operatingSystem',
    query: AnalyticsDateQuery,
  ) {
    const filter = this.buildDateFilter('startedAt', query);

    return this.sessionModel.aggregate([
      {
        $match: filter,
      },

      {
        $group: {
          _id: `$${field}`,

          sessions: {
            $sum: 1,
          },

          visitors: {
            $addToSet: '$visitorId',
          },
        },
      },

      {
        $project: {
          _id: 0,

          [field]: '$_id',

          sessions: 1,

          visitors: {
            $size: '$visitors',
          },
        },
      },

      {
        $sort: {
          visitors: -1,
          sessions: -1,
        },
      },
    ]);
  }

  // =========================================================
  // DATE FILTER
  // =========================================================

  private buildDateFilter(
    field: string,
    query: AnalyticsDateQuery = {},
  ): Record<string, unknown> {
    const filter: Record<string, unknown> = {};

    const from = this.parseDate(query.from);

    const to = this.parseDate(query.to);

    if (from && to) {
      filter[field] = {
        $gte: from,
        $lte: to,
      };

      return filter;
    }

    if (from) {
      filter[field] = {
        $gte: from,
      };

      return filter;
    }

    if (to) {
      filter[field] = {
        $lte: to,
      };

      return filter;
    }

    return filter;
  }

  private parseDate(value?: string): Date | null {
    if (!value) {
      return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date;
  }

  // =========================================================
  // LIMIT
  // =========================================================

  private safeLimit(value: number) {
    if (!Number.isFinite(value)) {
      return 20;
    }

    return Math.min(Math.max(Math.floor(value), 1), 100);
  }

  // =========================================================
  // CONVERSION RATE
  // =========================================================

  private conversionRate(numerator: number, denominator: number) {
    if (denominator <= 0) {
      return 0;
    }

    return Number(((numerator / denominator) * 100).toFixed(2));
  }

  // =========================================================
  // MAP COUNTS
  // =========================================================

  private mapCounts(map: Map<string, number>, key: string) {
    return Array.from(map.entries())
      .map(([value, count]) => ({
        [key]: value,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }
}
