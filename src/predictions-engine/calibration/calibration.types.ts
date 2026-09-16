// src/predictions-engine/calibration/calibration.types.ts

export interface CalibrationAssessmentInput {
  averageConfidence: number;

  sampleSize: number;

  actualSuccessRate: number;

  averageProbability: number;

  calibrationError: number;

  /*
   * Aggregate quality of the evidence behind the settled
   * predictions.
   */
  evidenceSupport?: number;

  /*
   * High-confidence predictions are assessed against what their
   * probabilities actually implied should happen.
   */
  highConfidenceSampleSize?: number;

  highConfidenceCalibrationGap?: number;

  /*
   * Same high-confidence assessment, but restricted to predictions
   * whose underlying evidence package was sufficiently supportive.
   */
  evidenceSupportedHighConfidenceSampleSize?: number;

  evidenceSupportedHighConfidenceCalibrationGap?: number;
}

export interface CalibrationBucket {
  minimumConfidence: number;

  maximumConfidence: number;

  sampleSize: number;

  wins: number;

  losses: number;

  winRate: number;

  averageProbability: number;

  calibrationError: number;
}

export interface CalibrationFailureAssessment {
  meaningful: boolean;

  severe: boolean;

  critical: boolean;

  shouldAdjust: boolean;

  reason: string;
}
