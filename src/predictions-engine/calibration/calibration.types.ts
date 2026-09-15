export interface CalibrationAssessmentInput {
  averageConfidence: number;
  sampleSize: number;
  actualSuccessRate: number;
  averageProbability: number;
  calibrationError: number;
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
