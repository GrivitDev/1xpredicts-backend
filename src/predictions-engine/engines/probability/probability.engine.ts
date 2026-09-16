// src/predictions-engine/engines/probability/probability.engine.ts

import { Injectable } from '@nestjs/common';

import { CalibrationAdjustment } from '../../interfaces/calibration-adjustment.interface';
import { MarketModelInput } from '../../interfaces/market-model-input.interface';
import { ProbabilityModelResult } from '../../interfaces/probability-result.interface';

import { MarketModelRegistry } from './market-model.registry';
import { MarketProbabilityUtil } from './market-probability.util';
import { RawGoalModelUtil } from './raw-goal-model.util';
import { RawModelAgreementUtil } from './raw-model-agreement.util';

@Injectable()
export class ProbabilityEngine {
  constructor(private readonly marketModelRegistry: MarketModelRegistry) {}

  calculate(input: MarketModelInput): ProbabilityModelResult {
    /*
     * ----------------------------------------------------------
     * COMMON SPORTS-DATA MODEL
     * ----------------------------------------------------------
     *
     * This is the structural probability foundation.
     *
     * No historical age cutoff is introduced here.
     */
    const goalModel = RawGoalModelUtil.calculate(input.features);

    const commonMarketProbability = MarketProbabilityUtil.calculate(
      goalModel,
      input.market,
      input.selection,
    );

    const commonProbability = this.clamp(commonMarketProbability.probability);

    /*
     * ----------------------------------------------------------
     * REGISTERED MARKET MODEL
     * ----------------------------------------------------------
     *
     * The registered market model independently challenges the
     * common sports-data probability.
     */
    const model = this.marketModelRegistry.getModel(input.market);

    /*
     * ----------------------------------------------------------
     * NO REGISTERED MODEL
     * ----------------------------------------------------------
     *
     * The common score-matrix probability remains usable.
     *
     * Do not manufacture artificial agreement from a missing
     * market model.
     */
    if (!model) {
      const comparisonConfidence = this.getComparisonConfidence(input);

      const dataQuality = this.getDataQuality(input);

      const modelReliability = this.calculateFallbackModelReliability(
        comparisonConfidence,
        dataQuality,
        commonMarketProbability.scoreMatrixCoherent,
      );

      return {
        market: input.market,

        selection: input.selection,

        probability: commonProbability,

        supportingProbability: commonProbability,

        modelAgreement: commonMarketProbability.scoreMatrixCoherent ? 1 : 0,

        sampleSize: input.features.overallSampleSize,

        dataQuality: input.features.overallDataQuality,

        modelReliability,

        modelName: 'common-score-matrix',

        modelVersion: 'common-score-matrix-v2',

        modelSignals: {
          commonScoreMatrix: commonProbability,

          scoreMatrixCoherent: commonMarketProbability.scoreMatrixCoherent
            ? 1
            : 0,

          comparisonConfidence,

          directionalDifference:
            input.features.comparison?.directionalDifference ?? 0,

          goalProductionDifference:
            input.features.comparison?.goalProduction?.difference ?? 0,

          goalPreventionDifference:
            input.features.comparison?.goalPrevention?.difference ?? 0,
        },

        modelOutputs: {
          commonScoreMatrix: commonProbability,

          homeWin: goalModel.homeWin,

          draw: goalModel.draw,

          awayWin: goalModel.awayWin,

          expectedHomeGoals: goalModel.expectedHomeGoals,

          expectedAwayGoals: goalModel.expectedAwayGoals,

          expectedTotalGoals: goalModel.expectedTotalGoals,
        },
      };
    }

    const registeredResult = model.calculate(input);

    const registeredProbability = this.clamp(registeredResult.probability);

    /*
     * ----------------------------------------------------------
     * THREE-WAY EVIDENCE COMPARISON
     * ----------------------------------------------------------
     *
     * 1. Common score matrix
     * 2. Registered market model
     * 3. Team-comparison probability
     *
     * Agreement measures convergence.
     *
     * Importantly, the probability itself is never raised merely
     * because a market has high safety characteristics.
     */
    const agreement = RawModelAgreementUtil.calculate(
      input.features,
      input.market,
      input.selection,
      commonProbability,
      registeredProbability,
    );

    const modelAgreement = this.clamp(agreement.agreement);

    const matrixModel = this.clamp(
      agreement.modelOutputs.matrixModel ?? commonProbability,
    );

    const comparisonModel = this.clamp(
      agreement.modelOutputs.comparisonModel ?? commonProbability,
    );

    const registeredModel = this.clamp(
      agreement.modelOutputs.registeredModel ?? registeredProbability,
    );

    /*
     * ----------------------------------------------------------
     * EVIDENCE AVAILABILITY
     * ----------------------------------------------------------
     *
     * Comparison confidence is kept separate from the actual
     * comparison probability.
     *
     * Missing comparison evidence must not manufacture an
     * apparent directional signal.
     */
    const comparisonConfidence = this.getComparisonConfidence(input);

    const dataQuality = this.getDataQuality(input);

    /*
     * ----------------------------------------------------------
     * FIRST RECONCILIATION
     * ----------------------------------------------------------
     *
     * The common score matrix remains the structural anchor.
     *
     * Independent evidence gets additional influence only to the
     * extent that it is actually available and coherent.
     */
    const consensusProbability = this.calculateConsensusProbability(
      matrixModel,
      registeredModel,
      comparisonModel,
      modelAgreement,
      comparisonConfidence,
      dataQuality,
    );

    /*
     * ----------------------------------------------------------
     * SECOND RECONCILIATION
     * ----------------------------------------------------------
     *
     * This is a bounded reconciliation step.
     *
     * It cannot create probability merely because the market is
     * broad or easy to satisfy.
     */
    const recalculatedProbability = this.recalculateProbability(
      consensusProbability,
      matrixModel,
      registeredModel,
      comparisonModel,
      modelAgreement,
      comparisonConfidence,
    );

    /*
     * ----------------------------------------------------------
     * CALIBRATION
     * ----------------------------------------------------------
     */
    const calibrationAdjustment = this.getCalibrationAdjustment(
      input.calibrationAdjustment,
    );

    const calibratedProbability = this.applyCalibrationAdjustment(
      recalculatedProbability,
      calibrationAdjustment,
    );

    /*
     * ----------------------------------------------------------
     * MODEL RELIABILITY
     * ----------------------------------------------------------
     */
    const modelReliability = this.calculateModelReliability(
      modelAgreement,
      comparisonConfidence,
      dataQuality,
      registeredResult.modelReliability,
    );

    return {
      ...registeredResult,

      probability: calibratedProbability,

      supportingProbability: recalculatedProbability,

      modelAgreement,

      sampleSize: input.features.overallSampleSize,

      dataQuality: input.features.overallDataQuality,

      modelReliability,

      modelSignals: {
        ...(registeredResult.modelSignals ?? {}),

        ...agreement.modelOutputs,

        scoreMatrixCoherent: commonMarketProbability.scoreMatrixCoherent
          ? 1
          : 0,

        comparisonConfidence,

        directionalDifference:
          input.features.comparison?.directionalDifference ?? 0,

        goalProductionDifference:
          input.features.comparison?.goalProduction?.difference ?? 0,

        goalPreventionDifference:
          input.features.comparison?.goalPrevention?.difference ?? 0,

        consensusProbability,

        recalculatedProbability,

        calibratedProbability,
      },

      modelOutputs: {
        ...(registeredResult.modelOutputs ?? {}),

        commonScoreMatrix: commonProbability,

        registeredMarketModel: registeredProbability,

        comparisonModel,

        homeWin: goalModel.homeWin,

        draw: goalModel.draw,

        awayWin: goalModel.awayWin,

        expectedHomeGoals: goalModel.expectedHomeGoals,

        expectedAwayGoals: goalModel.expectedAwayGoals,

        expectedTotalGoals: goalModel.expectedTotalGoals,

        rawCommonProbability: commonProbability,

        consensusProbability,

        recalculatedProbability,

        calibratedProbability,

        calibrationAdjustment,

        registeredModelDifference: Math.abs(
          registeredProbability - commonProbability,
        ),

        comparisonModelDifference: Math.abs(
          comparisonModel - commonProbability,
        ),

        coherenceAdjustment: recalculatedProbability - commonProbability,
      },
    };
  }

  private calculateConsensusProbability(
    matrixProbability: number,
    registeredProbability: number,
    comparisonProbability: number,
    agreement: number,
    comparisonConfidence: number,
    dataQuality: number,
  ): number {
    const matrix = this.clamp(matrixProbability);

    const registered = this.clamp(registeredProbability);

    const comparison = this.clamp(comparisonProbability);

    const cleanAgreement = this.clamp(agreement);

    const cleanComparisonConfidence = this.clamp(comparisonConfidence);

    const cleanDataQuality = this.clamp(dataQuality);

    /*
     * ----------------------------------------------------------
     * EVIDENCE WEIGHTS
     * ----------------------------------------------------------
     *
     * The common model is the structural base.
     *
     * The registered model gains influence from actual model
     * agreement.
     *
     * The comparison path gains influence from actual comparison
     * confidence.
     *
     * Data quality scales external evidence rather than inventing
     * new probability.
     */
    const matrixWeight = 0.5;

    const registeredWeight = 0.2 + cleanAgreement * 0.1;

    const comparisonWeight =
      cleanComparisonConfidence > 0 ? 0.2 + cleanComparisonConfidence * 0.1 : 0;

    const qualityAdjustment = 0.75 + cleanDataQuality * 0.25;

    const effectiveRegisteredWeight = registeredWeight * qualityAdjustment;

    const effectiveComparisonWeight = comparisonWeight * qualityAdjustment;

    const totalWeight =
      matrixWeight + effectiveRegisteredWeight + effectiveComparisonWeight;

    if (totalWeight <= 0) {
      return matrix;
    }

    return this.clamp(
      (matrix * matrixWeight +
        registered * effectiveRegisteredWeight +
        comparison * effectiveComparisonWeight) /
        totalWeight,
    );
  }

  private recalculateProbability(
    probability: number,
    matrixProbability: number,
    registeredProbability: number,
    comparisonProbability: number,
    agreement: number,
    comparisonConfidence: number,
  ): number {
    const current = this.clamp(probability);

    const matrix = this.clamp(matrixProbability);

    const registered = this.clamp(registeredProbability);

    const comparison = this.clamp(comparisonProbability);

    const disagreement =
      (Math.abs(current - matrix) +
        Math.abs(current - registered) +
        Math.abs(current - comparison)) /
      3;

    /*
     * Close evidence does not need another reconciliation pass.
     */
    if (disagreement <= 0.02) {
      return current;
    }

    const cleanAgreement = this.clamp(agreement);

    const cleanComparisonConfidence = this.clamp(comparisonConfidence);

    /*
     * Strong agreement allows greater movement toward the
     * reconciled evidence center.
     *
     * Weak agreement keeps the original consensus more stable.
     */
    const reconciliationWeight = this.clamp(
      0.15 + cleanAgreement * 0.25 + cleanComparisonConfidence * 0.1,
      0.15,
      0.5,
    );

    /*
     * The common matrix remains the largest reference point,
     * but independent evidence remains present.
     */
    const evidenceCenter = matrix * 0.5 + registered * 0.2 + comparison * 0.3;

    return this.clamp(
      current + (evidenceCenter - current) * reconciliationWeight,
    );
  }

  private calculateFallbackModelReliability(
    comparisonConfidence: number,
    dataQuality: number,
    scoreMatrixCoherent: boolean,
  ): number {
    const matrixReliability = scoreMatrixCoherent ? 1 : 0.35;

    /*
     * Missing registered models should reduce reliability,
     * rather than being interpreted as strong model agreement.
     */
    return this.clamp(
      matrixReliability * 0.45 +
        comparisonConfidence * 0.3 +
        dataQuality * 0.25,
    );
  }

  private calculateModelReliability(
    modelAgreement: number,
    comparisonConfidence: number,
    dataQuality: number,
    registeredReliability?: number,
  ): number {
    const marketModelReliability =
      typeof registeredReliability === 'number' &&
      Number.isFinite(registeredReliability)
        ? this.clamp(registeredReliability)
        : 0;

    return this.clamp(
      modelAgreement * 0.35 +
        comparisonConfidence * 0.35 +
        dataQuality * 0.2 +
        marketModelReliability * 0.1,
    );
  }

  private getComparisonConfidence(input: MarketModelInput): number {
    const confidence = input.features.comparison?.confidence;

    if (typeof confidence !== 'number' || !Number.isFinite(confidence)) {
      return 0;
    }

    return this.clamp(confidence);
  }

  private getDataQuality(input: MarketModelInput): number {
    const quality = input.features.overallDataQuality;

    if (typeof quality !== 'number' || !Number.isFinite(quality)) {
      return 0;
    }

    return this.clamp(quality / 100);
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
      return this.clamp(probability);
    }

    return this.clamp(probability + adjustment, 0.001, 0.999);
  }

  private clamp(value: number, minimum = 0, maximum = 1): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
