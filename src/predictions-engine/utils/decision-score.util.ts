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

    relativeEvidenceAdvantage?: number;
    marketSpecificity?: number;
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
     * Relative evidence is centered at 0.50.
     *
     * 0.50 means neither candidate has an evidence advantage.
     * This means the score does not punish a candidate merely
     * because the engine cannot distinguish it from alternatives.
     */
    const relativeEvidenceAdvantage = this.clamp(
      input.relativeEvidenceAdvantage ?? 0.5,
      0,
      1,
    );

    /*
     * Specificity is deliberately neutral by default.
     *
     * It is included only as a very small descriptive signal.
     * It cannot overpower probability, evidence, agreement or
     * confidence.
     */
    const marketSpecificity = this.clamp(input.marketSpecificity ?? 0.5, 0, 1);

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
     * ----------------------------------------------------------
     * FINAL DECISION WEIGHTS
     * ----------------------------------------------------------
     *
     * Probability is no longer allowed to dominate the final
     * selection.
     *
     * Relative evidence is now a first-class signal.
     *
     * Safety is supporting evidence, not the objective.
     */
    const probabilityScore = probability;

    const confidenceScore = confidence;

    const safetyScoreValue = safety;

    const agreementScore = agreement;

    const dataQualityScore = dataQuality;

    const calibrationScore = calibration;

    const relativeEvidenceScore = relativeEvidenceAdvantage;

    const specificityScore = marketSpecificity;

    const total =
      probabilityScore * 0.22 +
      confidenceScore * 0.2 +
      relativeEvidenceScore * 0.16 +
      agreementScore * 0.12 +
      dataQualityScore * 0.1 +
      safetyScoreValue * 0.08 +
      comparisonEvidence * 0.07 +
      calibrationScore * 0.04 +
      specificityScore * 0.01;

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
