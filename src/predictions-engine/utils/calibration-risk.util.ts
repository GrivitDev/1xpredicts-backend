export class CalibrationRiskUtil {
  static calculate(input: {
    confidence: number;
    reliability: number;
    sampleSize: number;
    calibrationError: number;
  }): number {
    const confidence = this.clamp(input.confidence, 0, 98);

    const reliabilityRisk = 1 - this.clamp(input.reliability, 0, 1);

    const sampleRisk =
      1 - this.clamp(1 - Math.exp(-Math.max(input.sampleSize, 0) / 25), 0, 1);

    const calibrationErrorRisk = this.clamp(input.calibrationError, 0, 1);

    /*
     * High confidence is only treated as a risk amplifier
     * when calibration evidence is weak or inaccurate.
     */
    const unsupportedConfidenceRisk =
      confidence >= 90
        ? Math.min(1, 0.4 + reliabilityRisk * 0.6)
        : confidence >= 80
          ? Math.min(1, 0.2 + reliabilityRisk * 0.5)
          : 0;

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
