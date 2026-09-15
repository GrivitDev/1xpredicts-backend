// src/prediction/engines/final-decision.engine.ts

import { Injectable } from '@nestjs/common';

import { PredictionMarket } from '../../enums/prediction-market.enum';
import { PredictionRisk } from '../../enums/prediction-risk.enum';
import { PredictionSource } from '../../enums/prediction-source.enum';

import { FinalDecision } from '../../interfaces/final-decision.interface';

import { PREDICTION_DECISION_CONFIG } from '../../config/prediction-decision.config';

import { DecisionScoreUtil } from '../../utils/decision-score.util';
import { PredictionRiskUtil } from '../../utils/prediction-risk.util';

@Injectable()
export class FinalDecisionEngine {
  decide(input: {
    market: string;
    selection: string;

    probability: number;
    confidence: number;
    safetyScore: number;
    modelAgreement: number;
    dataQuality: number;
    calibrationReliability: number;
  }): FinalDecision {
    const probability = this.clamp(input.probability, 0, 1);

    const confidence = this.clamp(input.confidence, 0, 98);

    const safetyScore = this.clamp(input.safetyScore, 0, 100);

    const modelAgreement = this.clamp(input.modelAgreement, 0, 1);

    const dataQuality = this.clamp(input.dataQuality, 0, 100);

    const calibrationReliability = this.clamp(
      input.calibrationReliability,
      0,
      100,
    );

    const risk = PredictionRiskUtil.fromScores({
      probability,
      confidence,
      safetyScore,
      modelAgreement,
      dataQuality,
      calibrationReliability,
    });

    const score = DecisionScoreUtil.calculate({
      probability,
      confidence,
      safetyScore,
      modelAgreement,
      dataQuality,
      calibrationReliability,
    });

    const rejectionReason = this.getRejectionReason({
      probability,
      confidence,
      safetyScore,
      modelAgreement,
      dataQuality,
      calibrationReliability,
      risk,
      decisionScore: score.total,
    });

    return {
      market: input.market as PredictionMarket,

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

  private getRejectionReason(input: {
    probability: number;
    confidence: number;
    safetyScore: number;
    modelAgreement: number;
    dataQuality: number;
    calibrationReliability: number;
    risk: PredictionRisk;
    decisionScore: number;
  }): string | null {
    const config = PREDICTION_DECISION_CONFIG;

    /*
     * ----------------------------------------------------------
     * CORE PREDICTION GATE
     * ----------------------------------------------------------
     *
     * We do not publish every statistically possible outcome.
     *
     * A prediction must first reach a meaningful probability,
     * confidence, safety, model agreement and data-quality level.
     */
    if (input.probability < config.probability.minimumPublishable) {
      return `Probability below publishable threshold (${config.probability.minimumPublishable}).`;
    }

    if (input.confidence < config.confidence.minimumPublishable) {
      return `Confidence below publishable threshold (${config.confidence.minimumPublishable}).`;
    }

    if (input.safetyScore < config.safety.minimumPublishable) {
      return `Safety score below publishable threshold (${config.safety.minimumPublishable}).`;
    }

    if (input.modelAgreement < config.agreement.minimumPublishable) {
      return `Model agreement below publishable threshold (${config.agreement.minimumPublishable}).`;
    }

    if (input.dataQuality < config.dataQuality.minimumPublishable) {
      return `Data quality below publishable threshold (${config.dataQuality.minimumPublishable}).`;
    }

    /*
     * ----------------------------------------------------------
     * PROBABILITY / CONFIDENCE ALIGNMENT
     * ----------------------------------------------------------
     *
     * Higher probability claims require stronger evidence.
     *
     * This is critical for preventing artificial 85-95%
     * predictions from being presented as trustworthy when the
     * confidence behind them is weak.
     */
    const minimumConfidence = this.getRequiredConfidence(input.probability);

    if (input.confidence < minimumConfidence) {
      return `Confidence (${input.confidence.toFixed(
        2,
      )}) does not sufficiently support the predicted probability (${(
        input.probability * 100
      ).toFixed(2)}%).`;
    }

    /*
     * ----------------------------------------------------------
     * DECISION SCORE
     * ----------------------------------------------------------
     *
     * The candidate must have enough combined strength.
     */
    if (input.decisionScore < config.selection.minimumDecisionScore) {
      return `Decision score below minimum threshold (${config.selection.minimumDecisionScore}).`;
    }

    /*
     * ----------------------------------------------------------
     * RISK
     * ----------------------------------------------------------
     *
     * HIGH risk is not useful as a public prediction.
     *
     * It can still be calculated internally for diagnostics and
     * ranking, but it should not survive the final publication
     * gate.
     */
    if (input.risk === PredictionRisk.HIGH) {
      return 'Prediction remains high risk after combining probability and evidence quality.';
    }

    /*
     * ----------------------------------------------------------
     * STRONG PROBABILITY SAFETY
     * ----------------------------------------------------------
     *
     * A very high probability requires stronger supporting
     * evidence than an ordinary prediction.
     */
    if (input.probability >= 0.9 && input.modelAgreement < 0.75) {
      return 'Very high probability requires stronger model agreement.';
    }

    if (input.probability >= 0.9 && input.safetyScore < 75) {
      return 'Very high probability requires stronger safety evidence.';
    }

    if (input.probability >= 0.8 && input.modelAgreement < 0.65) {
      return 'High probability requires stronger model agreement.';
    }

    return null;
  }

  private getRequiredConfidence(probability: number): number {
    if (probability >= 0.95) {
      return 88;
    }

    if (probability >= 0.9) {
      return 82;
    }

    if (probability >= 0.85) {
      return 76;
    }

    if (probability >= 0.8) {
      return 72;
    }

    if (probability >= 0.75) {
      return 68;
    }

    if (probability >= 0.7) {
      return 65;
    }

    if (probability >= 0.65) {
      return 62;
    }

    return 60;
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
