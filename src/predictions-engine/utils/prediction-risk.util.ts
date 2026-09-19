// src/predictions-engine/utils/prediction-risk.util.ts

import { PredictionRisk } from '../enums/prediction-risk.enum';

export class PredictionRiskUtil {
  /*
   * ----------------------------------------------------------
   * RISK-BAND BOUNDARIES
   * ----------------------------------------------------------
   *
   * These classify the already-calculated continuous risk score.
   *
   * They are not probability gates and are not market-specific.
   */
  private static readonly LOW_RISK_MAX = 0.33;

  private static readonly MEDIUM_RISK_MAX = 0.66;

  /*
   * ----------------------------------------------------------
   * DYNAMIC RISK WEIGHTS
   * ----------------------------------------------------------
   *
   * Risk considers:
   *
   * - outcome probability
   * - confidence
   * - safety
   * - structural consistency
   * - data quality
   * - calibration reliability
   *
   * The weights sum to 1.
   */
  private static readonly WEIGHTS = {
    probabilityRisk: 0.2,
    confidenceRisk: 0.2,
    safetyRisk: 0.22,
    agreementRisk: 0.16,
    dataRisk: 0.12,
    calibrationRisk: 0.1,
  } as const;

  /*
   * ----------------------------------------------------------
   * RISK CLASSIFICATION
   * ----------------------------------------------------------
   *
   * Calculates the continuous score once and then classifies
   * that exact score.
   */
  static fromScores(input: {
    probability: number;
    confidence: number;
    safetyScore: number;
    modelAgreement: number;
    dataQuality: number;
    calibrationReliability: number;
  }): PredictionRisk {
    return this.fromRiskScore(this.score(input));
  }

  /*
   * ----------------------------------------------------------
   * CLASSIFY EXISTING RISK SCORE
   * ----------------------------------------------------------
   *
   * This is important for SafetyEngine.
   *
   * SafetyEngine already calculates the richer continuous risk
   * score using calibration error, comparison evidence and
   * structural risk.
   *
   * It must not calculate another risk score merely to determine
   * the enum.
   */
  static fromRiskScore(riskScore: number): PredictionRisk {
    const normalizedRisk = this.clamp(riskScore, 0, 1);

    if (normalizedRisk <= this.LOW_RISK_MAX) {
      return PredictionRisk.LOW;
    }

    if (normalizedRisk <= this.MEDIUM_RISK_MAX) {
      return PredictionRisk.MEDIUM;
    }

    return PredictionRisk.HIGH;
  }

  /*
   * ----------------------------------------------------------
   * CONTINUOUS RISK SCORE
   * ----------------------------------------------------------
   *
   * Returns:
   *
   *   0 = lowest risk
   *   1 = highest risk
   *
   * Probability remains an input because outcome exposure is a
   * legitimate part of risk.
   *
   * It does NOT alter the probability itself.
   */
  static score(input: {
    probability: number;
    confidence: number;
    safetyScore: number;
    modelAgreement: number;
    dataQuality: number;
    calibrationReliability: number;
  }): number {
    const probability = this.clamp(input.probability, 0, 1);

    const confidence = this.clamp(input.confidence, 0, 98);

    const safetyScore = this.clamp(input.safetyScore, 0, 100);

    const agreement = this.clamp(input.modelAgreement, 0, 1);

    const dataQuality = this.clamp(input.dataQuality, 0, 100);

    const calibrationReliability = this.clamp(
      input.calibrationReliability,
      0,
      100,
    );

    /*
     * ----------------------------------------------------------
     * PROBABILITY RISK
     * ----------------------------------------------------------
     *
     * A lower-probability selected outcome has greater outcome
     * exposure.
     *
     * This is intentionally independent from confidence.
     *
     * Example:
     *
     *   probability = 0.10
     *   confidence  = 89
     *
     * is valid.
     *
     * The confidence says the system trusts its 10% estimate.
     * The risk still recognizes that the selected event is
     * unlikely to occur.
     */
    const probabilityRisk = 1 - probability;

    /*
     * ----------------------------------------------------------
     * CONFIDENCE RISK
     * ----------------------------------------------------------
     *
     * Low confidence means greater uncertainty about the
     * probability estimate.
     */
    const confidenceRisk = 1 - confidence / 98;

    /*
     * ----------------------------------------------------------
     * SAFETY RISK
     * ----------------------------------------------------------
     */
    const safetyRisk = 1 - safetyScore / 100;

    /*
     * ----------------------------------------------------------
     * STRUCTURAL CONSISTENCY RISK
     * ----------------------------------------------------------
     *
     * modelAgreement is now understood as structural consistency,
     * not independent-model voting.
     */
    const agreementRisk = 1 - agreement;

    /*
     * ----------------------------------------------------------
     * DATA RISK
     * ----------------------------------------------------------
     */
    const dataRisk = 1 - dataQuality / 100;

    /*
     * ----------------------------------------------------------
     * CALIBRATION RISK
     * ----------------------------------------------------------
     *
     * No calibration history is neutral.
     *
     * Existing calibration reliability lowers risk.
     */
    const calibrationRisk =
      calibrationReliability > 0 ? 1 - calibrationReliability / 100 : 0.5;

    const riskScore =
      probabilityRisk * this.WEIGHTS.probabilityRisk +
      confidenceRisk * this.WEIGHTS.confidenceRisk +
      safetyRisk * this.WEIGHTS.safetyRisk +
      agreementRisk * this.WEIGHTS.agreementRisk +
      dataRisk * this.WEIGHTS.dataRisk +
      calibrationRisk * this.WEIGHTS.calibrationRisk;

    return this.clamp(riskScore, 0, 1);
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
