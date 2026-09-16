// src/predictions-engine/engines/ensemble/confidence.engine.ts

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
    const probability = this.clamp(input.probability.probability, 0, 1);

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

    const calibrationReliability =
      this.clamp(input.calibrationReliability ?? 0, 0, 100) / 100;

    const sampleSize = Math.max(
      Math.floor(input.sampleSize ?? input.probability.sampleSize ?? 0),
      0,
    );

    const sampleReliability = ConfidenceUtil.sampleReliability(sampleSize);

    const agreement = this.clamp(input.probability.modelAgreement ?? 0, 0, 1);

    const safety = this.clamp(input.safety.safetyScore / 100, 0, 1);

    /*
     * ----------------------------------------------------------
     * TEAM-COMPARISON EVIDENCE
     * ----------------------------------------------------------
     */
    const comparisonConfidence = this.clamp(
      input.comparisonConfidence ??
        this.readModelSignal(input.probability, 'comparisonConfidence') ??
        0,
      0,
      1,
    );

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

    const evidenceCoherence =
      input.evidenceCoherence !== undefined
        ? this.clamp(input.evidenceCoherence, 0, 1)
        : this.calculateEvidenceCoherence(
            input.probability,
            agreement,
            comparisonConfidence,
            directionalDifference,
            goalProductionDifference,
            goalPreventionDifference,
          );

    /*
     * ----------------------------------------------------------
     * PROBABILITY SIGNAL
     * ----------------------------------------------------------
     *
     * Probability is an outcome estimate.
     *
     * It must NOT dominate confidence merely because the
     * selection is statistically easier to satisfy.
     *
     * Confidence therefore derives primarily from evidence
     * quality, agreement, comparison support and reliability.
     */
    const probabilityStrength = this.calculateProbabilityStrength(probability);

    /*
     * ----------------------------------------------------------
     * COMPARISON SIGNAL
     * ----------------------------------------------------------
     */
    const comparisonEvidence = this.calculateComparisonEvidence(
      comparisonConfidence,
      directionalDifference,
      goalProductionDifference,
      goalPreventionDifference,
      evidenceCoherence,
    );

    /*
     * ----------------------------------------------------------
     * EVIDENCE SCORE
     * ----------------------------------------------------------
     *
     * Confidence is primarily evidence-driven.
     *
     * Probability contributes only 12% to prevent the engine
     * from turning naturally high-probability markets into
     * automatically high-confidence recommendations.
     */
    const evidenceScore =
      modelReliability * 0.2 +
      agreement * 0.2 +
      dataQuality * 0.17 +
      comparisonEvidence * 0.25 +
      safety * 0.08 +
      sampleReliability * 0.06 +
      this.calibrationSupport(calibrationReliability) * 0.04;

    /*
     * ----------------------------------------------------------
     * PROBABILITY / EVIDENCE BLEND
     * ----------------------------------------------------------
     */
    let confidence = evidenceScore * 88 + probabilityStrength * 12;

    confidence = this.applyComparisonAdjustment(
      confidence,
      evidenceCoherence,
      comparisonConfidence,
      probability,
    );

    confidence = this.applyAgreementAdjustment(
      confidence,
      agreement,
      probability,
    );

    confidence = this.applyProbabilityCoherence(
      confidence,
      probability,
      evidenceScore,
      evidenceCoherence,
    );

    /*
     * ----------------------------------------------------------
     * EVIDENCE CAPS
     * ----------------------------------------------------------
     */
    confidence = this.applyEvidenceCaps(confidence, {
      modelReliability,
      dataQuality,
      sampleReliability,
      agreement,
      safety,
      comparisonEvidence,
    });

    /*
     * ----------------------------------------------------------
     * CALIBRATION
     * ----------------------------------------------------------
     */
    const calibrationError = this.clamp(input.calibrationError ?? 0, 0, 1);

    if (sampleSize >= 10 && calibrationReliability > 0) {
      confidence *= 1 - Math.min(calibrationError * 0.3, 0.18);
    }

    confidence = ConfidenceUtil.clamp(confidence);

    const factors: Record<string, number> = {
      probabilityStrength,

      modelReliability,

      dataQuality,

      calibrationReliability,

      sampleReliability,

      modelAgreement: agreement,

      safety,

      comparisonConfidence,

      directionalEvidence: Math.abs(directionalDifference),

      goalProductionEvidence: Math.abs(goalProductionDifference),

      goalPreventionEvidence: Math.abs(goalPreventionDifference),

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
      agreement,
      safety,
      comparisonConfidence,
      evidenceCoherence,
      comparisonEvidence,
    });

    return {
      confidence,

      modelAgreement: agreement,

      safetyScore: this.clamp(input.safety.safetyScore, 0, 100),

      dataQuality: this.clamp(input.probability.dataQuality ?? 0, 0, 100),

      statisticalReliability: this.clamp(modelReliability * 100, 0, 100),

      calibrationReliability: calibrationReliability * 100,

      sampleReliability: sampleReliability * 100,

      factors,

      reasons,
    };
  }

  private calculateProbabilityStrength(probability: number): number {
    /*
     * Probability is informative but not a confidence generator.
     *
     * A 90% market does not receive 90% confidence merely because
     * its probability is high.
     */
    const strength = (probability - 0.5) / 0.5;

    return this.clamp(strength, 0, 1);
  }

  private calculateComparisonEvidence(
    comparisonConfidence: number,
    directionalDifference: number,
    goalProductionDifference: number,
    goalPreventionDifference: number,
    evidenceCoherence: number,
  ): number {
    const directionalStrength = this.clamp(
      Math.abs(directionalDifference),
      0,
      1,
    );

    const goalStrength = this.clamp(
      (Math.abs(goalProductionDifference) +
        Math.abs(goalPreventionDifference)) /
        2,
      0,
      1,
    );

    return this.clamp(
      comparisonConfidence * 0.35 +
        directionalStrength * 0.15 +
        goalStrength * 0.15 +
        evidenceCoherence * 0.35,
      0,
      1,
    );
  }

  private calculateEvidenceCoherence(
    probabilityResult: ProbabilityModelResult,
    agreement: number,
    comparisonConfidence: number,
    directionalDifference: number,
    goalProductionDifference: number,
    goalPreventionDifference: number,
  ): number {
    const selectedProbability = this.clamp(probabilityResult.probability, 0, 1);

    const comparisonModel = this.readModelSignal(
      probabilityResult,
      'comparisonModel',
    );

    const commonModel = this.readModelSignal(
      probabilityResult,
      'commonScoreMatrix',
    );

    const registeredModel = this.readModelSignal(
      probabilityResult,
      'registeredMarketModel',
    );

    const deviations: number[] = [];

    if (comparisonModel !== null) {
      deviations.push(Math.abs(selectedProbability - comparisonModel));
    }

    if (commonModel !== null) {
      deviations.push(Math.abs(selectedProbability - commonModel));
    }

    if (registeredModel !== null) {
      deviations.push(Math.abs(selectedProbability - registeredModel));
    }

    const modelCoherence =
      deviations.length > 0
        ? this.clamp(
            1 -
              (deviations.reduce((sum, value) => sum + value, 0) /
                deviations.length) *
                4,
            0,
            1,
          )
        : agreement;

    const directionalStrength = Math.abs(directionalDifference);

    const goalStrength =
      (Math.abs(goalProductionDifference) +
        Math.abs(goalPreventionDifference)) /
      2;

    const underlyingEvidence = this.clamp(
      comparisonConfidence *
        (0.55 + directionalStrength * 0.2 + goalStrength * 0.25),
      0,
      1,
    );

    return this.clamp(
      modelCoherence * 0.5 +
        underlyingEvidence * 0.3 +
        comparisonConfidence * 0.2,
      0,
      1,
    );
  }

  private applyComparisonAdjustment(
    confidence: number,
    evidenceCoherence: number,
    comparisonConfidence: number,
    probability: number,
  ): number {
    let multiplier = 1;

    if (evidenceCoherence >= 0.85) {
      multiplier = 1;
    } else if (evidenceCoherence >= 0.75) {
      multiplier = 0.98;
    } else if (evidenceCoherence >= 0.65) {
      multiplier = 0.95;
    } else if (evidenceCoherence >= 0.55) {
      multiplier = 0.91;
    } else if (evidenceCoherence >= 0.45) {
      multiplier = 0.85;
    } else {
      multiplier = 0.76;
    }

    /*
     * High probability with weak comparison evidence is not
     * automatically trusted.
     */
    if (probability >= 0.8 && comparisonConfidence < 0.5) {
      multiplier *= 0.9;
    }

    if (probability >= 0.9 && evidenceCoherence < 0.6) {
      multiplier *= 0.88;
    }

    return confidence * multiplier;
  }

  private applyAgreementAdjustment(
    confidence: number,
    agreement: number,
    probability: number,
  ): number {
    let multiplier = 1;

    if (agreement >= 0.85) {
      multiplier = 1;
    } else if (agreement >= 0.75) {
      multiplier = 0.98;
    } else if (agreement >= 0.65) {
      multiplier = 0.95;
    } else if (agreement >= 0.55) {
      multiplier = 0.91;
    } else if (agreement >= 0.45) {
      multiplier = 0.85;
    } else {
      multiplier = 0.75;
    }

    if (probability >= 0.85 && agreement < 0.65) {
      multiplier *= 0.9;
    }

    if (probability >= 0.9 && agreement < 0.75) {
      multiplier *= 0.9;
    }

    return confidence * multiplier;
  }

  private applyProbabilityCoherence(
    confidence: number,
    probability: number,
    evidenceScore: number,
    evidenceCoherence: number,
  ): number {
    let result = confidence;

    /*
     * Probability limits the maximum confidence band.
     *
     * It does NOT create a minimum confidence floor.
     */
    if (probability < 0.55) {
      result = Math.min(result, 55);
    } else if (probability < 0.6) {
      result = Math.min(result, 62);
    } else if (probability < 0.65) {
      result = Math.min(result, 70);
    } else if (probability < 0.7) {
      result = Math.min(result, 76);
    } else if (probability < 0.75) {
      result = Math.min(result, 82);
    } else if (probability < 0.8) {
      result = Math.min(result, 87);
    } else if (probability < 0.85) {
      result = Math.min(result, 91);
    } else if (probability < 0.9) {
      result = Math.min(result, 94);
    }

    /*
     * Removed the previous probability-based confidence floors.
     *
     * A 95% probability with weak evidence must remain capable
     * of producing low/moderate confidence.
     *
     * A strong probability + strong evidence naturally earns
     * higher confidence through the evidence score itself.
     */

    /*
     * High probability with weak coherence is explicitly capped.
     */
    if (probability >= 0.8 && evidenceCoherence < 0.45) {
      result = Math.min(result, 62);
    }

    if (probability >= 0.9 && evidenceCoherence < 0.55) {
      result = Math.min(result, 70);
    }

    /*
     * High probability with weak overall evidence cannot become
     * an automatically high-confidence selection.
     */
    if (probability >= 0.9 && evidenceScore < 0.55) {
      result = Math.min(result, 74);
    }

    if (probability >= 0.95 && evidenceScore < 0.65) {
      result = Math.min(result, 80);
    }

    return result;
  }

  private applyEvidenceCaps(
    confidence: number,
    evidence: {
      modelReliability: number;
      dataQuality: number;
      sampleReliability: number;
      agreement: number;
      safety: number;
      comparisonEvidence: number;
    },
  ): number {
    let result = confidence;

    if (evidence.modelReliability < 0.3) {
      result = Math.min(result, 55);
    } else if (evidence.modelReliability < 0.4) {
      result = Math.min(result, 62);
    } else if (evidence.modelReliability < 0.5) {
      result = Math.min(result, 70);
    }

    if (evidence.dataQuality < 0.35) {
      result = Math.min(result, 55);
    } else if (evidence.dataQuality < 0.5) {
      result = Math.min(result, 65);
    } else if (evidence.dataQuality < 0.6) {
      result = Math.min(result, 72);
    }

    if (evidence.sampleReliability < 0.25) {
      result = Math.min(result, 55);
    } else if (evidence.sampleReliability < 0.4) {
      result = Math.min(result, 65);
    } else if (evidence.sampleReliability < 0.5) {
      result = Math.min(result, 72);
    }

    if (evidence.agreement < 0.35) {
      result = Math.min(result, 52);
    } else if (evidence.agreement < 0.45) {
      result = Math.min(result, 60);
    } else if (evidence.agreement < 0.55) {
      result = Math.min(result, 68);
    }

    if (evidence.safety < 0.4) {
      result = Math.min(result, 55);
    } else if (evidence.safety < 0.5) {
      result = Math.min(result, 63);
    } else if (evidence.safety < 0.6) {
      result = Math.min(result, 72);
    }

    if (evidence.comparisonEvidence < 0.35) {
      result = Math.min(result, 55);
    } else if (evidence.comparisonEvidence < 0.45) {
      result = Math.min(result, 62);
    } else if (evidence.comparisonEvidence < 0.55) {
      result = Math.min(result, 70);
    }

    return result;
  }

  private calibrationSupport(reliability: number): number {
    /*
     * No calibration history is neutral rather than negative.
     */
    if (reliability <= 0) {
      return 0.7;
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
    agreement: number;
    safety: number;
    comparisonConfidence: number;
    evidenceCoherence: number;
    comparisonEvidence: number;
  }): string[] {
    const reasons: string[] = [];

    if (input.probability >= 0.9) {
      reasons.push('Underlying probability is very high.');
    } else if (input.probability >= 0.8) {
      reasons.push('Underlying probability is high.');
    } else if (input.probability >= 0.7) {
      reasons.push('Underlying probability is favourable.');
    } else if (input.probability >= 0.65) {
      reasons.push(
        'Underlying probability provides a meaningful prediction signal.',
      );
    }

    if (input.modelReliability >= 0.75) {
      reasons.push('Primary model reliability is strong.');
    } else if (input.modelReliability < 0.5) {
      reasons.push('Primary model reliability limits confidence.');
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
      reasons.push('Team-comparison confidence is strong.');
    } else if (input.comparisonConfidence < 0.5) {
      reasons.push('Team-comparison confidence is limited.');
    }

    if (input.comparisonEvidence >= 0.75) {
      reasons.push('Team comparison provides substantial supporting evidence.');
    } else if (input.comparisonEvidence < 0.5) {
      reasons.push('Team comparison provides limited supporting evidence.');
    }

    if (input.evidenceCoherence >= 0.8) {
      reasons.push(
        'The probability is strongly coherent with the underlying evidence.',
      );
    } else if (input.evidenceCoherence < 0.5) {
      reasons.push(
        'The probability has meaningful disagreement with the underlying comparison evidence.',
      );
    }

    if (input.agreement >= 0.85) {
      reasons.push('The prediction models are strongly aligned.');
    } else if (input.agreement >= 0.7) {
      reasons.push('The prediction models show good agreement.');
    } else if (input.agreement < 0.6) {
      reasons.push('The prediction models show meaningful disagreement.');
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

    if (input.confidence >= 95) {
      reasons.push(
        'Exceptional confidence requires continued calibration monitoring.',
      );
    } else if (input.confidence >= 90) {
      reasons.push(
        'Confidence is strongly supported by the available evidence.',
      );
    } else if (input.confidence >= 75) {
      reasons.push(
        'Confidence is meaningfully supported by probability and evidence.',
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
