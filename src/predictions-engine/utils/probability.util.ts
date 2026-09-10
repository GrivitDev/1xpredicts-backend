export function clampProbability(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

export function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, value));
}

export function probabilityToPercentage(value: number): number {
  return Number((clampProbability(value) * 100).toFixed(2));
}

export function percentageToProbability(value: number): number {
  return clampPercentage(value) / 100;
}

export function normalizeProbabilities(
  probabilities: Record<string, number>,
): Record<string, number> {
  const entries = Object.entries(probabilities);

  if (entries.length === 0) {
    return {};
  }

  const total = entries.reduce(
    (sum, [, probability]) => sum + clampProbability(probability),
    0,
  );

  if (total <= 0) {
    return Object.fromEntries(
      entries.map(([key]) => [key, 1 / entries.length]),
    );
  }

  return Object.fromEntries(
    entries.map(([key, probability]) => [
      key,
      clampProbability(probability) / total,
    ]),
  );
}

export function weightedAverage(
  values: Array<{
    value: number;
    weight: number;
  }>,
): number {
  const validValues = values.filter(
    (item) =>
      Number.isFinite(item.value) &&
      Number.isFinite(item.weight) &&
      item.weight > 0,
  );

  if (validValues.length === 0) {
    return 0;
  }

  const weightedTotal = validValues.reduce(
    (sum, item) => sum + item.value * item.weight,
    0,
  );

  const totalWeight = validValues.reduce((sum, item) => sum + item.weight, 0);

  if (totalWeight <= 0) {
    return 0;
  }

  return weightedTotal / totalWeight;
}

export function roundPercentage(value: number): number {
  return Number(clampPercentage(value).toFixed(2));
}

export function roundProbability(value: number): number {
  return Number(clampProbability(value).toFixed(6));
}
