import { Injectable } from '@nestjs/common';

import { CalibrationAdjustment } from '../../interfaces/calibration-adjustment.interface';
import { MarketModelInput } from '../../interfaces/market-model-input.interface';
import { ProbabilityModelResult } from '../../interfaces/probability-result.interface';

import { MarketModelRegistry } from './market-model.registry';
import { RawModelAgreementUtil } from './raw-model-agreement.util';

@Injectable()
export class ProbabilityEngine {
  constructor(private readonly marketModelRegistry: MarketModelRegistry) {}

  calculate(input: MarketModelInput): ProbabilityModelResult {
    const model = this.marketModelRegistry.getModel(input.market);

    if (!model) {
      return {
        market: input.market,
        selection: input.selection,
        probability: 0,
        supportingProbability: 0,
        modelSignals: {},
        sampleSize: 0,
        dataQuality: 0,
        modelReliability: 0,
        modelName: 'unsupported',
        modelVersion: 'unsupported',
      };
    }

    const result = model.calculate(input);

    const probability = this.clamp(result.probability, 0, 1);

    const agreement = RawModelAgreementUtil.calculate(
      input.features,
      probability,
    );

    const calibrationAdjustment = this.getCalibrationAdjustment(
      input.calibrationAdjustment,
    );

    const calibratedProbability = this.applyCalibrationAdjustment(
      probability,
      calibrationAdjustment,
    );

    return {
      ...result,

      probability: calibratedProbability,

      supportingProbability: probability,

      modelAgreement: agreement.agreement,

      modelSignals: agreement.modelOutputs,

      modelOutputs: {
        ...(result.modelOutputs ?? {}),
        rawProbability: probability,
        calibratedProbability,
        calibrationAdjustment,
        ...agreement.modelOutputs,
      },
    };
  }

  private getCalibrationAdjustment(
    adjustment: CalibrationAdjustment | number | undefined,
  ): number {
    if (typeof adjustment === 'number' && Number.isFinite(adjustment)) {
      return this.clamp(adjustment, -0.1, 0.1);
    }

    if (adjustment && typeof adjustment === 'object') {
      const value = adjustment.adjustment;

      if (typeof value === 'number' && Number.isFinite(value)) {
        return this.clamp(value, -0.1, 0.1);
      }
    }

    return 0;
  }

  private applyCalibrationAdjustment(
    probability: number,
    adjustment: number,
  ): number {
    if (adjustment === 0) {
      return probability;
    }

    const adjusted = probability + adjustment;

    return this.clamp(adjusted, 0.01, 0.99);
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
