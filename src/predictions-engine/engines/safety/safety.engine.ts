// src/predictions-engine/engines/safety/safety.engine.ts

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

    comparisonConfidence?: number;
    directionalDifference?: number;
    goalProductionDifference?: number;
    goalPreventionDifference?: number;
    evidenceCoherence?: number;
  }): SafetyResult {
    const probability = this.clamp(input.probability, 0, 1);

    const modelReliability = this.clamp(input.modelReliability, 0, 1);

    const dataQuality = this.clamp(input.dataQuality, 0, 100) / 100;

    const agreement = this.clamp(input.modelAgreement, 0, 1);

    const calibrationReliability =
      this.clamp(input.calibrationReliability, 0, 100) / 100;

    const comparisonConfidence = this.clamp(
      input.comparisonConfidence ?? 0,
      0,
      1,
    );

    const directionalDifference = this.clamp(
      input.directionalDifference ?? 0,
      -1,
      1,
    );

    const goalProductionDifference = this.clamp(
      input.goalProductionDifference ?? 0,
      -1,
      1,
    );

    const goalPreventionDifference = this.clamp(
      input.goalPreventionDifference ?? 0,
      -1,
      1,
    );

    const explicitCoherence =
      input.evidenceCoherence === undefined
        ? null
        : this.clamp(input.evidenceCoherence, 0, 1);

    const sampleSize = Math.max(Math.floor(input.sampleSize ?? 0), 0);

    const sampleReliability = 1 - Math.exp(-sampleSize / 25);

    /*
     * ----------------------------------------------------------
     * CORE EVIDENCE RISK
     * ----------------------------------------------------------
     *
     * Probability is diagnostic, not a rejection gate.
     *
     * The principal safety dimensions are:
     *   - data quality
     *   - model reliability
     *   - model agreement
     *   - comparison evidence
     *   - historical sample
     *   - calibration
     *
     * No fixed market penalty is applied.
     */
    const probabilitySupport = this.calculateProbabilitySupport(probability);

    const probabilityRisk = 1 - probabilitySupport;

    const modelRisk = 1 - modelReliability;

    const dataRisk = 1 - dataQuality;

    const agreementRisk = 1 - agreement;

    const sampleRisk = 1 - sampleReliability;

    const directionalEvidence = this.calculateDirectionalEvidence(
      directionalDifference,
      comparisonConfidence,
    );

    const goalEvidence = this.calculateGoalEvidence(
      goalProductionDifference,
      goalPreventionDifference,
      comparisonConfidence,
    );

    const comparisonEvidence =
      explicitCoherence !== null
        ? explicitCoherence
        : this.calculateComparisonEvidence(
            agreement,
            comparisonConfidence,
            directionalEvidence,
            goalEvidence,
          );

    const comparisonRisk = 1 - comparisonEvidence;

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
     * Dynamic structural risk replaces the former
     * market-hardcoded risk.
     *
     * It increases only when the actual evidence package is
     * internally weak, rather than because a market has been
     * classified as inherently risky.
     */
    const structuralRisk = this.calculateStructuralRisk({
      probability,
      modelReliability,
      dataQuality,
      agreement,
      comparisonEvidence,
      sampleReliability,
      calibrationReliability,
    });

    const riskScore = this.clamp(
      probabilityRisk * 0.06 +
        dataRisk * 0.2 +
        modelRisk * 0.18 +
        agreementRisk * 0.2 +
        comparisonRisk * 0.21 +
        sampleRisk * 0.1 +
        calibrationRisk * 0.03 +
        structuralRisk * 0.02,
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
     * Safety must not reject a prediction merely because:
     *   - probability is low
     *   - risk is high
     *   - confidence is low
     *
     * Coherence/rejection remains downstream.
     */
    const isSafe =
      dataQuality >= 0.35 &&
      modelReliability >= 0.35 &&
      agreement >= 0.35 &&
      comparisonEvidence >= 0.35 &&
      sampleReliability >= 0.25;

    const reasons = this.buildReasons({
      probability,
      dataQuality,
      modelReliability,
      agreement,
      calibrationReliability,
      sampleReliability,
      comparisonEvidence,
      directionalEvidence,
      goalEvidence,
      safetyScore,
      risk,
    });

    return {
      market: input.market,

      selection: input.selection,

      safetyScore,

      dataRisk: dataRisk * 100,

      modelRisk: modelRisk * 100,

      marketRisk: structuralRisk * 100,

      calibrationRisk: calibrationRisk * 100,

      sampleRisk: sampleRisk * 100,

      risk,

      riskScore: riskScore * 100,

      isSafe,

      reasons,
    };
  }

  private calculateProbabilitySupport(probability: number): number {
    if (probability <= 0.35) {
      return 0.05;
    }

    if (probability < 0.45) {
      return 0.15;
    }

    if (probability < 0.5) {
      return 0.25;
    }

    if (probability < 0.55) {
      return 0.35;
    }

    if (probability < 0.6) {
      return 0.45;
    }

    if (probability < 0.65) {
      return 0.55;
    }

    if (probability < 0.7) {
      return 0.65;
    }

    if (probability < 0.75) {
      return 0.74;
    }

    if (probability < 0.8) {
      return 0.81;
    }

    if (probability < 0.85) {
      return 0.87;
    }

    if (probability < 0.9) {
      return 0.91;
    }

    if (probability < 0.95) {
      return 0.94;
    }

    return 0.96;
  }

  private calculateDirectionalEvidence(
    directionalDifference: number,
    comparisonConfidence: number,
  ): number {
    const directionalStrength = Math.abs(directionalDifference);

    return this.clamp(
      comparisonConfidence * (0.35 + directionalStrength * 0.65),
      0,
      1,
    );
  }

  private calculateGoalEvidence(
    goalProductionDifference: number,
    goalPreventionDifference: number,
    comparisonConfidence: number,
  ): number {
    const productionStrength = Math.abs(goalProductionDifference);

    const preventionStrength = Math.abs(goalPreventionDifference);

    const combinedStrength = this.clamp(
      (productionStrength + preventionStrength) / 2,
      0,
      1,
    );

    return this.clamp(
      comparisonConfidence * (0.4 + combinedStrength * 0.6),
      0,
      1,
    );
  }

  private calculateComparisonEvidence(
    agreement: number,
    comparisonConfidence: number,
    directionalEvidence: number,
    goalEvidence: number,
  ): number {
    return this.clamp(
      agreement * 0.35 +
        comparisonConfidence * 0.35 +
        directionalEvidence * 0.15 +
        goalEvidence * 0.15,
      0,
      1,
    );
  }

  private calculateStructuralRisk(input: {
    probability: number;
    modelReliability: number;
    dataQuality: number;
    agreement: number;
    comparisonEvidence: number;
    sampleReliability: number;
    calibrationReliability: number;
  }): number {
    /*
     * Structural risk is evidence-driven rather than
     * market-driven.
     *
     * It responds to the actual quality of the evidence package
     * and is deliberately kept small because the main evidence
     * dimensions already carry the majority of the risk score.
     */
    const evidenceQuality =
      input.modelReliability * 0.25 +
      input.dataQuality * 0.2 +
      input.agreement * 0.2 +
      input.comparisonEvidence * 0.15 +
      input.sampleReliability * 0.1 +
      input.calibrationReliability * 0.1;

    const uncertainty = 1 - this.clamp(evidenceQuality, 0, 1);

    const probabilityUncertainty =
      1 - this.calculateProbabilitySupport(input.probability);

    return this.clamp(uncertainty * 0.8 + probabilityUncertainty * 0.2, 0, 1);
  }

  private buildReasons(input: {
    probability: number;
    dataQuality: number;
    modelReliability: number;
    agreement: number;
    calibrationReliability: number;
    sampleReliability: number;
    comparisonEvidence: number;
    directionalEvidence: number;
    goalEvidence: number;
    safetyScore: number;
    risk: PredictionRisk;
  }): string[] {
    const reasons: string[] = [];

    /*
     * Probability remains diagnostic only.
     */
    if (input.probability < 0.5) {
      reasons.push(
        'Probability is below 50%, so the prediction carries a weaker raw probability profile.',
      );
    } else if (input.probability < 0.65) {
      reasons.push(
        'Probability is moderate and should be interpreted together with the evidence comparison.',
      );
    }

    if (input.dataQuality < 0.5) {
      reasons.push(
        'Data quality is not yet strong enough for a high safety assessment.',
      );
    }

    if (input.modelReliability < 0.5) {
      reasons.push('Model reliability is limited by the available evidence.');
    }

    if (input.agreement < 0.5) {
      reasons.push('Independent model signals show meaningful disagreement.');
    }

    if (input.comparisonEvidence < 0.5) {
      reasons.push('Team-comparison evidence is not yet strongly aligned.');
    }

    if (input.directionalEvidence < 0.5) {
      reasons.push('Directional team evidence is relatively weak.');
    }

    if (input.goalEvidence < 0.5) {
      reasons.push(
        'Goal-production and goal-prevention evidence is relatively weak.',
      );
    }

    if (input.calibrationReliability < 0.55) {
      reasons.push('Calibration history is limited or not yet reliable.');
    }

    if (input.sampleReliability < 0.6) {
      reasons.push(
        'The historical sample is still limited for a strong safety assessment.',
      );
    }

    if (input.safetyScore >= 80) {
      reasons.push(
        'The combined sports-data evidence supports a strong safety assessment.',
      );
    } else if (input.safetyScore >= 65) {
      reasons.push(
        'The combined sports-data evidence supports a moderate safety assessment.',
      );
    } else if (input.safetyScore >= 50) {
      reasons.push(
        'The available evidence supports a cautious safety assessment.',
      );
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
