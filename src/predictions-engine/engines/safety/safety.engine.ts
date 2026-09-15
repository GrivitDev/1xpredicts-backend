import { Injectable } from '@nestjs/common';

import { PredictionMarket } from '../../enums/prediction-market.enum';
import { PredictionRisk } from '../../enums/prediction-risk.enum';

import { SafetyResult } from '../../interfaces/safety-result.interface';

import { CalibrationRiskUtil } from '../../utils/calibration-risk.util';
import { PredictionRiskUtil } from '../../utils/prediction-risk.util';

@Injectable()
export class SafetyEngine {
  calculate(input: {
    market: PredictionMarket;
    selection: string;

    probability: number;
    modelReliability: number;

    dataQuality: number;
    modelAgreement: number;

    calibrationReliability: number;
    calibrationError?: number;

    sampleSize: number;
  }): SafetyResult {
    const probability = this.clamp(input.probability, 0, 1);

    const modelReliability = this.clamp(input.modelReliability, 0, 1);

    const dataQuality = this.clamp(input.dataQuality, 0, 100) / 100;

    const agreement = this.clamp(input.modelAgreement, 0, 1);

    const calibrationReliability =
      this.clamp(input.calibrationReliability, 0, 100) / 100;

    const sampleSize = Math.max(Math.floor(input.sampleSize ?? 0), 0);

    const sampleReliability = 1 - Math.exp(-sampleSize / 25);

    /*
     * Probability contributes to safety, but it must not dominate
     * the assessment. A high probability that is poorly supported
     * should not automatically receive a high safety score.
     */
    const probabilitySupport = this.calculateProbabilitySupport(probability);

    const probabilityRisk = 1 - probabilitySupport;

    const modelRisk = 1 - modelReliability;

    const dataRisk = 1 - dataQuality;

    const agreementRisk = 1 - agreement;

    const sampleRisk = 1 - sampleReliability;

    /*
     * Calibration is advisory.
     *
     * New markets without sufficient history should not receive
     * artificial calibration penalties.
     */
    const calibrationRisk =
      sampleSize > 0
        ? CalibrationRiskUtil.calculate({
            confidence: 0,
            reliability: calibrationReliability,
            sampleSize,
            calibrationError: input.calibrationError ?? 0,
          })
        : 0;

    /*
     * Market risk now reflects only the remaining market families.
     *
     * It does not decide whether a market is valuable.
     * It only accounts for additional structural complexity.
     */
    const marketRisk = this.calculateMarketRisk(input.market);

    /*
     * Evidence quality is deliberately more important than raw
     * probability. This prevents the engine from treating every
     * 85-95% estimate as inherently safe.
     */
    const riskScore = this.clamp(
      probabilityRisk * 0.16 +
        dataRisk * 0.24 +
        modelRisk * 0.2 +
        agreementRisk * 0.2 +
        sampleRisk * 0.1 +
        calibrationRisk * 0.05 +
        marketRisk * 0.05,
      0,
      1,
    );

    const safetyScore = this.clamp((1 - riskScore) * 100, 0, 100);

    const risk = PredictionRiskUtil.fromScores({
      probability,
      confidence: 0,
      safetyScore,
      modelAgreement: agreement,
      dataQuality: input.dataQuality,
      calibrationReliability: input.calibrationReliability,
    });

    /*
     * Safety does not determine whether a prediction is interesting.
     *
     * It only determines whether the underlying evidence is strong
     * enough to continue through the decision pipeline.
     */
    const isSafe =
      safetyScore >= 55 &&
      agreement >= 0.5 &&
      input.dataQuality >= 50 &&
      sampleReliability >= 0.5;

    const reasons = this.buildReasons({
      probability,
      dataQuality,
      modelReliability,
      agreement,
      calibrationReliability,
      sampleReliability,
      safetyScore,
      risk,
    });

    return {
      market: input.market,
      selection: input.selection,

      safetyScore,

      dataRisk: dataRisk * 100,

      modelRisk: modelRisk * 100,

      marketRisk: marketRisk * 100,

      calibrationRisk: calibrationRisk * 100,

      sampleRisk: sampleRisk * 100,

      risk,

      riskScore: riskScore * 100,

      isSafe,

      reasons,
    };
  }

  private calculateProbabilitySupport(probability: number): number {
    /*
     * The strongest safety contribution comes from probabilities
     * meaningfully above 50%, but returns diminish as probability
     * becomes extremely high.
     *
     * This prevents 90%+ probabilities from receiving almost
     * automatic safety simply because they are numerically high.
     */
    if (probability < 0.5) {
      return 0;
    }

    if (probability < 0.55) {
      return 0.1;
    }

    if (probability < 0.6) {
      return 0.2;
    }

    if (probability < 0.65) {
      return 0.35;
    }

    if (probability < 0.7) {
      return 0.5;
    }

    if (probability < 0.75) {
      return 0.62;
    }

    if (probability < 0.8) {
      return 0.72;
    }

    if (probability < 0.85) {
      return 0.8;
    }

    if (probability < 0.9) {
      return 0.86;
    }

    if (probability < 0.95) {
      return 0.9;
    }

    return 0.92;
  }

  private calculateMarketRisk(market: PredictionMarket): number {
    switch (market) {
      case PredictionMarket.MATCH_RESULT:
      case PredictionMarket.DOUBLE_CHANCE:
      case PredictionMarket.DRAW_NO_BET:
      case PredictionMarket.OVER_UNDER:
      case PredictionMarket.BOTH_TEAMS_TO_SCORE:
      case PredictionMarket.GOAL_RANGE:
      case PredictionMarket.TEAM_TOTAL_GOALS:
        return 0.05;

      case PredictionMarket.HALF_TIME_RESULT:
      case PredictionMarket.SECOND_HALF_RESULT:
      case PredictionMarket.FIRST_HALF_GOALS:
      case PredictionMarket.SECOND_HALF_GOALS:
        return 0.1;

      case PredictionMarket.ASIAN_HANDICAP:
      case PredictionMarket.EUROPEAN_HANDICAP:
        return 0.12;

      default:
        return 0.1;
    }
  }

  private buildReasons(input: {
    probability: number;
    dataQuality: number;
    modelReliability: number;
    agreement: number;
    calibrationReliability: number;
    sampleReliability: number;
    safetyScore: number;
    risk: PredictionRisk;
  }): string[] {
    const reasons: string[] = [];

    if (input.probability < 0.65) {
      reasons.push(
        'Underlying probability is below the stronger prediction range.',
      );
    }

    if (input.dataQuality < 0.6) {
      reasons.push('Data quality is not yet strong enough for high safety.');
    }

    if (input.modelReliability < 0.6) {
      reasons.push('Model reliability is limited by available evidence.');
    }

    if (input.agreement < 0.6) {
      reasons.push('Supporting model signals are not sufficiently aligned.');
    }

    if (input.calibrationReliability < 0.55) {
      reasons.push('Calibration history is limited or unreliable.');
    }

    if (input.sampleReliability < 0.6) {
      reasons.push('Historical sample size is limited.');
    }

    if (input.safetyScore >= 80) {
      reasons.push('Overall evidence supports a strong safety assessment.');
    } else if (input.safetyScore >= 65) {
      reasons.push('Evidence supports a moderate safety assessment.');
    }

    if (input.risk === PredictionRisk.HIGH) {
      reasons.push(
        'Risk remains high after combining probability and evidence quality.',
      );
    }

    return reasons;
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
