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
        modelOutputs: {},
        modelAgreement: 0,
        sampleSize: 0,
        dataQuality: 0,
        modelReliability: 0,
        modelName: 'unsupported',
        modelVersion: 'unsupported',
      };
    }

    /*
     * ----------------------------------------------------------
     * REALITY MODEL
     * ----------------------------------------------------------
     *
     * This is the dedicated market model already registered
     * for the current market.
     */
    const result = model.calculate(input);

    const realityProbability = this.clamp(result.probability, 0, 1);

    /*
     * ----------------------------------------------------------
     * THREE-ANGLE ENSEMBLE
     * ----------------------------------------------------------
     *
     * 1. Safety model
     * 2. Reality model
     * 3. Independent model
     *
     * All three are estimating the SAME market selection.
     */
    const agreement = RawModelAgreementUtil.calculate(
      input.features,
      input.market,
      input.selection,
      realityProbability,
    );

    const safetyProbability = this.clamp(
      agreement.modelOutputs.safetyModel ?? 0.5,
    );

    const independentProbability = this.clamp(
      agreement.modelOutputs.independentModel ?? 0.5,
    );

    /*
     * Reality is the main market model.
     *
     * Safety receives the second-largest weight because the
     * objective is reliable betting decisions rather than
     * maximizing aggressive probability.
     *
     * The independent model supplies the separate challenge
     * to the primary prediction.
     */
    const ensembleProbability = this.clamp(
      realityProbability * 0.45 +
        safetyProbability * 0.3 +
        independentProbability * 0.25,
    );

    /*
     * Calibration remains advisory.
     *
     * It adjusts the ensemble only after all three predictive
     * angles have produced their estimate.
     */
    const calibrationAdjustment = this.getCalibrationAdjustment(
      input.calibrationAdjustment,
    );

    const calibratedProbability = this.applyCalibrationAdjustment(
      ensembleProbability,
      calibrationAdjustment,
    );

    return {
      ...result,

      probability: calibratedProbability,

      supportingProbability: ensembleProbability,

      modelAgreement: agreement.agreement,

      modelSignals: agreement.modelOutputs,

      modelOutputs: {
        ...(result.modelOutputs ?? {}),

        safetyModel: agreement.modelOutputs.safetyModel,

        realityModel: agreement.modelOutputs.realityModel,

        independentModel: agreement.modelOutputs.independentModel,

        ensembleProbability,

        calibratedProbability,

        calibrationAdjustment,
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

  private clamp(value: number, minimum = 0, maximum = 1): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
