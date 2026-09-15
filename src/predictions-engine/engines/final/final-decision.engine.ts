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
     * Calibration is advisory.
     *
     * A new market may legitimately have no calibration history,
     * therefore calibration reliability must never be a publication
     * blocker and must never reject a prediction by itself.
     *
     * Existing calibration still influences:
     * - probability adjustment
     * - confidence
     * - safety
     * - risk
     * - decision score
     *
     * The final decision therefore considers calibration, but does
     * not require historical calibration before a prediction can exist.
     */

    /*
     * Candidate-level evidence gate.
     *
     * These checks determine whether the market has enough underlying
     * evidence to be considered a meaningful candidate.
     */
    if (input.probability < config.probability.minimumCandidate) {
      return `Probability below minimum candidate threshold (${config.probability.minimumCandidate}).`;
    }

    if (input.confidence < config.confidence.minimumCandidate) {
      return `Confidence below minimum candidate threshold (${config.confidence.minimumCandidate}).`;
    }

    if (input.safetyScore < config.safety.minimumCandidate) {
      return `Safety score below minimum candidate threshold (${config.safety.minimumCandidate}).`;
    }

    if (input.modelAgreement < config.agreement.minimumCandidate) {
      return `Model agreement below minimum candidate threshold (${config.agreement.minimumCandidate}).`;
    }

    if (input.dataQuality < config.dataQuality.minimumCandidate) {
      return `Data quality below minimum candidate threshold (${config.dataQuality.minimumCandidate}).`;
    }

    /*
     * Calibration is intentionally NOT checked here.
     *
     * A prediction with calibrationReliability = 0 is still allowed
     * to proceed when the underlying evidence supports it.
     */

    /*
     * Publishable evidence gate.
     *
     * These checks determine whether this particular market/selection
     * is strong enough to be selected as a normal published prediction.
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
     * Calibration reliability is deliberately excluded from the
     * publishability gate.
     *
     * Existing calibration can improve or reduce the final score,
     * risk classification, probability and confidence, but it cannot
     * prevent a new prediction from being produced merely because
     * historical calibration is unavailable or weak.
     */

    if (input.decisionScore < config.selection.minimumDecisionScore) {
      return `Decision score below minimum threshold (${config.selection.minimumDecisionScore}).`;
    }

    /*
     * Risk is advisory for ranking/selection.
     *
     * The market-selection layer decides which candidates survive.
     * We do not automatically reject a prediction merely because
     * PredictionRiskUtil classified it as HIGH.
     *
     * This prevents calibration/risk state from becoming a global
     * prediction shutdown mechanism.
     */

    return null;
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
