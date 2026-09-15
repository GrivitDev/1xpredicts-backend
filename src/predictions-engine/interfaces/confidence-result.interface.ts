export interface ConfidenceResult {
  confidence: number;

  modelAgreement: number;

  safetyScore: number;

  dataQuality: number;

  statisticalReliability: number;

  calibrationReliability: number;

  sampleReliability: number;

  factors: Record<string, number>;

  reasons: string[];
}
