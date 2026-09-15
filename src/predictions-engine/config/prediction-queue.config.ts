export const PREDICTION_QUEUE_CONFIG = {
  horizonDays: 3,

  priorityWeights: {
    ELITE: 1,
    HIGH: 2,
    REGIONAL: 3,
    SELECTIVE: 4,
  } as const,

  worker: {
    pollIntervalMs: 1000,
    batchSize: 1,
    maxAttempts: 3,
  },
} as const;
