import { Injectable } from '@nestjs/common';

import { PredictionRisk } from '../../enums/prediction-risk.enum';

import { PredictionSource } from '../../enums/prediction-source.enum';

import { FinalDecision } from '../../interfaces/final-decision.interface';

import { DecisionScoreUtil } from '../../utils/decision-score.util';

import { PredictionRiskUtil } from '../../utils/prediction-risk.util';

import { PREDICTION_DECISION_CONFIG } from '../../config/prediction-decision.config';
import { PredictionMarket } from 'src/predictions-engine/enums/prediction-market.enum';

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
     * Candidate-level gate.
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
     * HIGH risk is never publishable.
     */
    if (input.risk === PredictionRisk.HIGH) {
      return 'Prediction remains HIGH risk after combining probability and supporting evidence.';
    }

    /*
     * Publishable prediction gate.
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

    if (
      input.calibrationReliability <
      config.calibration.minimumReliabilityPublishable
    ) {
      return `Calibration reliability below publishable threshold (${config.calibration.minimumReliabilityPublishable}).`;
    }

    if (input.decisionScore < config.selection.minimumDecisionScore) {
      return `Decision score below minimum threshold (${config.selection.minimumDecisionScore}).`;
    }

    return null;
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
