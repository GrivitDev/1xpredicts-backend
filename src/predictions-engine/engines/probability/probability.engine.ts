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
     * RawGoalModelUtil is the common probability foundation.
     *
     * It consumes the available:
     *   - overall historical fixtures
     *   - recent form
     *   - home/away venue data
     *   - competition statistics
     *   - performance profile
     *   - standings
     *   - H2H
     *   - TeamComparisonService evidence
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
     * The market-specific model independently challenges the
     * common sports-data probability.
     */
    const model = this.marketModelRegistry.getModel(input.market);

    if (!model) {
      const comparisonConfidence = this.getComparisonConfidence(input);
      const dataQuality = this.getDataQuality(input);

      const modelReliability = this.clamp(
        comparisonConfidence * 0.6 + dataQuality * 0.4,
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
     * 1. Common score-matrix probability.
     * 2. Registered market-model probability.
     * 3. Direct team-comparison probability.
     *
     * Agreement measures convergence between these evidence
     * paths. Low probability is not rejected merely for being
     * low; disagreement is what reduces agreement.
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
     * EVIDENCE RECONCILIATION
     * ----------------------------------------------------------
     *
     * The common sports-data model remains the structural base.
     * Independent registered-model and comparison evidence can
     * move the raw probability toward consensus.
     */
    const consensusProbability = this.calculateConsensusProbability(
      matrixModel,
      registeredModel,
      comparisonModel,
      modelAgreement,
      input,
    );

    /*
     * ----------------------------------------------------------
     * SECOND RECONCILIATION PASS
     * ----------------------------------------------------------
     *
     * Prevents one model from overpowering the complete evidence
     * set when the independent evidence paths diverge.
     */
    const recalculatedProbability = this.recalculateProbability(
      consensusProbability,
      matrixModel,
      registeredModel,
      comparisonModel,
      modelAgreement,
      input,
    );

    /*
     * ----------------------------------------------------------
     * CALIBRATION
     * ----------------------------------------------------------
     *
     * Calibration is applied only after the raw sports-data
     * evidence has been reconciled.
     */
    const calibrationAdjustment = this.getCalibrationAdjustment(
      input.calibrationAdjustment,
    );

    const calibratedProbability = this.applyCalibrationAdjustment(
      recalculatedProbability,
      calibrationAdjustment,
    );

    const comparisonConfidence = this.getComparisonConfidence(input);

    const dataQuality = this.getDataQuality(input);

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
    input: MarketModelInput,
  ): number {
    const matrix = this.clamp(matrixProbability);

    const registered = this.clamp(registeredProbability);

    const comparison = this.clamp(comparisonProbability);

    const comparisonConfidence = this.getComparisonConfidence(input);

    const dataQuality = this.getDataQuality(input);

    /*
     * Common score matrix remains the largest structural component.
     *
     * Registered market model and direct comparison evidence can
     * increase their influence when the corresponding evidence is
     * coherent and available.
     */
    const matrixWeight = 0.5;

    const registeredWeight = 0.2 + agreement * 0.1;

    const comparisonWeight = 0.2 + comparisonConfidence * 0.1;

    const qualityAdjustment = 0.75 + dataQuality * 0.25;

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
    input: MarketModelInput,
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
     * Very close evidence does not require another adjustment.
     */
    if (disagreement <= 0.02) {
      return current;
    }

    const comparisonConfidence = this.getComparisonConfidence(input);

    /*
     * Strong evidence agreement retains more of the consensus.
     * Weak agreement moves the result back toward the common
     * sports-data model.
     */
    const reconciliationWeight = this.clamp(
      0.15 + agreement * 0.35 + comparisonConfidence * 0.15,
      0.15,
      0.65,
    );

    const evidenceCenter = matrix * 0.5 + registered * 0.2 + comparison * 0.3;

    return this.clamp(
      current + (evidenceCenter - current) * reconciliationWeight,
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

    /*
     * TeamComparisonService stores confidence on a 0-1 scale.
     */
    return this.clamp(confidence);
  }

  private getDataQuality(input: MarketModelInput): number {
    const quality = input.features.overallDataQuality;

    if (typeof quality !== 'number' || !Number.isFinite(quality)) {
      return 0;
    }

    /*
     * overallDataQuality is represented as a percentage.
     */
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
