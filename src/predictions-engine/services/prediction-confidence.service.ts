import { Injectable } from '@nestjs/common';

import { ConfidenceCalculator } from '../calculators/confidence.calculator';

@Injectable()
export class PredictionConfidenceService {
  constructor(private readonly confidenceCalculator: ConfidenceCalculator) {}

  calculate(
    probability: number,
    dataQuality: number,
    sourceAgreement: number,
    historicalCalibration: number,
    sampleQuality: number,
  ): number {
    return this.confidenceCalculator.calculate({
      probability,
      dataQuality,
      sourceAgreement,
      historicalCalibration,
      sampleQuality,
    });
  }

  calculateFromSources(probabilities: number[]): number {
    return this.confidenceCalculator.calculateSourceAgreement(probabilities);
  }

  applySelectionCountAdjustment(
    confidence: number,
    selectionCount: number,
  ): number {
    if (selectionCount <= 1) {
      return Number(Math.min(100, confidence).toFixed(2));
    }

    /**
     * Additional selections increase uncertainty.
     * The penaltyKick is deliberately modest because the
     * underlying joint probability is calculated separately.
     */
    const penaltyKick = Math.min(20, (selectionCount - 1) * 2);

    return Number(Math.max(0, confidence - penaltyKick).toFixed(2));
  }
}
