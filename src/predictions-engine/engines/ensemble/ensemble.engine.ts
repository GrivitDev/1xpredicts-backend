import { Injectable } from '@nestjs/common';

import { EnsembleInput } from '../../interfaces/ensemble-input.interface';
import { EnsembleResult } from '../../interfaces/ensemble-result.interface';

import { ConfidenceEngine } from './confidence.engine';

import { ConfidenceUtil } from '../../utils/confidence.util';
import { PredictionMathUtil } from '../../utils/prediction-math.util';

@Injectable()
export class EnsembleEngine {
  constructor(private readonly confidenceEngine: ConfidenceEngine) {}

  calculate(input: EnsembleInput): EnsembleResult {
    const confidence = this.confidenceEngine.calculate(input);

    const probability = PredictionMathUtil.clamp(
      input.probability.probability,
      0,
      1,
    );

    const modelAgreement = PredictionMathUtil.clamp(
      input.probability.modelAgreement ?? 0,
      0,
      1,
    );

    const safetyScore = PredictionMathUtil.clamp(
      input.safety.safetyScore ?? 0,
      0,
      100,
    );

    const dataQuality = PredictionMathUtil.clamp(
      input.probability.dataQuality ?? 0,
      0,
      100,
    );

    const calibrationReliability = PredictionMathUtil.clamp(
      input.calibrationReliability ?? 0,
      0,
      100,
    );

    const baseConfidence = ConfidenceUtil.clamp(confidence.confidence);

    /*
     * ----------------------------------------------------------
     * PROBABILITY / CONFIDENCE ALIGNMENT
     * ----------------------------------------------------------
     *
     * A high probability must have enough supporting evidence.
     *
     * This prevents outputs such as:
     *
     *   probability = 92%
     *   confidence  = 48
     *
     * from being treated as a strong prediction.
     */
    const supportFactor = this.calculateSupportFactor({
      probability,
      modelAgreement,
      safetyScore,
      dataQuality,
      calibrationReliability,
    });

    const alignedConfidence = this.calculateAlignedConfidence(
      baseConfidence,
      probability,
      supportFactor,
    );

    return {
      market: input.probability.market,

      selection: input.probability.selection,

      probability: PredictionMathUtil.round(probability, 6),

      confidence: ConfidenceUtil.clamp(alignedConfidence),

      modelAgreement: PredictionMathUtil.round(modelAgreement, 4),

      dataQuality,

      calibrationReliability,

      probabilityResult: input.probability,

      safetyResult: input.safety,
    };
  }

  private calculateSupportFactor(input: {
    probability: number;
    modelAgreement: number;
    safetyScore: number;
    dataQuality: number;
    calibrationReliability: number;
  }): number {
    /*
     * Calibration is intentionally given the smallest weight.
     * New markets must still be usable before sufficient historical
     * calibration data exists.
     */
    const factor =
      input.modelAgreement * 0.35 +
      (input.safetyScore / 100) * 0.25 +
      (input.dataQuality / 100) * 0.25 +
      this.calibrationSupport(input.calibrationReliability) * 0.15;

    return PredictionMathUtil.clamp(factor, 0, 1);
  }

  private calibrationSupport(reliability: number): number {
    /*
     * No calibration history should be neutral rather than
     * severely penalizing a new market.
     */
    if (reliability <= 0) {
      return 0.7;
    }

    return PredictionMathUtil.clamp(reliability / 100, 0, 1);
  }

  private calculateAlignedConfidence(
    baseConfidence: number,
    probability: number,
    supportFactor: number,
  ): number {
    /*
     * A prediction around 50-65% does not need extreme evidence
     * alignment because it is naturally less aggressive.
     *
     * As probability becomes more extreme, stronger support is
     * required.
     */
    const requiredSupport = this.calculateRequiredSupport(probability);

    if (supportFactor >= requiredSupport) {
      return baseConfidence;
    }

    /*
     * Unsupported probability is compressed toward a more honest
     * confidence level.
     */
    const supportRatio =
      requiredSupport > 0 ? supportFactor / requiredSupport : 1;

    const adjustedConfidence = baseConfidence * (0.55 + supportRatio * 0.45);

    return ConfidenceUtil.clamp(adjustedConfidence);
  }

  private calculateRequiredSupport(probability: number): number {
    if (probability < 0.65) {
      return 0.45;
    }

    if (probability < 0.7) {
      return 0.5;
    }

    if (probability < 0.75) {
      return 0.58;
    }

    if (probability < 0.8) {
      return 0.65;
    }

    if (probability < 0.85) {
      return 0.72;
    }

    if (probability < 0.9) {
      return 0.8;
    }

    if (probability < 0.95) {
      return 0.87;
    }

    return 0.92;
  }
}
