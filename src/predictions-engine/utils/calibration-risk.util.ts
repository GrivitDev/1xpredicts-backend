// src/predictions-engine/utils/calibration-risk.util.ts

import { ConfidenceUtil } from './confidence.util';

export class CalibrationRiskUtil {
  static calculate(input: {
    confidence: number;
    reliability: number;
    sampleSize: number;
    calibrationError: number;
  }): number {
    const confidence = this.clamp(input.confidence, 0, 98);

    const reliability = this.clamp(input.reliability, 0, 1);

    const sampleSize = Math.max(
      Number.isFinite(input.sampleSize) ? Math.floor(input.sampleSize) : 0,
      0,
    );

    /*
     * ----------------------------------------------------------
     * CALIBRATION HISTORY
     * ----------------------------------------------------------
     *
     * No calibration history means unknown calibration quality.
     *
     * It must not be interpreted as:
     *
     *   reliability = 0
     *   calibration error = 0
     *
     * because that would simultaneously represent:
     *
     *   maximum reliability risk
     *   perfect calibration
     *
     * which is contradictory.
     *
     * Neutral calibration risk is therefore used until actual
     * calibration evidence exists.
     */
    const hasCalibrationHistory = reliability > 0 || sampleSize > 0;

    if (!hasCalibrationHistory) {
      return 0.5;
    }

    /*
     * ----------------------------------------------------------
     * RELIABILITY RISK
     * ----------------------------------------------------------
     */
    const reliabilityRisk = 1 - reliability;

    /*
     * ----------------------------------------------------------
     * CALIBRATION SAMPLE RISK
     * ----------------------------------------------------------
     *
     * Uses the same sample-reliability curve as the confidence
     * system so calibration sample strength is represented
     * consistently across the engine.
     */
    const sampleReliability = ConfidenceUtil.sampleReliability(sampleSize);

    const sampleRisk = 1 - sampleReliability;

    /*
     * ----------------------------------------------------------
     * CALIBRATION ERROR
     * ----------------------------------------------------------
     *
     * Actual calibration error is used only when calibration
     * history exists.
     */
    const calibrationErrorRisk = this.clamp(input.calibrationError, 0, 1);

    /*
     * ----------------------------------------------------------
     * UNSUPPORTED CONFIDENCE
     * ----------------------------------------------------------
     *
     * High confidence is not inherently dangerous.
     *
     * The concern is:
     *
     *   high confidence
     *   +
     *   weak calibration evidence
     *
     * This remains completely independent from probability.
     *
     * Confidence below 70 receives no unsupported-confidence
     * penalty.
     */
    const confidenceIntensity = this.clamp((confidence - 70) / 28, 0, 1);

    const unsupportedConfidenceRisk = confidenceIntensity * reliabilityRisk;

    /*
     * ----------------------------------------------------------
     * CALIBRATION RISK
     * ----------------------------------------------------------
     */
    return this.clamp(
      reliabilityRisk * 0.35 +
        sampleRisk * 0.2 +
        calibrationErrorRisk * 0.3 +
        unsupportedConfidenceRisk * 0.15,
      0,
      1,
    );
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
