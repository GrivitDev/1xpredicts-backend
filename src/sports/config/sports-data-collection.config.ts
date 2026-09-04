import { CollectionFrequency } from '../enums/collection-frequency.enum';

export const SPORTS_DATA_COLLECTION_CONFIG = {
  // ==========================================================
  // FOOTBALL-DATA
  // ==========================================================

  FOOTBALL_DATA: {
    enabled: true,

    competitions: {
      frequency: CollectionFrequency.DAILY,

      seasonRefresh: CollectionFrequency.WEEKLY,

      standings: CollectionFrequency.DAILY,

      fixtures: CollectionFrequency.DAILY,

      results: CollectionFrequency.DAILY,
    },

    rateLimit: {
      minIntervalSeconds: 60,
    },

    schedule: {
      hour: 23,
      minute: 0,
    },
  },

  // ==========================================================
  // THE SPORTS DB
  // ==========================================================

  THESPORTSDB: {
    enabled: true,

    leagueData: CollectionFrequency.WEEKLY,

    seasonData: CollectionFrequency.WEEKLY,

    events: CollectionFrequency.DAILY,

    completedMatchData: CollectionFrequency.TARGETED,

    teamData: CollectionFrequency.WEEKLY,

    playerData: CollectionFrequency.WEEKLY,

    venueData: CollectionFrequency.WEEKLY,

    rateLimit: {
      minIntervalSeconds: 60,
    },

    schedule: {
      hour: 23,
      minute: 30,
    },
  },

  // ==========================================================
  // API-FOOTBALL
  // ==========================================================

  API_FOOTBALL: {
    enabled: true,

    dailyRequestLimit: 95,

    rateLimit: {
      minIntervalSeconds: 60,
    },

    fixtures: CollectionFrequency.DAILY,

    standings: CollectionFrequency.TARGETED,

    teamStatistics: CollectionFrequency.TARGETED,

    injuries: CollectionFrequency.TARGETED,

    predictions: CollectionFrequency.TARGETED,

    queue: {
      enabled: true,

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

    dailyRequestLimit: 15,

    rateLimit: {
      minIntervalSeconds: 60,
    },

    sports: CollectionFrequency.WEEKLY,

    events: CollectionFrequency.DAILY,

    scores: CollectionFrequency.TARGETED,

    odds: CollectionFrequency.TARGETED,
  },

  // ==========================================================
  // YOUTUBE
  // ==========================================================

  YOUTUBE: {
    enabled: true,

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
