import { DecisionScore } from '../interfaces/decision-score.interface';

export class DecisionScoreUtil {
  /*
   * ----------------------------------------------------------
   * DECISION SCORE WEIGHTS
   * ----------------------------------------------------------
   *
   * DecisionScore is a ranking signal.
   *
   * It is NOT:
   *
   * - probability
   * - confidence
   * - safety
   * - value
   * - risk
   *
   * Those remain separate outputs.
   *
   * Meaningfulness is included only as a small ranking factor.
   * It does not modify the underlying probability or confidence.
   */
  private static readonly WEIGHTS = {
    probability: 0.26,
    confidence: 0.24,
    relativeEvidence: 0.18,
    modelAgreement: 0.12,
    dataQuality: 0.08,
    safety: 0.07,
    calibration: 0.0,
    meaningfulness: 0.05,
  } as const;

  static calculate(input: {
    probability: number;
    confidence: number;
    safetyScore: number;
    modelAgreement: number;
    dataQuality: number;
    calibrationReliability: number;

    /*
     * These comparison fields are retained for diagnostics and
     * compatibility with the existing decision pipeline.
     *
     * They must NOT be converted into absolute evidence strength
     * here because this utility does not know whether the evidence
     * supports the selected proposition.
     */
    comparisonConfidence?: number;
    directionalDifference?: number;
    goalProductionDifference?: number;
    goalPreventionDifference?: number;
    evidenceCoherence?: number;

    /*
     * Selection-aware evidence.
     *
     * 0.50 = neutral
     * > 0.50 = evidence advantage
     * < 0.50 = evidence disadvantage
     */
    relativeEvidenceAdvantage?: number;

    /*
     * Selection meaningfulness / specificity.
     *
     * 0.50 = neutral
     * > 0.50 = more specific/actionable
     * < 0.50 = broader
     *
     * This is NOT:
     *
     * - probability
     * - confidence
     * - value
     * - risk
     */
    marketSpecificity?: number;
  }): DecisionScore {
    const probability = this.clamp(input.probability, 0, 1);

    /*
     * Confidence is normalized against the engine maximum.
     *
     * Confidence remains completely independent from
     * probability.
     */
    const confidence = this.clamp(input.confidence, 0, 98) / 98;

    const safety = this.clamp(input.safetyScore, 0, 100) / 100;

    const agreement = this.clamp(input.modelAgreement, 0, 1);

    const dataQuality = this.clamp(input.dataQuality, 0, 100) / 100;

    const calibration = this.clamp(input.calibrationReliability, 0, 100) / 100;

    /*
     * ----------------------------------------------------------
     * SELECTION-ALIGNED EVIDENCE
     * ----------------------------------------------------------
     *
     * The decision score must use evidence already interpreted
     * for the candidate.
     */
    const relativeEvidence = this.clamp(
      input.relativeEvidenceAdvantage ?? 0.5,
      0,
      1,
    );

    /*
     * ----------------------------------------------------------
     * EVIDENCE COHERENCE
     * ----------------------------------------------------------
     *
     * Coherence is a supporting component of selection-aware
     * evidence. It does not become another probability.
     */
    const evidenceCoherence =
      input.evidenceCoherence !== undefined
        ? this.clamp(input.evidenceCoherence, 0, 1)
        : null;

    const selectionEvidence =
      evidenceCoherence !== null
        ? this.clamp(relativeEvidence * 0.8 + evidenceCoherence * 0.2, 0, 1)
        : relativeEvidence;

    /*
     * ----------------------------------------------------------
     * MEANINGFULNESS / SPECIFICITY
     * ----------------------------------------------------------
     *
     * This comes from the configured market-selection metadata.
     *
     * It is deliberately given only a small influence so that
     * meaningfulness cannot overpower probability, confidence,
     * evidence, safety, or model agreement.
     *
     * Example:
     *
     *   BROAD    = 0.25
     *   STANDARD = 0.50
     *   SPECIFIC = 0.75
     *
     * This does NOT mean SPECIFIC predictions are more likely
     * to be correct.
     */
    const marketSpecificity = this.clamp(input.marketSpecificity ?? 0.5, 0, 1);

    /*
     * ----------------------------------------------------------
     * FINAL DECISION SCORE
     * ----------------------------------------------------------
     *
     * This remains a ranking score for comparing candidates.
     *
     * It does not redefine any underlying prediction output.
     */
    const total =
      probability * this.WEIGHTS.probability +
      confidence * this.WEIGHTS.confidence +
      selectionEvidence * this.WEIGHTS.relativeEvidence +
      agreement * this.WEIGHTS.modelAgreement +
      dataQuality * this.WEIGHTS.dataQuality +
      safety * this.WEIGHTS.safety +
      calibration * this.WEIGHTS.calibration +
      marketSpecificity * this.WEIGHTS.meaningfulness;

    return {
      total: this.clamp(total, 0, 1),

      probability,

      confidence,

      safety,

      modelAgreement: agreement,

      dataQuality,

      calibration,
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
