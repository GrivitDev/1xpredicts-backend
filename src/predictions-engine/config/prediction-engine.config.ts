export const PREDICTION_ENGINE_CONFIG = {
  modelVersion: 'raw-ensemble-v2',

  queue: {
    horizonDays: 3,
    maxAttempts: 3,
    workerPollIntervalMs: 5000,
    workerLockMinutes: 15,
    retryDelayMinutes: 5,
  },

  probability: {
    minimum: 0,
    maximum: 1,
  },

  confidence: {
    minimum: 0,
    maximum: 98,
  },

  score: {
    minimum: 0,
    maximum: 1,
  },

  calibration: {
    meaningfulConfidenceThreshold: 80,
    minimumSamplesForAdjustment: 20,
    severeFailureThreshold: 90,
    criticalFailureThreshold: 95,
  },

  predictionData: {
    historicalFixtureLimit: 30,
    recentFixtureLimit: 5,
  },

  runtime: {
    includeRejectedMarkets: false,
    includeHighRisk: true,
    includeMediumRisk: true,
    includeLowRisk: true,
  },
} as const;
