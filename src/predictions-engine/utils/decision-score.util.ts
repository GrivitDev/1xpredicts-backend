import { DecisionScore } from '../interfaces/decision-score.interface';

export class DecisionScoreUtil {
  static calculate(input: {
    probability: number;
    confidence: number;
    safetyScore: number;
    modelAgreement: number;
    dataQuality: number;
    calibrationReliability: number;
  }): DecisionScore {
    const probability = this.clamp(input.probability, 0, 1);

    const confidence = this.clamp(input.confidence, 0, 98) / 98;

    const safety = this.clamp(input.safetyScore, 0, 100) / 100;

    const agreement = this.clamp(input.modelAgreement, 0, 1);

    const dataQuality = this.clamp(input.dataQuality, 0, 100) / 100;

    const calibration = this.clamp(input.calibrationReliability, 0, 100) / 100;

    /*
     * Probability remains the largest contributor.
     * Supporting evidence determines how trustworthy that
     * probability is.
     *
     * Calibration is deliberately given a smaller advisory weight.
     * A new prediction with no calibration history therefore does
     * not suffer a major decision-score penalty.
     */
    const probabilityScore = probability;

    const confidenceScore = confidence;

    const safetyScore = safety;

    const agreementScore = agreement;

    const dataQualityScore = dataQuality;

    const calibrationScore = calibration;

    const total =
      probabilityScore * 0.32 +
      confidenceScore * 0.18 +
      safetyScore * 0.2 +
      agreementScore * 0.14 +
      dataQualityScore * 0.12 +
      calibrationScore * 0.04;

    return {
      total: this.clamp(total, 0, 1),

      probability: probabilityScore,

      confidence: confidenceScore,

      safety: safetyScore,

      modelAgreement: agreementScore,

      dataQuality: dataQualityScore,

      calibration: calibrationScore,
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
