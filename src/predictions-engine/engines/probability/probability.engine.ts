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
     * PRIMARY MARKET MODEL
     * ----------------------------------------------------------
     *
     * The registered market model is the primary probability
     * source for this market and selection.
     */
    const result = model.calculate(input);

    const realityProbability = this.clamp(result.probability, 0, 1);

    /*
     * ----------------------------------------------------------
     * MODEL AGREEMENT
     * ----------------------------------------------------------
     *
     * The additional models challenge the primary estimate.
     * They should improve reliability without overwhelming the
     * actual market model.
     */
    const agreement = RawModelAgreementUtil.calculate(
      input.features,
      input.market,
      input.selection,
      realityProbability,
    );

    const safetyProbability = this.clamp(
      agreement.modelOutputs.safetyModel ?? 0.5,
      0,
      1,
    );

    const independentProbability = this.clamp(
      agreement.modelOutputs.independentModel ?? 0.5,
      0,
      1,
    );

    const modelAgreement = this.clamp(agreement.agreement ?? 0, 0, 1);

    /*
     * ----------------------------------------------------------
     * PROBABILITY ENSEMBLE
     * ----------------------------------------------------------
     *
     * Primary market model:
     *   60%
     *
     * Independent model:
     *   25%
     *
     * Safety model:
     *   15%
     *
     * Safety is intentionally not allowed to dominate the
     * probability estimate. Its stronger role comes later through
     * the safety/decision layers.
     */
    const rawEnsembleProbability = this.clamp(
      realityProbability * 0.6 +
        independentProbability * 0.25 +
        safetyProbability * 0.15,
      0,
      1,
    );

    /*
     * ----------------------------------------------------------
     * AGREEMENT CONTROL
     * ----------------------------------------------------------
     *
     * A high probability should require reasonable agreement.
     *
     * Weak agreement does not automatically reject the market.
     * Instead, it reduces extreme probabilities so that a single
     * model cannot manufacture an unrealistic 90%+ estimate.
     */
    const agreementDamping = this.getAgreementDamping(
      modelAgreement,
      rawEnsembleProbability,
    );

    const ensembleProbability = this.clamp(
      rawEnsembleProbability +
        (0.5 - rawEnsembleProbability) * agreementDamping,
      0,
      1,
    );

    /*
     * ----------------------------------------------------------
     * CALIBRATION
     * ----------------------------------------------------------
     *
     * Calibration remains advisory and is applied only after the
     * predictive ensemble has been established.
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

      modelAgreement,

      modelSignals: agreement.modelOutputs,

      modelOutputs: {
        ...(result.modelOutputs ?? {}),

        safetyModel: safetyProbability,
        realityModel: realityProbability,
        independentModel: independentProbability,

        rawEnsembleProbability,
        ensembleProbability,
        calibratedProbability,

        calibrationAdjustment,
        agreementDamping,
      },
    };
  }

  private getAgreementDamping(agreement: number, probability: number): number {
    /*
     * Ordinary probabilities do not need aggressive damping.
     * Extreme probabilities require stronger agreement.
     */
    const probabilityDistance = Math.abs(probability - 0.5);

    if (probabilityDistance < 0.15) {
      return 0;
    }

    if (agreement >= 0.8) {
      return 0;
    }

    if (agreement >= 0.7) {
      return 0.025;
    }

    if (agreement >= 0.6) {
      return 0.06;
    }

    if (agreement >= 0.5) {
      return 0.12;
    }

    if (agreement >= 0.4) {
      return 0.2;
    }

    return 0.3;
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
