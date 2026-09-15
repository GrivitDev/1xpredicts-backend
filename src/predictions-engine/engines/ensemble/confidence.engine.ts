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
  }): ConfidenceResult {
    const probability = this.clamp(input.probability.probability, 0, 1);

    const modelReliability = this.clamp(
      input.probability.modelReliability ?? 0,
      0,
      1,
    );

    const dataQuality =
      this.clamp(input.probability.dataQuality ?? 0, 0, 100) / 100;

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
     * PROBABILITY SIGNAL
     * ----------------------------------------------------------
     *
     * Probability should materially influence confidence.
     *
     * 50% probability provides almost no directional support.
     * 70% provides meaningful support.
     * 80% provides strong support.
     * 90% provides very strong support.
     *
     * This does NOT mean:
     *
     *   90% probability = 90 confidence.
     *
     * Evidence must still support the probability.
     */
    const probabilityStrength = this.calculateProbabilityStrength(probability);

    /*
     * ----------------------------------------------------------
     * EVIDENCE SCORE
     * ----------------------------------------------------------
     *
     * Evidence remains the larger component of confidence.
     *
     * The system must trust the underlying evidence before
     * assigning very high confidence.
     */
    const evidenceScore =
      modelReliability * 0.22 +
      agreement * 0.22 +
      dataQuality * 0.2 +
      safety * 0.16 +
      sampleReliability * 0.12 +
      this.calibrationSupport(calibrationReliability) * 0.08;

    /*
     * ----------------------------------------------------------
     * PROBABILITY / EVIDENCE BLEND
     * ----------------------------------------------------------
     *
     * Probability now contributes meaningfully to confidence,
     * but evidence remains dominant.
     *
     * 70% evidence
     * 30% probability strength
     */
    let confidence = evidenceScore * 70 + probabilityStrength * 30;

    /*
     * ----------------------------------------------------------
     * AGREEMENT ADJUSTMENT
     * ----------------------------------------------------------
     *
     * Disagreement reduces confidence, particularly for
     * aggressive probabilities.
     */
    confidence = this.applyAgreementAdjustment(
      confidence,
      agreement,
      probability,
    );

    /*
     * ----------------------------------------------------------
     * PROBABILITY / CONFIDENCE COHERENCE
     * ----------------------------------------------------------
     *
     * Prevents two bad states:
     *
     *   very high probability + very low confidence
     *   modest probability + unrealistically high confidence
     */
    confidence = this.applyProbabilityCoherence(
      confidence,
      probability,
      agreement,
      evidenceScore,
    );

    /*
     * ----------------------------------------------------------
     * EVIDENCE CAPS
     * ----------------------------------------------------------
     *
     * Weak evidence still prevents extreme confidence.
     */
    confidence = this.applyEvidenceCaps(confidence, {
      modelReliability,
      dataQuality,
      sampleReliability,
      agreement,
      safety,
    });

    /*
     * ----------------------------------------------------------
     * CALIBRATION ADJUSTMENT
     * ----------------------------------------------------------
     *
     * Calibration remains advisory.
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
     * Convert probability into a confidence-support signal.
     *
     * 50% -> 0
     * 55% -> 0.10
     * 60% -> 0.20
     * 65% -> 0.30
     * 70% -> 0.40
     * 75% -> 0.50
     * 80% -> 0.60
     * 85% -> 0.70
     * 90% -> 0.80
     * 95% -> 0.90
     *
     * This keeps probability influential without making
     * confidence identical to probability.
     */
    const strength = (probability - 0.5) / 0.5;

    return this.clamp(strength, 0, 1);
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

    /*
     * High probabilities require stronger agreement.
     */
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
    agreement: number,
    evidenceScore: number,
  ): number {
    let result = confidence;

    /*
     * ----------------------------------------------------------
     * UPPER COHERENCE LIMIT
     * ----------------------------------------------------------
     *
     * Moderate probabilities cannot produce exceptional
     * confidence simply because the underlying evidence happens
     * to be strong.
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
     * ----------------------------------------------------------
     * LOWER COHERENCE SUPPORT
     * ----------------------------------------------------------
     *
     * A very strong probability should not collapse to an
     * extremely low confidence number when evidence is at least
     * moderately supportive.
     *
     * This is deliberately evidence-dependent.
     */
    if (probability >= 0.8 && evidenceScore >= 0.5) {
      result = Math.max(result, 62);
    }

    if (probability >= 0.85 && evidenceScore >= 0.55 && agreement >= 0.55) {
      result = Math.max(result, 68);
    }

    if (probability >= 0.9 && evidenceScore >= 0.6 && agreement >= 0.6) {
      result = Math.max(result, 74);
    }

    if (probability >= 0.95 && evidenceScore >= 0.7 && agreement >= 0.75) {
      result = Math.max(result, 82);
    }

    /*
     * Very weak agreement must still limit confidence.
     */
    if (probability >= 0.8 && agreement < 0.45) {
      result = Math.min(result, 65);
    }

    if (probability >= 0.9 && agreement < 0.6) {
      result = Math.min(result, 72);
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

    return result;
  }

  private calibrationSupport(reliability: number): number {
    /*
     * No calibration history is neutral.
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
        'Confidence is meaningfully supported by the probability and evidence.',
      );
    }

    if (!reasons.length) {
      reasons.push('Confidence is limited by the available evidence.');
    }

    return reasons;
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
