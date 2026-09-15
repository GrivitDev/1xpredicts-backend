export class ConfidenceUtil {
  static clamp(value: number, minimum = 0, maximum = 98): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }

  static normalize(value: number): number {
    return this.clamp(value) / 98;
  }

  static adjust(confidence: number, adjustment: number): number {
    return this.clamp(confidence + adjustment);
  }

  static isMeaningful(confidence: number): boolean {
    return this.clamp(confidence) >= 80;
  }

  static isStrong(confidence: number): boolean {
    return this.clamp(confidence) >= 90;
  }

  static isCritical(confidence: number): boolean {
    return this.clamp(confidence) >= 95;
  }

  static probabilityStrength(probability: number): number {
    const p = this.clampProbability(probability);

    /*
     * Probability contributes to confidence, but it is never
     * allowed to dominate confidence by itself.
     *
     * The intervals are intentionally progressive rather than
     * making 95% probability automatically equivalent to 95%
     * confidence.
     */
    if (p < 0.55) {
      return 0;
    }

    if (p < 0.6) {
      return 0.25;
    }

    if (p < 0.65) {
      return 0.35;
    }

    if (p < 0.7) {
      return 0.45;
    }

    if (p < 0.75) {
      return 0.55;
    }

    if (p < 0.8) {
      return 0.65;
    }

    if (p < 0.85) {
      return 0.74;
    }

    if (p < 0.9) {
      return 0.82;
    }

    if (p < 0.95) {
      return 0.89;
    }

    return 0.94;
  }

  static sampleReliability(sampleSize: number): number {
    const sample = Math.max(Math.floor(Number(sampleSize) || 0), 0);

    return this.clampUnit(1 - Math.exp(-sample / 25));
  }

  static reliabilityToPercent(reliability: number): number {
    return this.clampUnit(reliability) * 100;
  }

  private static clampProbability(probability: number): number {
    if (!Number.isFinite(probability)) {
      return 0;
    }

    return Math.min(Math.max(probability, 0), 1);
  }

  private static clampUnit(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.min(Math.max(value, 0), 1);
  }
}
