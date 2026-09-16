// src/predictions-engine/calibration/calibration.engine.ts

import { Injectable } from '@nestjs/common';

import { CalibrationResult } from '../interfaces/calibration-result.interface';
import { PredictionMarket } from '../enums/prediction-market.enum';

import { CalibrationAssessment } from './calibration.assessment';
import { CalibrationCalculator } from './calibration.calculator';

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

    evidenceSupport?: number;

    highConfidenceSampleSize?: number;

    highConfidenceCalibrationGap?: number;

    evidenceSupportedHighConfidenceSampleSize?: number;

    evidenceSupportedHighConfidenceCalibrationGap?: number;
  }): CalibrationResult {
    const calculated = this.calculator.calculate({
      sampleSize: input.sampleSize,

      averageProbability: input.averageProbability,

      actualSuccessRate: input.actualSuccessRate,

      evidenceSupport: input.evidenceSupport,
    });

    const assessment = this.assessment.assess({
      averageConfidence: input.averageConfidence,

      sampleSize: input.sampleSize,

      actualSuccessRate: input.actualSuccessRate,

      averageProbability: input.averageProbability,

      calibrationError: calculated.calibrationError,

      evidenceSupport: input.evidenceSupport,

      highConfidenceSampleSize: input.highConfidenceSampleSize,

      highConfidenceCalibrationGap: input.highConfidenceCalibrationGap,

      evidenceSupportedHighConfidenceSampleSize:
        input.evidenceSupportedHighConfidenceSampleSize,

      evidenceSupportedHighConfidenceCalibrationGap:
        input.evidenceSupportedHighConfidenceCalibrationGap,
    });

    /*
     * Never expose a calibration adjustment to the prediction
     * layer unless systematic miscalibration has actually been
     * established.
     */
    const adjustment = assessment.shouldAdjust ? calculated.adjustment : 0;

    return {
      market: input.market,

      selection: input.selection,

      modelVersion: input.modelVersion,

      sampleSize: input.sampleSize,

      averageProbability: input.averageProbability,

      actualSuccessRate: input.actualSuccessRate,

      calibrationError: calculated.calibrationError,

      adjustment,

      reliabilityScore: calculated.reliabilityScore,

      confidenceReliability: input.averageConfidence,

      shouldAdjust: assessment.shouldAdjust,
    };
  }
}
