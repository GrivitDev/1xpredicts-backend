import { PredictionRisk } from '../enums/prediction-risk.enum';

import { PREDICTION_DECISION_CONFIG } from '../config/prediction-decision.config';

export class PredictionRiskUtil {
  static fromScores(input: {
    probability: number;
    confidence: number;
    safetyScore: number;
    modelAgreement: number;
    dataQuality: number;
    calibrationReliability: number;
  }): PredictionRisk {
    const probability = this.clamp(input.probability, 0, 1);

    const confidence = this.clamp(input.confidence, 0, 98);

    const safetyScore = this.clamp(input.safetyScore, 0, 100);

    const agreement = this.clamp(input.modelAgreement, 0, 1);

    const dataQuality = this.clamp(input.dataQuality, 0, 100);

    const calibrationReliability = this.clamp(
      input.calibrationReliability,
      0,
      100,
    );

    const low = PREDICTION_DECISION_CONFIG.risk.low;

    const medium = PREDICTION_DECISION_CONFIG.risk.medium;

    if (
      probability >= low.minimumProbability &&
      confidence >= low.minimumConfidence &&
      safetyScore >= low.minimumSafetyScore &&
      agreement >= low.minimumModelAgreement &&
      dataQuality >= low.minimumDataQuality &&
      calibrationReliability >= low.minimumCalibrationReliability
    ) {
      return PredictionRisk.LOW;
    }

    if (
      probability >= medium.minimumProbability &&
      confidence >= medium.minimumConfidence &&
      safetyScore >= medium.minimumSafetyScore &&
      agreement >= medium.minimumModelAgreement &&
      dataQuality >= medium.minimumDataQuality &&
      calibrationReliability >= medium.minimumCalibrationReliability
    ) {
      return PredictionRisk.MEDIUM;
    }

    return PredictionRisk.HIGH;
  }

  static score(input: {
    probability: number;
    confidence: number;
    safetyScore: number;
    modelAgreement: number;
    dataQuality: number;
    calibrationReliability: number;
  }): number {
    const risk = this.fromScores(input);

    switch (risk) {
      case PredictionRisk.LOW:
        return 0.2;

      case PredictionRisk.MEDIUM:
        return 0.5;

      case PredictionRisk.HIGH:
      default:
        return 0.85;
    }
  }

  private static clamp(
    value: number,
    minimum: number,
    maximum: number,
  ): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
