import { Injectable } from '@nestjs/common';

import { PredictionRisk } from '../enums/prediction-risk.enum';

import { clampPercentage } from '../utils/probability.util';

export interface RiskInput {
  probability: number;
  confidence: number;
  sourceAgreement: number;
  dataQuality: number;
  calibration: number;
}

@Injectable()
export class RiskCalculator {
  /**
   * Initial conservative risk classification.
   *
   * These thresholds are intentionally strict starting points.
   * Later calibration data can refine them using actual settled
   * prediction performance.
   */
  classify(input: RiskInput): PredictionRisk {
    const probability = clampPercentage(input.probability);
    const confidence = clampPercentage(input.confidence);
    const sourceAgreement = clampPercentage(input.sourceAgreement);
    const dataQuality = clampPercentage(input.dataQuality);
    const calibration = clampPercentage(input.calibration);

    if (
      probability >= 70 &&
      confidence >= 80 &&
      sourceAgreement >= 70 &&
      dataQuality >= 70 &&
      calibration >= 70
    ) {
      return PredictionRisk.LOW;
    }

    if (
      probability >= 55 &&
      confidence >= 65 &&
      sourceAgreement >= 55 &&
      dataQuality >= 60 &&
      calibration >= 60
    ) {
      return PredictionRisk.MEDIUM;
    }

    return PredictionRisk.HIGH;
  }

  /**
   * Determines whether a recommendation meets the minimum
   * evidence standard for publication.
   */
  isPublishable(
    input: RiskInput,
    minimumProbability = 50,
    minimumConfidence = 55,
    minimumDataQuality = 50,
  ): boolean {
    return (
      clampPercentage(input.probability) >= minimumProbability &&
      clampPercentage(input.confidence) >= minimumConfidence &&
      clampPercentage(input.dataQuality) >= minimumDataQuality
    );
  }
}
