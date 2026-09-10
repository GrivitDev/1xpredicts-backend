export function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.min(maximum, Math.max(minimum, value));
}

export function safeAverage(values: number[]): number {
  const validValues = values.filter(
    (value) => Number.isFinite(value) && value >= 0,
  );

  if (validValues.length === 0) {
    return 0;
  }

  return (
    validValues.reduce((sum, value) => sum + value, 0) / validValues.length
  );
}

export function normalizeDistribution(
  distribution: Record<number, number>,
): Record<number, number> {
  const total = Object.values(distribution).reduce(
    (sum, probability) => sum + probability,
    0,
  );

  if (total <= 0) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(distribution).map(([key, probability]) => [
      Number(key),
      probability / total,
    ]),
  );
}

export function round(value: number, decimals = 4): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const multiplier = 10 ** decimals;

  return Math.round(value * multiplier) / multiplier;
}
