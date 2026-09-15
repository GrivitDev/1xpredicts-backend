export class PredictionMathUtil {
  static clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) {
      return min;
    }

    return Math.min(max, Math.max(min, value));
  }

  static round(value: number, decimals = 4): number {
    const factor = 10 ** decimals;

    return Math.round(value * factor) / factor;
  }

  static weightedAverage(
    values: Array<{ value: number; weight: number }>,
  ): number {
    const valid = values.filter(
      ({ value, weight }) =>
        Number.isFinite(value) && Number.isFinite(weight) && weight > 0,
    );

    if (!valid.length) {
      return 0;
    }

    const totalWeight = valid.reduce((sum, item) => sum + item.weight, 0);

    if (totalWeight <= 0) {
      return 0;
    }

    const total = valid.reduce(
      (sum, item) => sum + item.value * item.weight,
      0,
    );

    return total / totalWeight;
  }

  static mean(values: number[]): number {
    const valid = values.filter((value) => Number.isFinite(value));

    if (!valid.length) {
      return 0;
    }

    return valid.reduce((sum, value) => sum + value, 0) / valid.length;
  }

  static poissonProbability(goals: number, lambda: number): number {
    if (
      !Number.isInteger(goals) ||
      goals < 0 ||
      !Number.isFinite(lambda) ||
      lambda < 0
    ) {
      return 0;
    }

    let factorial = 1;

    for (let i = 2; i <= goals; i += 1) {
      factorial *= i;
    }

    return (
      (Math.exp(-lambda) * Math.pow(lambda, goals)) /
      Math.max(factorial, Number.EPSILON)
    );
  }

  static poissonDistribution(
    lambda: number,
    maxGoals = 10,
  ): Record<string, number> {
    const result: Record<string, number> = {};

    if (!Number.isFinite(lambda) || lambda < 0) {
      return result;
    }

    let total = 0;

    for (let goals = 0; goals <= maxGoals; goals += 1) {
      const probability = this.poissonProbability(goals, lambda);

      result[String(goals)] = probability;
      total += probability;
    }

    if (total <= 0) {
      return result;
    }

    for (const key of Object.keys(result)) {
      result[key] = result[key] / total;
    }

    return result;
  }

  static probabilityFromRate(rate: number): number {
    return this.clamp(rate, 0, 1);
  }

  static percentage(value: number): number {
    return this.clamp(value, 0, 100);
  }

  static safeRatio(numerator: number, denominator: number): number {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
      return 0;
    }

    if (denominator === 0) {
      return 0;
    }

    return numerator / denominator;
  }
}
