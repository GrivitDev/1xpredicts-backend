// src/predictions-engine/utils/confidence.util.ts

export class ConfidenceUtil {
  static sampleReliability(sampleSize: number): number {
    const safeSampleSize = Math.max(
      Number.isFinite(sampleSize) ? Math.floor(sampleSize) : 0,
      0,
    );

    if (safeSampleSize <= 0) {
      return 0;
    }

    /*
     * Continuous sample reliability.
     *
     * More observations increase reliability, but the function
     * asymptotically approaches 1 rather than treating sample volume
     * as absolute certainty.
     */
    return this.clamp(1 - Math.exp(-safeSampleSize / 20), 0, 1);
  }

  private static clamp(
    value: number,
    minimum: number,
    maximum: number,
  ): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
