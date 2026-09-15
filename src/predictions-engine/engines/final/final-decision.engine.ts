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
     * CALIBRATION
     * ----------------------------------------------------------
     *
     * Calibration is never a rejection condition.
     *
     * It can influence:
     * - probability
     * - confidence
     * - safety
     * - risk
     * - decision score
     *
     * But it cannot prevent a new prediction from existing.
     */

    /*
     * ----------------------------------------------------------
     * CORE CANDIDATE GATE
     * ----------------------------------------------------------
     *
     * These are the minimum standards for a prediction to be
     * considered usable.
     *
     * The purpose here is NOT to select the strongest market.
     * It is only to remove predictions that are genuinely too
     * weak to belong in the candidate pool.
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
     * ----------------------------------------------------------
     * DECISION SCORE
     * ----------------------------------------------------------
     *
     * A candidate must still have enough combined strength.
     *
     * The decision score is deliberately the final combined
     * ranking signal rather than another market-specific rule.
     *
     * The stronger publishable thresholds are NOT used as
     * automatic rejection conditions here.
     */
    if (input.decisionScore < config.selection.minimumDecisionScore) {
      return `Decision score below minimum threshold (${config.selection.minimumDecisionScore}).`;
    }

    /*
     * ----------------------------------------------------------
     * RISK
     * ----------------------------------------------------------
     *
     * HIGH risk does not automatically reject a prediction.
     *
     * Risk is information for ranking and later presentation.
     * The market-selection layer should prefer lower-risk,
     * higher-scoring predictions.
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
