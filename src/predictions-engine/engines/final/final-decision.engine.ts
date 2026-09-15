// src/prediction/engines/final-decision.engine.ts

import { Injectable } from '@nestjs/common';

import { PredictionMarket } from '../../enums/prediction-market.enum';
import { PredictionSource } from '../../enums/prediction-source.enum';

import { FinalDecision } from '../../interfaces/final-decision.interface';

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

    /*
     * ----------------------------------------------------------
     * RISK
     * ----------------------------------------------------------
     *
     * Risk describes the prediction. It does not decide whether
     * the prediction is publishable.
     */
    const risk = PredictionRiskUtil.fromScores({
      probability,
      confidence,
      safetyScore,
      modelAgreement,
      dataQuality,
      calibrationReliability,
    });

    /*
     * ----------------------------------------------------------
     * DECISION SCORE
     * ----------------------------------------------------------
     *
     * Decision score remains useful for ranking candidates.
     * It is NOT a publication gate.
     */
    const score = DecisionScoreUtil.calculate({
      probability,
      confidence,
      safetyScore,
      modelAgreement,
      dataQuality,
      calibrationReliability,
    });

    /*
     * ----------------------------------------------------------
     * EVIDENCE SUPPORT
     * ----------------------------------------------------------
     *
     * The engine is predicting an outcome, not selecting only
     * safe outcomes.
     *
     * Therefore:
     *
     *   low probability  -> allowed
     *   low confidence   -> allowed
     *   high odds        -> allowed
     *   medium risk      -> allowed
     *   high risk        -> allowed
     *   low score        -> allowed
     *
     * The actual publication gate asks whether the prediction is
     * supported by the evidence.
     *
     * Model agreement is the strongest evidence signal.
     * Data quality measures whether the evidence itself is usable.
     * Safety provides additional supporting evidence.
     * Calibration provides historical reliability when available.
     */
    const normalizedDataQuality = dataQuality / 100;

    const normalizedSafety = safetyScore / 100;

    /*
     * No calibration history is treated as neutral rather than
     * as evidence against a new prediction.
     */
    const normalizedCalibration =
      calibrationReliability > 0 ? calibrationReliability / 100 : 0.5;

    const evidenceSupport =
      modelAgreement * 0.6 +
      normalizedDataQuality * 0.2 +
      normalizedSafety * 0.1 +
      normalizedCalibration * 0.1;

    /*
     * ----------------------------------------------------------
     * EVIDENCE GATE
     * ----------------------------------------------------------
     *
     * This is the only publication rejection logic.
     *
     * The prediction is rejected when the available evidence is
     * too weak to justify the selected outcome.
     */
    let rejectionReason: string | null = null;

    if (modelAgreement < 0.35) {
      rejectionReason = 'INSUFFICIENT_MODEL_AGREEMENT';
    } else if (dataQuality < 35) {
      rejectionReason = 'INSUFFICIENT_DATA_QUALITY';
    } else if (evidenceSupport < 0.45) {
      rejectionReason = 'INSUFFICIENT_EVIDENCE_SUPPORT';
    }

    /*
     * ----------------------------------------------------------
     * FINAL DECISION
     * ----------------------------------------------------------
     */
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

  private clamp(value: number, minimum: number, maximum: number): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
