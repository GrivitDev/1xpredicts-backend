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
     * COMMON SCORE-DISTRIBUTION MODEL
     * ----------------------------------------------------------
     *
     * This is the authoritative probability foundation.
     *
     * RawGoalModelUtil generates the joint score distribution from
     * the prepared sports evidence.
     */
    const goalModel = RawGoalModelUtil.calculate(input.features);

    const commonMarketProbability = MarketProbabilityUtil.calculate(
      goalModel,
      input.market,
      input.selection,
    );

    const commonProbability = this.clamp(commonMarketProbability.probability);

    /*
     * Settlement probabilities are part of the authoritative
     * market probability result and must remain available for
     * markets such as DRAW_NO_BET and ASIAN_HANDICAP.
     */
    const settlementModelOutputs: Record<string, number> = {};

    if (
      typeof commonMarketProbability.winProbability === 'number' &&
      Number.isFinite(commonMarketProbability.winProbability)
    ) {
      settlementModelOutputs.winProbability = this.clamp(
        commonMarketProbability.winProbability,
      );
    }

    if (
      typeof commonMarketProbability.pushProbability === 'number' &&
      Number.isFinite(commonMarketProbability.pushProbability)
    ) {
      settlementModelOutputs.pushProbability = this.clamp(
        commonMarketProbability.pushProbability,
      );
    }

    if (
      typeof commonMarketProbability.lossProbability === 'number' &&
      Number.isFinite(commonMarketProbability.lossProbability)
    ) {
      settlementModelOutputs.lossProbability = this.clamp(
        commonMarketProbability.lossProbability,
      );
    }

    /*
     * ----------------------------------------------------------
     * MARKET-SPECIFIC CALCULATOR
     * ----------------------------------------------------------
     *
     * The registry provides the market-specific calculator and
     * additional market diagnostics.
     *
     * IMPORTANT:
     *
     * The registered market engine is NOT an independent model.
     *
     * The engines currently registered here all derive their
     * probability from RawGoalModelUtil, so their probability must
     * not be treated as a second statistically independent estimate.
     */
    const marketModel = this.marketModelRegistry.getModel(input.market);

    const comparisonConfidence = this.getComparisonConfidence(input);

    const dataQuality = this.getDataQuality(input);

    /*
     * ----------------------------------------------------------
     * NO MARKET CALCULATOR
     * ----------------------------------------------------------
     *
     * The common market probability is still usable.
     */
    if (!marketModel) {
      const modelReliability = this.calculateFallbackModelReliability(
        comparisonConfidence,
        dataQuality,
        commonMarketProbability.scoreMatrixCoherent,
      );

      const calibrationAdjustment = this.getCalibrationAdjustment(
        input.calibrationAdjustment,
      );

      const calibratedProbability = this.applyCalibrationAdjustment(
        commonProbability,
        calibrationAdjustment,
      );

      return {
        market: input.market,

        selection: input.selection,

        probability: calibratedProbability,

        supportingProbability: commonProbability,

        /*
         * No independent model exists.
         */
        modelAgreement: 0,

        sampleSize: input.features.overallSampleSize,

        dataQuality: input.features.overallDataQuality,

        modelReliability,

        modelName: 'common-score-matrix',

        modelVersion: 'common-score-matrix-v3',

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

          structuralProbabilityConsistency: 1,

          independentModelAvailable: 0,

          consensusProbability: commonProbability,

          recalculatedProbability: commonProbability,

          calibratedProbability,

          ...settlementModelOutputs,
        },

        modelOutputs: {
          commonScoreMatrix: commonProbability,

          homeWin: goalModel.homeWin,

          draw: goalModel.draw,

          awayWin: goalModel.awayWin,

          expectedHomeGoals: goalModel.expectedHomeGoals,

          expectedAwayGoals: goalModel.expectedAwayGoals,

          expectedTotalGoals: goalModel.expectedTotalGoals,

          rawCommonProbability: commonProbability,

          consensusProbability: commonProbability,

          recalculatedProbability: commonProbability,

          calibratedProbability,

          calibrationAdjustment,

          /*
           * Preserve DNB / Asian settlement probabilities.
           */
          ...settlementModelOutputs,
        },
      };
    }

    /*
     * ----------------------------------------------------------
     * MARKET CALCULATOR RESULT
     * ----------------------------------------------------------
     *
     * This result is used for market-specific output and
     * diagnostics.
     *
     * Its probability is expected to represent the same underlying
     * score-distribution probability already calculated above.
     */
    const marketResult = marketModel.calculate(input);

    const marketProbability = this.clamp(marketResult.probability);

    /*
     * ----------------------------------------------------------
     * STRUCTURAL CONSISTENCY
     * ----------------------------------------------------------
     *
     * Because the registered engine and common probability utility
     * currently derive from the same RawGoalModel, their difference
     * measures implementation/structural consistency rather than
     * independent statistical agreement.
     *
     * This signal is diagnostic.
     */
    const structuralProbabilityConsistency = this.clamp(
      1 - Math.abs(commonProbability - marketProbability),
    );

    /*
     * ----------------------------------------------------------
     * MODEL AGREEMENT
     * ----------------------------------------------------------
     *
     * There is no genuinely independent probability model here.
     *
     * Therefore modelAgreement is deliberately NOT calculated as
     * agreement between independent models.
     *
     * It is retained as a compatibility field representing how
     * consistently the registered market calculator reproduces the
     * common structural probability.
     */
    const modelAgreement = structuralProbabilityConsistency;

    /*
     * ----------------------------------------------------------
     * COMPARISON SUPPORT
     * ----------------------------------------------------------
     *
     * RawModelAgreementUtil uses the comparison data only as a
     * directional consistency signal.
     *
     * It does not create a third probability.
     */
    const agreement = RawModelAgreementUtil.calculate(
      input.features,
      input.market,
      input.selection,
      commonProbability,
      marketProbability,
    );

    /*
     * Keep the comparison-derived diagnostic outputs, but never use
     * comparisonModel as a probability input.
     */
    const comparisonModel = this.clamp(
      agreement.modelOutputs.comparisonModel ?? 0.5,
    );

    /*
     * ----------------------------------------------------------
     * AUTHORITATIVE PROBABILITY
     * ----------------------------------------------------------
     *
     * No second probability reconciliation is performed.
     *
     * The common score-distribution probability remains the raw
     * probability anchor.
     *
     * We only fall back to the market calculator probability if the
     * common probability is structurally unavailable.
     */
    const structuralProbability = commonMarketProbability.scoreMatrixCoherent
      ? commonProbability
      : marketProbability;

    /*
     * ----------------------------------------------------------
     * CALIBRATION
     * ----------------------------------------------------------
     */
    const calibrationAdjustment = this.getCalibrationAdjustment(
      input.calibrationAdjustment,
    );

    const calibratedProbability = this.applyCalibrationAdjustment(
      structuralProbability,
      calibrationAdjustment,
    );

    /*
     * ----------------------------------------------------------
     * MODEL RELIABILITY
     * ----------------------------------------------------------
     *
     * Reliability is separate from probability.
     *
     * It considers:
     * - structural consistency
     * - comparison evidence confidence
     * - overall data quality
     * - market-calculator reliability
     */
    const modelReliability = this.calculateModelReliability(
      structuralProbabilityConsistency,
      comparisonConfidence,
      dataQuality,
      marketResult.modelReliability,
    );

    return {
      ...marketResult,

      /*
       * Final probability is calibration applied to the structural
       * market probability.
       */
      probability: calibratedProbability,

      /*
       * Pre-calibration probability.
       */
      supportingProbability: structuralProbability,

      modelAgreement,

      sampleSize: input.features.overallSampleSize,

      dataQuality: input.features.overallDataQuality,

      modelReliability,

      /*
       * Preserve the market engine identity/version.
       */
      modelSignals: {
        ...(marketResult.modelSignals ?? {}),

        ...agreement.modelOutputs,

        commonScoreMatrix: commonProbability,

        registeredMarketProbability: marketProbability,

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

        /*
         * Critical architectural diagnostics.
         */
        independentModelAvailable: 0,

        structuralProbabilityConsistency,

        /*
         * Compatibility fields.
         *
         * There is no second reconciliation pass.
         */
        consensusProbability: structuralProbability,

        recalculatedProbability: structuralProbability,

        calibratedProbability,

        /*
         * Preserve authoritative settlement probabilities for
         * settlement-based markets.
         */
        ...settlementModelOutputs,
      },

      modelOutputs: {
        ...(marketResult.modelOutputs ?? {}),

        commonScoreMatrix: commonProbability,

        registeredMarketModel: marketProbability,

        /*
         * Diagnostic only.
         *
         * This is the comparison-support mapping from
         * RawModelAgreementUtil and is NOT an independent model.
         */
        comparisonModel,

        homeWin: goalModel.homeWin,

        draw: goalModel.draw,

        awayWin: goalModel.awayWin,

        expectedHomeGoals: goalModel.expectedHomeGoals,

        expectedAwayGoals: goalModel.expectedAwayGoals,

        expectedTotalGoals: goalModel.expectedTotalGoals,

        rawCommonProbability: commonProbability,

        structuralProbability,

        /*
         * Compatibility aliases.
         */
        consensusProbability: structuralProbability,

        recalculatedProbability: structuralProbability,

        calibratedProbability,

        calibrationAdjustment,

        registeredModelDifference: Math.abs(
          marketProbability - commonProbability,
        ),

        comparisonModelDifference: Math.abs(
          comparisonModel - commonProbability,
        ),

        coherenceAdjustment: structuralProbability - commonProbability,

        /*
         * Preserve authoritative settlement probabilities for
         * DRAW_NO_BET and ASIAN_HANDICAP.
         */
        ...settlementModelOutputs,
      },
    };
  }

  private calculateFallbackModelReliability(
    comparisonConfidence: number,
    dataQuality: number,
    scoreMatrixCoherent: boolean,
  ): number {
    const matrixReliability = scoreMatrixCoherent ? 1 : 0.35;

    /*
     * No independent market model exists.
     *
     * Reliability therefore comes from the quality of the
     * authoritative structural model and supporting evidence.
     */
    return this.clamp(
      matrixReliability * 0.45 +
        comparisonConfidence * 0.3 +
        dataQuality * 0.25,
    );
  }

  private calculateModelReliability(
    structuralConsistency: number,
    comparisonConfidence: number,
    dataQuality: number,
    marketModelReliability?: number,
  ): number {
    const calculatorReliability =
      typeof marketModelReliability === 'number' &&
      Number.isFinite(marketModelReliability)
        ? this.clamp(marketModelReliability)
        : 0;

    return this.clamp(
      structuralConsistency * 0.35 +
        comparisonConfidence * 0.35 +
        dataQuality * 0.2 +
        calculatorReliability * 0.1,
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
