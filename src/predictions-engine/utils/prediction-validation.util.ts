export function isValidPercentage(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

export function isValidProbability(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

export function assertMatchProbabilityTotal(
  home: number,
  draw: number,
  away: number,
  tolerance = 0.01,
): boolean {
  if (
    !isValidProbability(home) ||
    !isValidProbability(draw) ||
    !isValidProbability(away)
  ) {
    return false;
  }

  return Math.abs(home + draw + away - 1) <= tolerance;
}

export function assertPercentageTotal(
  values: number[],
  tolerance = 0.1,
): boolean {
  if (values.length === 0) {
    return false;
  }

  if (!values.every(isValidPercentage)) {
    return false;
  }

  const total = values.reduce((sum, value) => sum + value, 0);

  return Math.abs(total - 100) <= tolerance;
}
