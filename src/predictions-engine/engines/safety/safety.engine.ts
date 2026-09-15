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

    const sampleReliability = 1 - Math.exp(-Math.max(input.sampleSize, 0) / 25);

    const probabilityRisk = this.clamp(1 - probability, 0, 1);

    const modelRisk = 1 - modelReliability;

    const dataRisk = 1 - dataQuality;

    const agreementRisk = 1 - agreement;

    const sampleRisk = 1 - sampleReliability;

    const calibrationRisk = CalibrationRiskUtil.calculate({
      confidence: 0,
      reliability: calibrationReliability,
      sampleSize: input.sampleSize,
      calibrationError: input.calibrationError ?? 0,
    });

    const marketRisk = this.calculateMarketRisk(input.market);

    const riskScore = this.clamp(
      probabilityRisk * 0.22 +
        dataRisk * 0.18 +
        modelRisk * 0.14 +
        agreementRisk * 0.13 +
        sampleRisk * 0.1 +
        calibrationRisk * 0.18 +
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

    const isSafe =
      safetyScore >= 60 &&
      agreement >= 0.5 &&
      input.dataQuality >= 50 &&
      input.calibrationReliability >= 50 &&
      sampleReliability >= 0.5 &&
      risk !== PredictionRisk.HIGH;

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

  private calculateMarketRisk(market: PredictionMarket): number {
    const normalized = String(market).trim().toUpperCase();

    /*
     * These are not "hardcoded market difficulty" ratings.
     * They only reflect settlement/model complexity.
     */
    if (
      normalized.includes('EXACT') ||
      normalized.includes('HANDICAP') ||
      normalized.includes('HALF_TIME_FULL_TIME')
    ) {
      return 0.15;
    }

    if (normalized.includes('FIRST_TO_SCORE')) {
      return 0.2;
    }

    return 0.05;
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

    if (input.probability < 0.7) {
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
