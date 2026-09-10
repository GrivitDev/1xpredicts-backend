import { Injectable } from '@nestjs/common';

import { clampPercentage, roundPercentage } from '../utils/probability.util';

export interface ConfidenceInput {
  probability: number;
  dataQuality: number;
  sourceAgreement: number;
  historicalCalibration: number;
  sampleQuality: number;
}

@Injectable()
export class ConfidenceCalculator {
  /**
   * Calculates confidence as a reliability measure for the
   * predicted probability. Probability itself is NOT included
   * as a direct confidence replacement.
   *
   * All inputs are percentages from 0..100.
   */
  calculate(input: ConfidenceInput): number {
    const dataQuality = clampPercentage(input.dataQuality);
    const sourceAgreement = clampPercentage(input.sourceAgreement);
    const historicalCalibration = clampPercentage(input.historicalCalibration);
    const sampleQuality = clampPercentage(input.sampleQuality);

    const weightedConfidence =
      dataQuality * 0.3 +
      sourceAgreement * 0.25 +
      historicalCalibration * 0.25 +
      sampleQuality * 0.2;

    return roundPercentage(weightedConfidence);
  }

  /**
   * Reduces confidence when the available evidence is sparse.
   */
  applyEvidencePenalty(
    confidence: number,
    evidenceCount: number,
    minimumEvidenceCount = 1,
  ): number {
    if (evidenceCount >= minimumEvidenceCount) {
      return roundPercentage(confidence);
    }

    if (evidenceCount <= 0) {
      return 0;
    }

    const ratio = evidenceCount / minimumEvidenceCount;

    return roundPercentage(clampPercentage(confidence) * ratio);
  }

  /**
   * Calculates source agreement as the inverse of average
   * absolute disagreement.
   *
   * Example:
   * 70, 72, 71 -> high agreement
   * 70, 45, 82 -> low agreement
   */
  calculateSourceAgreement(probabilities: number[]): number {
    const values = probabilities
      .filter((value) => Number.isFinite(value))
      .map((value) => clampPercentage(value));

    if (values.length <= 1) {
      return values.length === 1 ? 70 : 0;
    }

    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;

    const averageDeviation =
      values.reduce((sum, value) => sum + Math.abs(value - mean), 0) /
      values.length;

    return roundPercentage(
      Math.max(0, Math.min(100, 100 - averageDeviation * 2)),
    );
  }
}
