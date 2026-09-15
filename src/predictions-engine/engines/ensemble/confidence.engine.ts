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
     * Confidence measures evidence quality.
     * Probability itself has deliberately limited weight.
     */
    const raw =
      probabilityStrength * 0.08 +
      modelReliability * 0.18 +
      dataQuality * 0.2 +
      calibrationReliability * 0.2 +
      sampleReliability * 0.14 +
      safety * 0.1 +
      agreement * 0.1;

    let confidence = raw * 100;

    /*
     * Hard caps prevent weak supporting evidence from being
     * converted into false high confidence.
     */
    confidence = this.applyEvidenceCaps(confidence, {
      modelReliability,
      dataQuality,
      calibrationReliability,
      sampleReliability,
      agreement,
      safety,
    });

    /*
     * Existing calibration error should directly reduce
     * confidence even when reliability is otherwise good.
     */
    const calibrationError = this.clamp(input.calibrationError ?? 0, 0, 1);

    confidence *= 1 - Math.min(calibrationError * 0.75, 0.35);

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

  private applyEvidenceCaps(
    confidence: number,
    evidence: {
      modelReliability: number;
      dataQuality: number;
      calibrationReliability: number;
      sampleReliability: number;
      agreement: number;
      safety: number;
    },
  ): number {
    let result = confidence;

    if (evidence.modelReliability < 0.5) {
      result = Math.min(result, 62);
    }

    if (evidence.dataQuality < 0.5) {
      result = Math.min(result, 60);
    }

    if (evidence.sampleReliability < 0.45) {
      result = Math.min(result, 65);
    }

    if (evidence.agreement < 0.5) {
      result = Math.min(result, 62);
    }

    if (evidence.safety < 0.55) {
      result = Math.min(result, 60);
    }

    if (evidence.calibrationReliability < 0.5) {
      result = Math.min(result, 72);
    }

    if (evidence.calibrationReliability < 0.7) {
      result = Math.min(result, 84);
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

    if (input.probability >= 0.8) {
      reasons.push('High underlying probability.');
    }

    if (input.modelReliability >= 0.75) {
      reasons.push('Model reliability is strong.');
    }

    if (input.dataQuality >= 0.75) {
      reasons.push('Prediction data quality is strong.');
    }

    if (input.calibrationReliability >= 0.75) {
      reasons.push('Historical calibration reliability is strong.');
    }

    if (input.sampleReliability >= 0.75) {
      reasons.push('Historical sample size is substantial.');
    }

    if (input.agreement >= 0.75) {
      reasons.push('Supporting model signals are reasonably consistent.');
    }

    if (input.safety >= 0.75) {
      reasons.push('Safety assessment is strong.');
    }

    if (!reasons.length) {
      reasons.push('Confidence is limited by the available evidence.');
    }

    if (input.confidence >= 95) {
      reasons.push(
        'Critical confidence requires continued calibration monitoring.',
      );
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
