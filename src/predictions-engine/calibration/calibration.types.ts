export interface CalibrationResult {
  predictionId: string;
  fixtureId: string;
  market: string;
  selection: string;
  probability: number;
  confidence: number;
  wasCorrect: boolean;
}

export interface CalibrationMarketSummary {
  market: string;
  sampleSize: number;
  accuracy: number;
  brierScore: number | null;
  calibrationError: number | null;
}

export interface CalibrationBucket {
  bucket: number;
  sampleSize: number;
  predictedProbability: number;
  actualRate: number;
}
