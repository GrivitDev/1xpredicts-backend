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
      this.clamp(input.calibrationReliability, 0, 100) / 100;

    const sampleSize = Math.max(
      Math.floor(input.sampleSize ?? input.probability.sampleSize ?? 0),
      0,
    );

    const sampleReliability = ConfidenceUtil.sampleReliability(sampleSize);

    const agreement = this.clamp(input.probability.modelAgreement ?? 0, 0, 1);

    const safety = this.clamp(input.safety.safetyScore / 100, 0, 1);

    const probabilityStrength = ConfidenceUtil.probabilityStrength(probability);

    /*
     * Confidence is intentionally different from probability.
     *
     * Probability answers:
     * "How likely does the model believe this event is?"
     *
     * Confidence answers:
     * "How strongly does the available evidence support
     * that probability?"
     *
     * Therefore an extreme probability cannot automatically
     * produce extreme confidence.
     */
    const raw =
      probabilityStrength * 0.12 +
      modelReliability * 0.18 +
      dataQuality * 0.18 +
      calibrationReliability * 0.06 +
      sampleReliability * 0.12 +
      safety * 0.16 +
      agreement * 0.18;

    let confidence = raw * 100;

    /*
     * Agreement is particularly important now that the
     * prediction is produced through three different angles.
     *
     * Strong disagreement means the final probability should
     * not be treated as highly trustworthy even when the
     * resulting probability remains high.
     */
    confidence = this.applyAgreementAdjustment(confidence, agreement);

    /*
     * Probability and confidence must remain coherent.
     *
     * Very high confidence with a modest probability is not
     * appropriate. Likewise, a very high probability with
     * weak supporting evidence must not receive high confidence.
     */
    confidence = this.applyProbabilityCoherence(
      confidence,
      probability,
      agreement,
    );

    confidence = this.applyEvidenceCaps(confidence, {
      modelReliability,
      dataQuality,
      sampleReliability,
      agreement,
      safety,
    });

    /*
     * Calibration is advisory.
     *
     * It can reduce confidence modestly when historical
     * calibration data demonstrates error, but absence of
     * calibration history is not itself negative evidence.
     */
    const calibrationError = this.clamp(input.calibrationError ?? 0, 0, 1);

    if (sampleSize > 0 && calibrationReliability > 0) {
      confidence *= 1 - Math.min(calibrationError * 0.45, 0.2);
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

  private applyAgreementAdjustment(
    confidence: number,
    agreement: number,
  ): number {
    /*
     * Agreement >= 0.85:
     * essentially no penalty.
     *
     * Agreement around 0.70:
     * modest reduction.
     *
     * Agreement <= 0.50:
     * significant reduction.
     */
    let multiplier: number;

    if (agreement >= 0.85) {
      multiplier = 1;
    } else if (agreement >= 0.75) {
      multiplier = 0.97;
    } else if (agreement >= 0.65) {
      multiplier = 0.91;
    } else if (agreement >= 0.55) {
      multiplier = 0.82;
    } else {
      multiplier = 0.7;
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
     * A probability below 70% should not normally carry
     * very high confidence.
     */
    if (probability < 0.6) {
      result = Math.min(result, 58);
    } else if (probability < 0.7) {
      result = Math.min(result, 68);
    } else if (probability < 0.8) {
      result = Math.min(result, 78);
    }

    /*
     * Very high probabilities require strong agreement.
     *
     * This prevents:
     *
     * probability = 0.95
     * agreement = 0.45
     * confidence = 90+
     *
     * from slipping through.
     */
    if (probability >= 0.9 && agreement < 0.8) {
      result = Math.min(result, 78);
    }

    if (probability >= 0.95 && agreement < 0.85) {
      result = Math.min(result, 74);
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

    if (evidence.modelReliability < 0.4) {
      result = Math.min(result, 55);
    } else if (evidence.modelReliability < 0.5) {
      result = Math.min(result, 62);
    }

    if (evidence.dataQuality < 0.4) {
      result = Math.min(result, 55);
    } else if (evidence.dataQuality < 0.5) {
      result = Math.min(result, 62);
    }

    if (evidence.sampleReliability < 0.35) {
      result = Math.min(result, 58);
    } else if (evidence.sampleReliability < 0.45) {
      result = Math.min(result, 65);
    }

    if (evidence.agreement < 0.4) {
      result = Math.min(result, 50);
    } else if (evidence.agreement < 0.5) {
      result = Math.min(result, 58);
    } else if (evidence.agreement < 0.6) {
      result = Math.min(result, 65);
    }

    if (evidence.safety < 0.45) {
      result = Math.min(result, 55);
    } else if (evidence.safety < 0.55) {
      result = Math.min(result, 62);
    }

    return result;
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
      reasons.push('Historical sample size is substantial.');
    } else if (input.sampleReliability < 0.45) {
      reasons.push('Historical sample size is limited.');
    }

    if (input.agreement >= 0.85) {
      reasons.push('The three prediction models are strongly aligned.');
    } else if (input.agreement >= 0.7) {
      reasons.push('The three prediction models show good agreement.');
    } else if (input.agreement < 0.6) {
      reasons.push('The three prediction models show meaningful disagreement.');
    }

    if (input.safety >= 0.75) {
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
        'Critical confidence requires continued calibration monitoring.',
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
