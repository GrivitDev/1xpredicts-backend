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
     * Confidence primarily measures the strength and consistency
     * of the evidence supporting the prediction.
     *
     * Calibration is advisory and intentionally receives a smaller
     * influence than the underlying model/data evidence.
     *
     * When calibration history is unavailable, reliability is 0,
     * but that must not prevent a strong new prediction from
     * receiving an appropriate confidence rating.
     */
    const raw =
      probabilityStrength * 0.1 +
      modelReliability * 0.22 +
      dataQuality * 0.22 +
      calibrationReliability * 0.08 +
      sampleReliability * 0.14 +
      safety * 0.12 +
      agreement * 0.12;

    let confidence = raw * 100;

    /*
     * Evidence caps protect against false high confidence when
     * the underlying evidence is genuinely weak.
     *
     * Calibration is deliberately excluded from these hard caps.
     * Missing historical calibration is not itself evidence that
     * the current prediction is weak.
     */
    confidence = this.applyEvidenceCaps(confidence, {
      modelReliability,
      dataQuality,
      sampleReliability,
      agreement,
      safety,
    });

    /*
     * Existing calibration error can modestly reduce confidence.
     *
     * This only applies when calibration data actually exists.
     * A brand-new prediction with no calibration history therefore
     * receives no artificial confidence penalty.
     */
    const calibrationError = this.clamp(input.calibrationError ?? 0, 0, 1);

    if (sampleSize > 0 && calibrationReliability > 0) {
      confidence *= 1 - Math.min(calibrationError * 0.5, 0.25);
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

    if (
      input.calibrationReliability > 0 &&
      input.calibrationReliability < 0.55
    ) {
      reasons.push('Calibration history is limited or still developing.');
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
