import { Injectable } from '@nestjs/common';

import { CalibrationCalculator } from './calibration.calculator';

import { CalibrationAssessment } from './calibration.assessment';

import { CalibrationResult } from '../interfaces/calibration-result.interface';
import { PredictionMarket } from '../enums/prediction-market.enum';

@Injectable()
export class CalibrationEngine {
  constructor(
    private readonly calculator: CalibrationCalculator,
    private readonly assessment: CalibrationAssessment,
  ) {}

  calculate(input: {
    market: PredictionMarket;
    selection: string;
    modelVersion: string;

    sampleSize: number;
    averageProbability: number;
    actualSuccessRate: number;
    averageConfidence: number;
  }): CalibrationResult {
    const calculated = this.calculator.calculate({
      sampleSize: input.sampleSize,
      averageProbability: input.averageProbability,
      actualSuccessRate: input.actualSuccessRate,
    });

    const assessment = this.assessment.assess({
      averageConfidence: input.averageConfidence,
      sampleSize: input.sampleSize,
      actualSuccessRate: input.actualSuccessRate,
      averageProbability: input.averageProbability,
      calibrationError: calculated.calibrationError,
    });

    return {
      market: input.market,
      selection: input.selection,

      modelVersion: input.modelVersion,

      sampleSize: input.sampleSize,

      averageProbability: input.averageProbability,

      actualSuccessRate: input.actualSuccessRate,

      calibrationError: calculated.calibrationError,

      adjustment: calculated.adjustment,

      reliabilityScore: calculated.reliabilityScore,

      confidenceReliability: input.averageConfidence,

      shouldAdjust: assessment.shouldAdjust,
    };
  }
}
