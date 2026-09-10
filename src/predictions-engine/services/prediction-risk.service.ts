import { Injectable } from '@nestjs/common';

import { PredictionRisk } from '../enums/prediction-risk.enum';

import { RiskCalculator } from '../calculators/risk.calculator';

@Injectable()
export class PredictionRiskService {
  constructor(private readonly riskCalculator: RiskCalculator) {}

  classify(
    probability: number,
    confidence: number,
    sourceAgreement: number,
    dataQuality: number,
    calibration: number,
  ): PredictionRisk {
    return this.riskCalculator.classify({
      probability,
      confidence,
      sourceAgreement,
      dataQuality,
      calibration,
    });
  }

  isPublishable(
    probability: number,
    confidence: number,
    dataQuality: number,
  ): boolean {
    return this.riskCalculator.isPublishable({
      probability,
      confidence,
      sourceAgreement: 0,
      dataQuality,
      calibration: 0,
    });
  }
}
