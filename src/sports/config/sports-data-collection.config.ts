export const SPORTS_DATA_COLLECTION_CONFIG = {
  // ==========================================================
  // FOOTBALL-DATA
  // ==========================================================

  FOOTBALL_DATA: {
    enabled: true,

    rateLimit: {
      minIntervalSeconds: 60,
    },

    live: {
      intervalMinutes: 5,
    },
  },

  // ==========================================================
  // API-FOOTBALL
  // ==========================================================

  API_FOOTBALL: {
    enabled: true,

    /**
     * Application-level maximum number of API-Football
     * requests allowed in one UTC day.
     *
     * Retries consume the same quota as normal requests.
     */
    dailyRequestLimit: 95,

    rateLimit: {
      /**
       * Never allow two API-Football requests closer
       * than 60 seconds apart.
       *
       * This also applies to retries.
       */
      minIntervalSeconds: 60,
    },

    /**
     * League discovery / season maintenance.
     */
    discovery: {
      intervalDays: 30,
    },

    /**
     * Startup flow:
     *
     * discover competitions first,
     * then wait before building the initial
     * fixture collection queue.
     */
    startup: {
      initialFixtureDelayMinutes: 10,
    },

    /**
     * Daily API-Football collection window.
     *
     * Africa/Lagos:
     * 01:00 - 07:00
     */
    collectionWindow: {
      startHour: 1,
      endHour: 7,
    },

    /**
     * One collection pass per day.
     *
     * The provider limiter, not an artificial five-minute
     * delay, controls the actual request spacing.
     */
    collectionPasses: 1,

    /**
     * Queue scheduling interval.
     *
     * One minute matches the global provider rule of
     * one request every 60 seconds.
     */
    slotIntervalMinutes: 1,

    queue: {
      enabled: true,

      /**
       * Maximum attempts for one queued request,
       * including the initial attempt.
       */
      maxAttempts: 3,

      staleProcessingMinutes: 30,

      retryDelayMinutes: 15,
    },
  },

  // ==========================================================
  // THE ODDS API
  // ==========================================================

  ODDS_API: {
    enabled: true,

    /**
     * Application-level monthly request budget.
     */
    monthlyRequestLimit: 450,

    rateLimit: {
      minIntervalSeconds: 60,
    },

    /**
     * Refresh the provider sport catalogue periodically.
     */
    sportsRefreshDays: 30,

    oddsCollection: {
      /**
       * Odds are collected from sport keys selected from
       * matches already stored in MongoDB.
       */
      daily: true,

      /**
       * Scheduler/queue timing is one minute because
       * the provider limiter enforces the real 60-second
       * outbound request rule.
       */
      slotIntervalMinutes: 1,
    },
  },

  // ==========================================================
  // YOUTUBE
  // ==========================================================

  YOUTUBE: {
    enabled: true,

    /**
     * Internal daily request/search safety budget.
     *
     * The collector deliberately minimizes search calls.
     */
    dailyRequestLimit: 30,

    rateLimit: {
      minIntervalSeconds: 60,
    },

    queue: {
      enabled: true,

      intervalMinutes: 20,

      maxAttempts: 3,

      retryDelayMinutes: 20,
    },
  },
} as const;

export type SportsDataCollectionConfig = typeof SPORTS_DATA_COLLECTION_CONFIG;
