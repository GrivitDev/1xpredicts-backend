// src/prediction/engines/confidence.engine.ts

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

    const probabilityStrength = ConfidenceUtil.probabilityStrength(probability);

    /*
     * ----------------------------------------------------------
     * EVIDENCE SCORE
     * ----------------------------------------------------------
     *
     * Confidence is primarily an evidence measure.
     *
     * Model agreement and primary model reliability carry the
     * strongest influence because the system must first believe
     * its own supporting models before assigning high confidence.
     */
    const evidenceScore =
      modelReliability * 0.24 +
      agreement * 0.24 +
      dataQuality * 0.2 +
      safety * 0.14 +
      sampleReliability * 0.1 +
      this.calibrationSupport(calibrationReliability) * 0.08;

    /*
     * ----------------------------------------------------------
     * PROBABILITY SUPPORT
     * ----------------------------------------------------------
     *
     * High probabilities deserve somewhat higher confidence,
     * but probability is deliberately not the dominant input.
     */
    const probabilitySupport = this.calculateProbabilitySupport(
      probability,
      probabilityStrength,
    );

    let confidence = evidenceScore * 82 + probabilitySupport * 18;

    /*
     * ----------------------------------------------------------
     * AGREEMENT CONTROL
     * ----------------------------------------------------------
     *
     * Model disagreement must materially reduce confidence,
     * especially when probability is aggressive.
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
     * High probability requires meaningful confidence support.
     *
     * A 90% probability should not appear with confidence 40,
     * while a 65% probability should not automatically receive
     * 90+ confidence.
     */
    confidence = this.applyProbabilityCoherence(
      confidence,
      probability,
      agreement,
    );

    /*
     * ----------------------------------------------------------
     * EVIDENCE CAPS
     * ----------------------------------------------------------
     *
     * Weak evidence must always limit confidence.
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
     * CALIBRATION
     * ----------------------------------------------------------
     *
     * Calibration history is advisory.
     *
     * Missing calibration history does not punish confidence.
     * Existing calibration error can reduce confidence modestly.
     */
    const calibrationError = this.clamp(input.calibrationError ?? 0, 0, 1);

    if (sampleSize >= 10 && calibrationReliability > 0) {
      confidence *= 1 - Math.min(calibrationError * 0.35, 0.2);
    }

    confidence = ConfidenceUtil.clamp(confidence);

    const factors: Record<string, number> = {
      probabilityStrength,
      probabilitySupport,
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

  private calculateProbabilitySupport(
    probability: number,
    probabilityStrength: number,
  ): number {
    /*
     * Probability becomes increasingly supportive as it moves
     * above 65%, but the effect is deliberately capped.
     */
    if (probability < 0.55) {
      return 0.15;
    }

    if (probability < 0.6) {
      return 0.28;
    }

    if (probability < 0.65) {
      return 0.42;
    }

    if (probability < 0.7) {
      return 0.55;
    }

    if (probability < 0.75) {
      return 0.68;
    }

    if (probability < 0.8) {
      return 0.78;
    }

    if (probability < 0.85) {
      return 0.86;
    }

    if (probability < 0.9) {
      return 0.92;
    }

    if (probability < 0.95) {
      return 0.96;
    }

    /*
     * Do not let 95%+ probability automatically create
     * exceptional confidence.
     */
    return Math.min(0.98, 0.9 + probabilityStrength * 0.08);
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
      multiplier = 0.94;
    } else if (agreement >= 0.55) {
      multiplier = 0.88;
    } else if (agreement >= 0.45) {
      multiplier = 0.8;
    } else {
      multiplier = 0.7;
    }

    /*
     * Aggressive probabilities need stronger agreement.
     */
    if (probability >= 0.85 && agreement < 0.65) {
      multiplier *= 0.88;
    }

    if (probability >= 0.9 && agreement < 0.75) {
      multiplier *= 0.82;
    }

    return confidence * multiplier;
  }

  private applyProbabilityCoherence(
    confidence: number,
    probability: number,
    agreement: number,
  ): number {
    let result = confidence;

    /*
     * Modest probabilities should not receive extreme confidence.
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
    }

    /*
     * High probabilities require stronger model agreement.
     */
    if (probability >= 0.8 && agreement < 0.6) {
      result = Math.min(result, 72);
    }

    if (probability >= 0.85 && agreement < 0.7) {
      result = Math.min(result, 78);
    }

    if (probability >= 0.9 && agreement < 0.75) {
      result = Math.min(result, 82);
    }

    if (probability >= 0.95 && agreement < 0.85) {
      result = Math.min(result, 86);
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

    if (evidence.modelReliability < 0.35) {
      result = Math.min(result, 52);
    } else if (evidence.modelReliability < 0.5) {
      result = Math.min(result, 62);
    } else if (evidence.modelReliability < 0.6) {
      result = Math.min(result, 70);
    }

    if (evidence.dataQuality < 0.35) {
      result = Math.min(result, 52);
    } else if (evidence.dataQuality < 0.5) {
      result = Math.min(result, 62);
    } else if (evidence.dataQuality < 0.6) {
      result = Math.min(result, 70);
    }

    if (evidence.sampleReliability < 0.3) {
      result = Math.min(result, 55);
    } else if (evidence.sampleReliability < 0.45) {
      result = Math.min(result, 65);
    } else if (evidence.sampleReliability < 0.55) {
      result = Math.min(result, 72);
    }

    if (evidence.agreement < 0.4) {
      result = Math.min(result, 50);
    } else if (evidence.agreement < 0.5) {
      result = Math.min(result, 58);
    } else if (evidence.agreement < 0.6) {
      result = Math.min(result, 68);
    }

    if (evidence.safety < 0.45) {
      result = Math.min(result, 55);
    } else if (evidence.safety < 0.55) {
      result = Math.min(result, 63);
    } else if (evidence.safety < 0.65) {
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
