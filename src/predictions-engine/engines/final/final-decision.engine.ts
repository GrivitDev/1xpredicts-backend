// src/predictions-engine/engines/final/final-decision.engine.ts

import { Injectable } from '@nestjs/common';

import { PredictionMarket } from '../../enums/prediction-market.enum';
import { PredictionSource } from '../../enums/prediction-source.enum';

import { FinalDecision } from '../../interfaces/final-decision.interface';

import { DecisionScoreUtil } from '../../utils/decision-score.util';
import { PredictionRiskUtil } from '../../utils/prediction-risk.util';

@Injectable()
export class FinalDecisionEngine {
  decide(input: {
    market: PredictionMarket;
    selection: string;

    probability: number;
    confidence: number;
    safetyScore: number;
    modelAgreement: number;
    dataQuality: number;
    calibrationReliability: number;

    matchResultProbabilities?: {
      home: number;
      draw: number;
      away: number;
    };

    matchResultEvidence?: {
      modelAgreement: number;
      dataQuality: number;
      safetyScore: number;
      calibrationReliability: number;
    };
  }): FinalDecision {
    const probability = this.clamp(input.probability, 0, 1);

    const safetyScore = this.clamp(input.safetyScore, 0, 100);

    const modelAgreement = this.clamp(input.modelAgreement, 0, 1);

    const dataQuality = this.clamp(input.dataQuality, 0, 100);

    const calibrationReliability = this.clamp(
      input.calibrationReliability,
      0,
      100,
    );

    const isMatchResult =
      input.market === PredictionMarket.MATCH_RESULT &&
      !!input.matchResultProbabilities;

    const effectiveEvidence = isMatchResult
      ? {
          modelAgreement: this.clamp(
            input.matchResultEvidence?.modelAgreement ?? modelAgreement,
            0,
            1,
          ),

          dataQuality: this.clamp(
            input.matchResultEvidence?.dataQuality ?? dataQuality,
            0,
            100,
          ),

          safetyScore: this.clamp(
            input.matchResultEvidence?.safetyScore ?? safetyScore,
            0,
            100,
          ),

          calibrationReliability: this.clamp(
            input.matchResultEvidence?.calibrationReliability ??
              calibrationReliability,
            0,
            100,
          ),
        }
      : {
          modelAgreement,
          dataQuality,
          safetyScore,
          calibrationReliability,
        };

    const confidence = this.calculateFinalConfidence(input);

    const risk = PredictionRiskUtil.fromScores({
      probability,
      confidence,
      safetyScore,
      modelAgreement: effectiveEvidence.modelAgreement,
      dataQuality: effectiveEvidence.dataQuality,
      calibrationReliability: effectiveEvidence.calibrationReliability,
    });

    const score = DecisionScoreUtil.calculate({
      probability,
      confidence,
      safetyScore,
      modelAgreement: effectiveEvidence.modelAgreement,
      dataQuality: effectiveEvidence.dataQuality,
      calibrationReliability: effectiveEvidence.calibrationReliability,
    });

    const normalizedDataQuality = effectiveEvidence.dataQuality / 100;

    const normalizedSafety = effectiveEvidence.safetyScore / 100;

    const normalizedCalibration =
      effectiveEvidence.calibrationReliability > 0
        ? effectiveEvidence.calibrationReliability / 100
        : 0.5;

    const evidenceSupport =
      effectiveEvidence.modelAgreement * 0.6 +
      normalizedDataQuality * 0.2 +
      normalizedSafety * 0.1 +
      normalizedCalibration * 0.1;

    let rejectionReason: string | null = null;

    if (effectiveEvidence.modelAgreement < 0.35) {
      rejectionReason = 'INSUFFICIENT_MODEL_AGREEMENT';
    } else if (effectiveEvidence.dataQuality < 35) {
      rejectionReason = 'INSUFFICIENT_DATA_QUALITY';
    } else if (evidenceSupport < 0.45) {
      rejectionReason = 'INSUFFICIENT_EVIDENCE_SUPPORT';
    }

    return {
      market: input.market,

      selection: input.selection,

      probability,

      confidence,

      safetyScore,

      modelAgreement,

      dataQuality,

      calibrationReliability,

      risk,

      decisionScore: score.total,

      source: PredictionSource.ENSEMBLE,

      accepted: rejectionReason === null,

      rejectionReason: rejectionReason ?? undefined,
    };
  }

  private calculateFinalConfidence(input: {
    market: PredictionMarket;
    probability: number;
    confidence: number;
    modelAgreement: number;
    dataQuality: number;
    safetyScore: number;
    calibrationReliability: number;

    matchResultProbabilities?: {
      home: number;
      draw: number;
      away: number;
    };

    matchResultEvidence?: {
      modelAgreement: number;
      dataQuality: number;
      safetyScore: number;
      calibrationReliability: number;
    };
  }): number {
    if (
      input.matchResultProbabilities &&
      this.valid1X2Probabilities(input.matchResultProbabilities)
    ) {
      return this.calculate1X2Confidence(
        input.matchResultProbabilities,
        input.matchResultEvidence,
      );
    }

    return this.clamp(input.confidence, 0, 98);
  }

  private calculate1X2Confidence(
    probabilities: {
      home: number;
      draw: number;
      away: number;
    },
    evidence?: {
      modelAgreement: number;
      dataQuality: number;
      safetyScore: number;
      calibrationReliability: number;
    },
  ): number {
    const normalized = this.normalize1X2Probabilities(probabilities);

    const values = [normalized.home, normalized.draw, normalized.away];

    const maximum = Math.max(...values);

    const secondHighest = this.getSecondHighest(values);

    const margin = Math.max(maximum - secondHighest, 0);

    const distributionStrength = this.clamp(0.45 + margin * 1.8, 0.45, 1);

    const agreement = this.clamp(evidence?.modelAgreement ?? 0, 0, 1);

    const dataQuality = this.clamp(evidence?.dataQuality ?? 0, 0, 100) / 100;

    const safety = this.clamp(evidence?.safetyScore ?? 0, 0, 100) / 100;

    const calibration =
      this.clamp(evidence?.calibrationReliability ?? 0, 0, 100) / 100;

    const effectiveCalibration = calibration > 0 ? calibration : 0.5;

    const evidenceStrength =
      agreement * 0.45 +
      dataQuality * 0.25 +
      safety * 0.15 +
      effectiveCalibration * 0.15;

    const confidence = evidenceStrength * 70 + distributionStrength * 30;

    return this.clamp(confidence, 0, 98);
  }

  private normalize1X2Probabilities(probabilities: {
    home: number;
    draw: number;
    away: number;
  }): {
    home: number;
    draw: number;
    away: number;
  } {
    const home = this.clamp(probabilities.home, 0, 1);

    const draw = this.clamp(probabilities.draw, 0, 1);

    const away = this.clamp(probabilities.away, 0, 1);

    const total = home + draw + away;

    if (total <= 0) {
      return {
        home: 1 / 3,
        draw: 1 / 3,
        away: 1 / 3,
      };
    }

    return {
      home: home / total,
      draw: draw / total,
      away: away / total,
    };
  }

  private valid1X2Probabilities(probabilities: {
    home: number;
    draw: number;
    away: number;
  }): boolean {
    return (
      Number.isFinite(probabilities.home) &&
      Number.isFinite(probabilities.draw) &&
      Number.isFinite(probabilities.away) &&
      probabilities.home >= 0 &&
      probabilities.draw >= 0 &&
      probabilities.away >= 0 &&
      probabilities.home + probabilities.draw + probabilities.away > 0
    );
  }

  private getSecondHighest(values: number[]): number {
    return [...values].sort((a, b) => b - a)[1] ?? 0;
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
