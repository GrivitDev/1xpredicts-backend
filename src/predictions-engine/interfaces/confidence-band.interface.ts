export interface ConfidenceBand {
  min: number;
  max: number;
  label: 'LOW' | 'MODERATE' | 'MEANINGFUL' | 'STRONG' | 'CRITICAL';
  calibrationAttention: 'HIGH' | 'MEDIUM' | 'VERY_HIGH';
}
