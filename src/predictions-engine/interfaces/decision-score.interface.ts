export interface DecisionScore {
  total: number;
  probability: number;
  confidence: number;
  safety: number;
  modelAgreement: number;
  dataQuality: number;
  calibration: number;
}
