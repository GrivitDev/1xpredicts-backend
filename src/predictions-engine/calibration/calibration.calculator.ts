// src/predictions-engine/calibration/calibration.calculator.ts

import { Injectable } from '@nestjs/common';

@Injectable()
export class CalibrationCalculator {
  calculate(input: {
    sampleSize: number;
    averageProbability: number;
    actualSuccessRate: number;
    evidenceSupport?: number;
  }): {
    adjustment: number;
    calibrationError: number;
    reliabilityScore: number;
  } {
    const sampleSize = Math.max(Math.floor(Number(input.sampleSize) || 0), 0);

    const averageProbability = this.clamp(input.averageProbability, 0, 1);

    const actualSuccessRate = this.clamp(input.actualSuccessRate, 0, 1);

    const evidenceSupport = this.clamp(input.evidenceSupport ?? 0, 0, 1);

    const calibrationError = Math.abs(averageProbability - actualSuccessRate);

    if (sampleSize <= 0) {
      return {
        adjustment: 0,
        calibrationError: 0,
        reliabilityScore: 0,
      };
    }

    const sampleReliability = 1 - Math.exp(-sampleSize / 40);

    const accuracyReliability = this.clamp(1 - calibrationError * 2, 0, 1);

    /*
     * Reliability also reflects whether the predictions being
     * calibrated were built from sufficiently useful evidence.
     */
    const evidenceReliability = evidenceSupport > 0 ? evidenceSupport : 0.5;

    /*
     * Adjustment is deliberately conservative.
     *
     * It is only activated by CalibrationEngine after its
     * systematic-failure assessment passes.
     */
    const rawAdjustment = actualSuccessRate - averageProbability;

    const evidenceWeight = 0.5 + evidenceReliability * 0.5;

    const adjustment =
      sampleSize >= 20
        ? this.clamp(rawAdjustment * 0.35 * evidenceWeight, -0.1, 0.1)
        : 0;

    const reliabilityScore = this.clamp(
      (sampleReliability * 0.4 +
        accuracyReliability * 0.4 +
        evidenceReliability * 0.2) *
        100,
      0,
      100,
    );

    return {
      adjustment,
      calibrationError,
      reliabilityScore,
    };
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
