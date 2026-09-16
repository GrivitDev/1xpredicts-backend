// src/predictions-engine/utils/decision-score.util.ts

import { DecisionScore } from '../interfaces/decision-score.interface';

export class DecisionScoreUtil {
  static calculate(input: {
    probability: number;
    confidence: number;
    safetyScore: number;
    modelAgreement: number;
    dataQuality: number;
    calibrationReliability: number;

    comparisonConfidence?: number;
    directionalDifference?: number;
    goalProductionDifference?: number;
    goalPreventionDifference?: number;
    evidenceCoherence?: number;
  }): DecisionScore {
    const probability = this.clamp(input.probability, 0, 1);

    const confidence = this.clamp(input.confidence, 0, 98) / 98;

    const safety = this.clamp(input.safetyScore, 0, 100) / 100;

    const agreement = this.clamp(input.modelAgreement, 0, 1);

    const dataQuality = this.clamp(input.dataQuality, 0, 100) / 100;

    const calibration = this.clamp(input.calibrationReliability, 0, 100) / 100;

    const comparisonConfidence = this.clamp(
      input.comparisonConfidence ?? 0,
      0,
      1,
    );

    const directionalDifference = this.clamp(
      input.directionalDifference ?? 0,
      -1,
      1,
    );

    const goalProductionDifference = this.clamp(
      input.goalProductionDifference ?? 0,
      -1,
      1,
    );

    const goalPreventionDifference = this.clamp(
      input.goalPreventionDifference ?? 0,
      -1,
      1,
    );

    const evidenceCoherence = this.clamp(input.evidenceCoherence ?? 0, 0, 1);

    /*
     * ----------------------------------------------------------
     * COMPARISON EVIDENCE
     * ----------------------------------------------------------
     *
     * Directional evidence is made selection-aware outside this
     * utility where necessary. Here we measure the strength of
     * the underlying comparison signal without converting a
     * neutral comparison into a directional advantage.
     *
     * Goal production/prevention are treated as supporting
     * evidence rather than independent probability estimates.
     */
    const directionalStrength = Math.abs(directionalDifference);

    const goalStrength =
      Math.abs(goalProductionDifference) * 0.5 +
      Math.abs(goalPreventionDifference) * 0.5;

    const comparisonEvidence = this.clamp(
      comparisonConfidence *
        (directionalStrength * 0.4 +
          goalStrength * 0.3 +
          evidenceCoherence * 0.3),
      0,
      1,
    );

    /*
     * Probability remains the largest contributor.
     *
     * Comparison evidence now participates explicitly in the
     * decision score, while confidence, safety, agreement and
     * data quality remain important supporting signals.
     *
     * Calibration stays advisory because new predictions may
     * legitimately have little historical calibration data.
     */
    const probabilityScore = probability;

    const confidenceScore = confidence;

    const safetyScoreValue = safety;

    const agreementScore = agreement;

    const dataQualityScore = dataQuality;

    const calibrationScore = calibration;

    const total =
      probabilityScore * 0.3 +
      confidenceScore * 0.17 +
      safetyScoreValue * 0.18 +
      agreementScore * 0.13 +
      dataQualityScore * 0.1 +
      comparisonEvidence * 0.08 +
      calibrationScore * 0.04;

    return {
      total: this.clamp(total, 0, 1),

      probability: probabilityScore,

      confidence: confidenceScore,

      safety: safetyScoreValue,

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
