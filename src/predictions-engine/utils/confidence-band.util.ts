import { ConfidenceBand } from '../interfaces/confidence-band.interface';

export class ConfidenceBandUtil {
  static getBand(confidence: number): ConfidenceBand {
    const value = this.clamp(confidence, 0, 98);

    if (value < 60) {
      return {
        min: 0,
        max: 59.99,
        label: 'LOW',
        calibrationAttention: 'HIGH',
      };
    }

    if (value < 80) {
      return {
        min: 60,
        max: 79.99,
        label: 'MODERATE',
        calibrationAttention: 'HIGH',
      };
    }

    if (value < 90) {
      return {
        min: 80,
        max: 89.99,
        label: 'MEANINGFUL',
        calibrationAttention: 'MEDIUM',
      };
    }

    if (value < 95) {
      return {
        min: 90,
        max: 94.99,
        label: 'STRONG',
        calibrationAttention: 'HIGH',
      };
    }

    return {
      min: 95,
      max: 98,
      label: 'CRITICAL',
      calibrationAttention: 'VERY_HIGH',
    };
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
