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
     * CONFIDENCE
     * ----------------------------------------------------------
     *
     * Confidence is already calculated from probability and
     * evidence by ConfidenceEngine.
     *
     * Do not perform another probability-based penalty here.
     *
     * This allows:
     *
     *   low probability + strong evidence
     *
     * to retain an honest confidence level.
     */
    const alignedConfidence = this.calculateEvidenceAlignedConfidence(
      baseConfidence,
      modelAgreement,
      safetyScore,
      dataQuality,
      calibrationReliability,
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

  private calculateEvidenceAlignedConfidence(
    confidence: number,
    modelAgreement: number,
    safetyScore: number,
    dataQuality: number,
    calibrationReliability: number,
  ): number {
    const support =
      modelAgreement * 0.45 +
      (safetyScore / 100) * 0.2 +
      (dataQuality / 100) * 0.25 +
      this.calibrationSupport(calibrationReliability) * 0.1;

    /*
     * No additional probability gate.
     *
     * Confidence is only modestly adjusted when the supporting
     * evidence itself is weak.
     */
    if (support >= 0.65) {
      return confidence;
    }

    const supportRatio = PredictionMathUtil.clamp(support / 0.65, 0, 1);

    return confidence * (0.7 + supportRatio * 0.3);
  }

  private calibrationSupport(reliability: number): number {
    if (reliability <= 0) {
      return 0.5;
    }

    return PredictionMathUtil.clamp(reliability / 100, 0, 1);
  }
}
