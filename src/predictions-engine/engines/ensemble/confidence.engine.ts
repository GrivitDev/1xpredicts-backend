import { Injectable } from '@nestjs/common';

import { ConfidenceResult } from '../../interfaces/confidence-result.interface';
import { ProbabilityModelResult } from '../../interfaces/probability-result.interface';
import { SafetyResult } from '../../interfaces/safety-result.interface';

import { ConfidenceUtil } from '../../utils/confidence.util';

@Injectable()
export class ConfidenceEngine {
  calculate(input: {
    probability: ProbabilityModelResult;
    safety: SafetyResult;

    calibrationReliability: number;
    calibrationError?: number;
    sampleSize?: number;

    comparisonConfidence?: number;
    directionalDifference?: number;
    goalProductionDifference?: number;
    goalPreventionDifference?: number;
    evidenceCoherence?: number;
  }): ConfidenceResult {
    /*
     * ----------------------------------------------------------
     * PROBABILITY
     * ----------------------------------------------------------
     *
     * Probability and confidence have different meanings.
     *
     * Probability:
     *   "What is the estimated chance of the outcome?"
     *
     * Confidence:
     *   "How much do we trust that estimate?"
     *
     * Probability magnitude is therefore NOT used to calculate
     * confidence.
     *
     * It is retained only as a diagnostic/output factor.
     */
    const probability = this.clamp(input.probability.probability, 0, 1);

    /*
     * ----------------------------------------------------------
     * CORE EVIDENCE
     * ----------------------------------------------------------
     */
    const modelReliability = this.clamp(
      input.probability.modelReliability ?? 0,
      0,
      1,
    );

    const dataQuality = this.clamp(
      (input.probability.dataQuality ?? 0) / 100,
      0,
      1,
    );

    /*
     * Calibration reliability remains a trust signal.
     *
     * It does not modify probability.
     */
    const calibrationReliability =
      this.clamp(input.calibrationReliability ?? 0, 0, 100) / 100;

    const sampleSize = Math.max(
      Math.floor(input.sampleSize ?? input.probability.sampleSize ?? 0),
      0,
    );

    const sampleReliability = ConfidenceUtil.sampleReliability(sampleSize);

    /*
     * ----------------------------------------------------------
     * STRUCTURAL CONSISTENCY
     * ----------------------------------------------------------
     *
     * Phase 2 established that the registered market engines are
     * market calculators built from the same RawGoalModel rather
     * than statistically independent models.
     *
     * Therefore this value should be interpreted as structural
     * consistency, not independent model consensus.
     */
    const structuralConsistency = this.clamp(
      input.probability.modelAgreement ?? 0,
      0,
      1,
    );

    /*
     * ----------------------------------------------------------
     * SAFETY
     * ----------------------------------------------------------
     */
    const safety = this.clamp(input.safety.safetyScore / 100, 0, 1);

    /*
     * ----------------------------------------------------------
     * TEAM-COMPARISON EVIDENCE
     * ----------------------------------------------------------
     *
     * Comparison confidence measures how trustworthy the
     * comparison evidence is.
     *
     * The magnitude of directional/goal differences does not
     * automatically increase confidence because strength of a
     * signal is not the same thing as trust in that signal.
     */
    const comparisonConfidence = this.clamp(
      input.comparisonConfidence ??
        this.readModelSignal(input.probability, 'comparisonConfidence') ??
        0,
      0,
      1,
    );

    /*
     * These values are retained as diagnostics only.
     *
     * They are deliberately NOT converted into confidence through
     * Math.abs(), because that would reward evidence magnitude
     * regardless of whether the evidence is appropriate for the
     * selected proposition.
     */
    const directionalDifference = this.clamp(
      input.directionalDifference ??
        this.readModelSignal(input.probability, 'directionalDifference') ??
        0,
      -1,
      1,
    );

    const goalProductionDifference = this.clamp(
      input.goalProductionDifference ??
        this.readModelSignal(input.probability, 'goalProductionDifference') ??
        0,
      -1,
      1,
    );

    const goalPreventionDifference = this.clamp(
      input.goalPreventionDifference ??
        this.readModelSignal(input.probability, 'goalPreventionDifference') ??
        0,
      -1,
      1,
    );

    /*
     * ----------------------------------------------------------
     * EVIDENCE COHERENCE
     * ----------------------------------------------------------
     *
     * When the orchestration layer supplies a selection-specific
     * coherence measurement, use it directly.
     *
     * This is the preferred path because that layer knows whether
     * the supporting evidence actually endorses the selected
     * proposition.
     *
     * When unavailable, use a conservative structural fallback.
     *
     * IMPORTANT:
     *
     * The fallback does NOT inspect probability magnitude.
     */
    const evidenceCoherence =
      input.evidenceCoherence !== undefined
        ? this.clamp(input.evidenceCoherence, 0, 1)
        : this.calculateEvidenceCoherence(
            structuralConsistency,
            comparisonConfidence,
          );

    /*
     * ----------------------------------------------------------
     * COMPARISON EVIDENCE
     * ----------------------------------------------------------
     *
     * Comparison evidence is a trust/support signal.
     *
     * It is intentionally not based on the absolute magnitude of
     * directional differences.
     */
    const comparisonEvidence = this.calculateComparisonEvidence(
      comparisonConfidence,
      evidenceCoherence,
    );

    /*
     * ----------------------------------------------------------
     * CALIBRATION SUPPORT
     * ----------------------------------------------------------
     *
     * No calibration history should be neutral rather than
     * automatically strong.
     */
    const calibrationSupport = this.calibrationSupport(calibrationReliability);

    /*
     * ----------------------------------------------------------
     * BASE CONFIDENCE
     * ----------------------------------------------------------
     *
     * Confidence is constructed entirely from evidence quality.
     *
     * Probability magnitude is NOT included.
     */
    const evidenceScore =
      modelReliability * 0.26 +
      dataQuality * 0.18 +
      structuralConsistency * 0.12 +
      comparisonConfidence * 0.12 +
      evidenceCoherence * 0.1 +
      safety * 0.1 +
      sampleReliability * 0.07 +
      calibrationSupport * 0.05;

    let confidence = evidenceScore * 100;

    /*
     * ----------------------------------------------------------
     * CALIBRATION ERROR
     * ----------------------------------------------------------
     *
     * Calibration error reduces trust in the estimate.
     *
     * It does not alter probability and does not use probability
     * magnitude.
     */
    const calibrationError = this.clamp(input.calibrationError ?? 0, 0, 1);

    if (sampleSize >= 10 && calibrationReliability > 0) {
      const calibrationPenalty = Math.min(calibrationError * 0.3, 0.18);

      confidence *= 1 - calibrationPenalty;
    }

    /*
     * ----------------------------------------------------------
     * EVIDENCE CAPS
     * ----------------------------------------------------------
     *
     * These are evidence-quality ceilings only.
     *
     * There is deliberately NO probability-based confidence cap.
     *
     * Therefore:
     *
     *   10% probability + 89% confidence
     *
     * remains possible when the evidence package is highly trusted.
     */
    confidence = this.applyEvidenceCaps(confidence, {
      modelReliability,
      dataQuality,
      sampleReliability,
      structuralConsistency,
      safety,
      comparisonConfidence,
      evidenceCoherence,
    });

    /*
     * Confidence has a global engine maximum of 98.
     *
     * This does NOT force low confidence upward.
     *
     * It only prevents 99/100 from ever being produced.
     *
     * The publication minimum of 60 and the relationship between
     * confidence and probability are enforced later by
     * FinalDecisionEngine.
     */
    confidence = this.clamp(confidence, 0, 98);

    /*
     * ----------------------------------------------------------
     * FACTORS
     * ----------------------------------------------------------
     *
     * Probability is included for audit visibility only.
     * It does not contribute to the confidence calculation.
     */
    const factors: Record<string, number> = {
      probability,

      modelReliability,

      dataQuality,

      calibrationReliability,

      sampleReliability,

      modelAgreement: structuralConsistency,

      structuralConsistency,

      safety,

      comparisonConfidence,

      directionalDifference,

      goalProductionDifference,

      goalPreventionDifference,

      evidenceCoherence,

      comparisonEvidence,

      evidenceScore,
    };

    const reasons = this.buildReasons({
      probability,
      confidence,
      modelReliability,
      dataQuality,
      calibrationReliability,
      sampleReliability,
      structuralConsistency,
      safety,
      comparisonConfidence,
      evidenceCoherence,
      comparisonEvidence,
    });

    return {
      confidence,

      /*
       * Compatibility field.
       *
       * Phase 2 means this should be interpreted as structural
       * probability consistency, not independent-model consensus.
       */
      modelAgreement: structuralConsistency,

      safetyScore: this.clamp(input.safety.safetyScore, 0, 100),

      dataQuality: this.clamp(input.probability.dataQuality ?? 0, 0, 100),

      statisticalReliability: this.clamp(modelReliability * 100, 0, 100),

      calibrationReliability: calibrationReliability * 100,

      sampleReliability: sampleReliability * 100,

      factors,

      reasons,
    };
  }

  private calculateComparisonEvidence(
    comparisonConfidence: number,
    evidenceCoherence: number,
  ): number {
    return this.clamp(
      comparisonConfidence * 0.55 + evidenceCoherence * 0.45,
      0,
      1,
    );
  }

  private calculateEvidenceCoherence(
    structuralConsistency: number,
    comparisonConfidence: number,
  ): number {
    /*
     * Conservative fallback only.
     *
     * The preferred path is for MarketEvaluationService to provide
     * a selection-aware coherence score.
     *
     * No probability value is inspected here.
     */
    return this.clamp(
      structuralConsistency * 0.55 + comparisonConfidence * 0.45,
      0,
      1,
    );
  }

  private applyEvidenceCaps(
    confidence: number,
    evidence: {
      modelReliability: number;
      dataQuality: number;
      sampleReliability: number;
      structuralConsistency: number;
      safety: number;
      comparisonConfidence: number;
      evidenceCoherence: number;
    },
  ): number {
    let result = confidence;

    /*
     * Primary model evidence.
     */
    if (evidence.modelReliability < 0.25) {
      result = Math.min(result, 48);
    } else if (evidence.modelReliability < 0.35) {
      result = Math.min(result, 58);
    } else if (evidence.modelReliability < 0.45) {
      result = Math.min(result, 68);
    } else if (evidence.modelReliability < 0.55) {
      result = Math.min(result, 76);
    }

    /*
     * Data quality.
     */
    if (evidence.dataQuality < 0.3) {
      result = Math.min(result, 48);
    } else if (evidence.dataQuality < 0.45) {
      result = Math.min(result, 58);
    } else if (evidence.dataQuality < 0.55) {
      result = Math.min(result, 68);
    }

    /*
     * Historical sample reliability.
     */
    if (evidence.sampleReliability < 0.2) {
      result = Math.min(result, 50);
    } else if (evidence.sampleReliability < 0.35) {
      result = Math.min(result, 60);
    } else if (evidence.sampleReliability < 0.5) {
      result = Math.min(result, 72);
    }

    /*
     * Structural consistency.
     *
     * This is not treated as independent model agreement.
     */
    if (evidence.structuralConsistency < 0.3) {
      result = Math.min(result, 50);
    } else if (evidence.structuralConsistency < 0.4) {
      result = Math.min(result, 60);
    } else if (evidence.structuralConsistency < 0.5) {
      result = Math.min(result, 68);
    }

    /*
     * Safety.
     */
    if (evidence.safety < 0.35) {
      result = Math.min(result, 55);
    } else if (evidence.safety < 0.5) {
      result = Math.min(result, 68);
    }

    /*
     * Comparison evidence availability/trust.
     */
    if (evidence.comparisonConfidence < 0.3) {
      result = Math.min(result, 52);
    } else if (evidence.comparisonConfidence < 0.4) {
      result = Math.min(result, 62);
    } else if (evidence.comparisonConfidence < 0.5) {
      result = Math.min(result, 70);
    }

    /*
     * Selection/evidence coherence.
     */
    if (evidence.evidenceCoherence < 0.25) {
      result = Math.min(result, 50);
    } else if (evidence.evidenceCoherence < 0.35) {
      result = Math.min(result, 60);
    } else if (evidence.evidenceCoherence < 0.45) {
      result = Math.min(result, 70);
    }

    return result;
  }

  private calibrationSupport(reliability: number): number {
    /*
     * No calibration history is neutral.
     */
    if (reliability <= 0) {
      return 0.5;
    }

    return this.clamp(reliability, 0, 1);
  }

  private buildReasons(input: {
    probability: number;
    confidence: number;
    modelReliability: number;
    dataQuality: number;
    calibrationReliability: number;
    sampleReliability: number;
    structuralConsistency: number;
    safety: number;
    comparisonConfidence: number;
    evidenceCoherence: number;
    comparisonEvidence: number;
  }): string[] {
    const reasons: string[] = [];

    /*
     * Probability is described independently from confidence.
     */
    if (input.probability >= 0.9) {
      reasons.push('Underlying probability estimate is very high.');
    } else if (input.probability >= 0.8) {
      reasons.push('Underlying probability estimate is high.');
    } else if (input.probability >= 0.65) {
      reasons.push(
        'Underlying probability estimate has meaningful outcome support.',
      );
    } else if (input.probability <= 0.2) {
      reasons.push(
        'Underlying probability estimate is low and is evaluated independently of confidence.',
      );
    }

    if (input.modelReliability >= 0.75) {
      reasons.push('Primary probability-model reliability is strong.');
    } else if (input.modelReliability < 0.5) {
      reasons.push('Primary probability-model reliability limits confidence.');
    }

    if (input.dataQuality >= 0.75) {
      reasons.push('Prediction data quality is strong.');
    } else if (input.dataQuality < 0.5) {
      reasons.push('Prediction data quality limits confidence.');
    }

    if (input.sampleReliability >= 0.75) {
      reasons.push('Historical sample evidence is substantial.');
    } else if (input.sampleReliability < 0.45) {
      reasons.push('Historical sample evidence is limited.');
    }

    if (input.comparisonConfidence >= 0.75) {
      reasons.push(
        'Team-comparison evidence is strongly supported by available data.',
      );
    } else if (input.comparisonConfidence < 0.5) {
      reasons.push('Team-comparison evidence has limited reliability.');
    }

    if (input.comparisonEvidence >= 0.75) {
      reasons.push('Supporting team-comparison evidence is strong.');
    } else if (input.comparisonEvidence < 0.5) {
      reasons.push('Supporting team-comparison evidence is limited.');
    }

    if (input.evidenceCoherence >= 0.8) {
      reasons.push(
        'Supporting evidence is highly coherent with the stated probability.',
      );
    } else if (input.evidenceCoherence < 0.5) {
      reasons.push(
        'Supporting evidence provides limited endorsement of the stated probability.',
      );
    }

    if (input.structuralConsistency >= 0.85) {
      reasons.push(
        'Probability-producing components are structurally consistent.',
      );
    } else if (input.structuralConsistency >= 0.7) {
      reasons.push(
        'Probability-producing components show good structural consistency.',
      );
    } else if (input.structuralConsistency < 0.6) {
      reasons.push(
        'Probability-producing components show meaningful structural inconsistency.',
      );
    }

    if (input.safety >= 0.8) {
      reasons.push('Safety assessment is strong.');
    } else if (input.safety < 0.55) {
      reasons.push('Safety assessment limits confidence.');
    }

    if (input.calibrationReliability >= 0.75) {
      reasons.push('Historical calibration reliability is strong.');
    } else if (
      input.calibrationReliability > 0 &&
      input.calibrationReliability < 0.55
    ) {
      reasons.push('Calibration history is limited or still developing.');
    }

    /*
     * Confidence is described independently from probability.
     */
    if (input.confidence >= 95) {
      reasons.push(
        'Exceptional confidence indicates unusually strong evidence support and requires continued calibration monitoring.',
      );
    } else if (input.confidence >= 90) {
      reasons.push(
        'Confidence is strongly supported by the available evidence.',
      );
    } else if (input.confidence >= 75) {
      reasons.push(
        'Confidence is meaningfully supported by the available evidence.',
      );
    } else if (input.confidence < 55) {
      reasons.push(
        'Confidence remains limited by the strength of the evidence package.',
      );
    }

    if (!reasons.length) {
      reasons.push('Confidence is limited by the available evidence.');
    }

    return reasons;
  }

  private readModelSignal(
    result: ProbabilityModelResult,
    key: string,
  ): number | null {
    const signal = result.modelSignals?.[key];

    if (typeof signal === 'number' && Number.isFinite(signal)) {
      return signal;
    }

    const output = result.modelOutputs?.[key];

    if (typeof output === 'number' && Number.isFinite(output)) {
      return output;
    }

    return null;
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
