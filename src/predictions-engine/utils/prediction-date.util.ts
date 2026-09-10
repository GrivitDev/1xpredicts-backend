const PREDICTION_START_HOUR = 6;
const PREDICTION_END_HOUR = 24;

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export function isPredictionProcessingWindow(date = new Date()): boolean {
  const hour = date.getHours();

  return hour >= PREDICTION_START_HOUR && hour < PREDICTION_END_HOUR;
}

export function getPredictionQueueWindow(now = new Date()): {
  from: Date;
  to: Date;
} {
  const from = new Date(now);

  from.setHours(PREDICTION_START_HOUR, 0, 0, 0);

  const to = new Date(from);

  to.setDate(to.getDate() + 3);

  to.setHours(PREDICTION_START_HOUR, 0, 0, 0);

  return {
    from,
    to,
  };
}

export function isWithinPredictionHorizon(
  kickoff: Date,
  now = new Date(),
): boolean {
  const difference = kickoff.getTime() - now.getTime();

  return difference >= 0 && difference <= THREE_DAYS_MS;
}

/**
 * Prediction refresh interval.
 *
 * Predictions are regenerated once the existing prediction
 * is at least 24 hours old.
 */
export function getPredictionRefreshWindowMs(): number {
  return 24 * 60 * 60 * 1000;
}
