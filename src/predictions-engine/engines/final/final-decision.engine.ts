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

    comparisonConfidence?: number;
    directionalDifference?: number;
    goalProductionDifference?: number;
    goalPreventionDifference?: number;
    evidenceCoherence?: number;

    modelSignals?: Record<string, unknown>;
    modelOutputs?: Record<string, unknown>;
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

    /*
     * ----------------------------------------------------------
     * SHARED COMPARISON EVIDENCE
     * ----------------------------------------------------------
     */
    const comparisonConfidence = this.clamp(
      input.comparisonConfidence ??
        this.readSignal(input, 'comparisonConfidence') ??
        0,
      0,
      1,
    );

    const directionalDifference = this.clamp(
      input.directionalDifference ??
        this.readSignal(input, 'directionalDifference') ??
        0,
      -1,
      1,
    );

    const goalProductionDifference = this.clamp(
      input.goalProductionDifference ??
        this.readSignal(input, 'goalProductionDifference') ??
        0,
      -1,
      1,
    );

    const goalPreventionDifference = this.clamp(
      input.goalPreventionDifference ??
        this.readSignal(input, 'goalPreventionDifference') ??
        0,
      -1,
      1,
    );

    const evidenceCoherence =
      input.evidenceCoherence !== undefined
        ? this.clamp(input.evidenceCoherence, 0, 1)
        : this.calculateEvidenceCoherence(
            input,
            effectiveEvidence.modelAgreement,
            comparisonConfidence,
            directionalDifference,
            goalProductionDifference,
            goalPreventionDifference,
          );

    /*
     * ----------------------------------------------------------
     * FINAL CONFIDENCE
     * ----------------------------------------------------------
     *
     * MATCH_RESULT uses one shared confidence for the complete
     * 1X2 distribution.
     */
    const confidence = this.calculateFinalConfidence(
      input,
      effectiveEvidence,
      evidenceCoherence,
      comparisonConfidence,
    );

    const risk = PredictionRiskUtil.fromScores({
      probability,
      confidence,
      safetyScore,
      modelAgreement: effectiveEvidence.modelAgreement,
      dataQuality: effectiveEvidence.dataQuality,
      calibrationReliability: effectiveEvidence.calibrationReliability,
    });

    /*
     * ----------------------------------------------------------
     * DECISION SCORE
     * ----------------------------------------------------------
     *
     * Comparison evidence participates in the descriptive score,
     * but the score does not independently decide acceptance.
     */
    const score = DecisionScoreUtil.calculate({
      probability,
      confidence,
      safetyScore,
      modelAgreement: effectiveEvidence.modelAgreement,
      dataQuality: effectiveEvidence.dataQuality,
      calibrationReliability: effectiveEvidence.calibrationReliability,

      comparisonConfidence,

      directionalDifference,

      goalProductionDifference,

      goalPreventionDifference,

      evidenceCoherence,
    });

    /*
     * ----------------------------------------------------------
     * REJECTION
     * ----------------------------------------------------------
     *
     * Low probability, low confidence, high risk or modest data
     * quality are not rejection conditions.
     *
     * Rejection is reserved for genuine evidence incoherence.
     */
    let rejectionReason: string | null = null;

    if (evidenceCoherence < 0.35) {
      rejectionReason = 'PREDICTION_CONTRADICTS_UNDERLYING_EVIDENCE';
    } else if (
      isMatchResult &&
      !this.matchResultDistributionIsCoherent(
        input.matchResultProbabilities!,
        input,
      )
    ) {
      rejectionReason = 'MATCH_RESULT_DISTRIBUTION_INCOHERENT';
    }

    return {
      market: input.market,

      selection: input.selection,

      probability,

      confidence,

      safetyScore,

      modelAgreement: effectiveEvidence.modelAgreement,

      dataQuality: effectiveEvidence.dataQuality,

      calibrationReliability: effectiveEvidence.calibrationReliability,

      risk,

      decisionScore: score.total,

      source: PredictionSource.ENSEMBLE,

      accepted: rejectionReason === null,

      rejectionReason: rejectionReason ?? undefined,
    };
  }

  private calculateFinalConfidence(
    input: {
      market: PredictionMarket;
      probability: number;
      confidence: number;

      matchResultProbabilities?: {
        home: number;
        draw: number;
        away: number;
      };
    },
    evidence: {
      modelAgreement: number;
      dataQuality: number;
      safetyScore: number;
      calibrationReliability: number;
    },
    evidenceCoherence: number,
    comparisonConfidence: number,
  ): number {
    if (
      input.matchResultProbabilities &&
      this.valid1X2Probabilities(input.matchResultProbabilities)
    ) {
      return this.calculate1X2Confidence(
        input.matchResultProbabilities,
        evidence,
        evidenceCoherence,
        comparisonConfidence,
      );
    }

    /*
     * ConfidenceEngine remains the primary confidence source for
     * all non-1X2 markets.
     */
    const base = this.clamp(input.confidence, 0, 98);

    const coherenceMultiplier = this.getCoherenceMultiplier(evidenceCoherence);

    return this.clamp(base * coherenceMultiplier, 0, 98);
  }

  private calculate1X2Confidence(
    probabilities: {
      home: number;
      draw: number;
      away: number;
    },
    evidence: {
      modelAgreement: number;
      dataQuality: number;
      safetyScore: number;
      calibrationReliability: number;
    },
    evidenceCoherence: number,
    comparisonConfidence: number,
  ): number {
    const normalized = this.normalize1X2Probabilities(probabilities);

    const values = [normalized.home, normalized.draw, normalized.away];

    const maximum = Math.max(...values);

    const secondHighest = this.getSecondHighest(values);

    const margin = Math.max(maximum - secondHighest, 0);

    /*
     * Distribution shape contributes to confidence but cannot
     * override weak underlying evidence.
     */
    const distributionStrength = this.clamp(0.45 + margin * 1.8, 0.45, 1);

    const agreement = this.clamp(evidence.modelAgreement, 0, 1);

    const dataQuality = this.clamp(evidence.dataQuality / 100, 0, 1);

    const safety = this.clamp(evidence.safetyScore / 100, 0, 1);

    const calibration = this.clamp(evidence.calibrationReliability / 100, 0, 1);

    const effectiveCalibration = calibration > 0 ? calibration : 0.5;

    const evidenceStrength =
      agreement * 0.28 +
      comparisonConfidence * 0.24 +
      evidenceCoherence * 0.18 +
      dataQuality * 0.16 +
      safety * 0.08 +
      effectiveCalibration * 0.06;

    const rawConfidence = evidenceStrength * 70 + distributionStrength * 30;

    return this.clamp(rawConfidence, 0, 98);
  }

  private calculateEvidenceCoherence(
    input: {
      market: PredictionMarket;
      selection: string;
      probability: number;

      matchResultProbabilities?: {
        home: number;
        draw: number;
        away: number;
      };

      modelSignals?: Record<string, unknown>;
      modelOutputs?: Record<string, unknown>;
    },
    modelAgreement: number,
    comparisonConfidence: number,
    directionalDifference: number,
    goalProductionDifference: number,
    goalPreventionDifference: number,
  ): number {
    const selectedProbability = this.clamp(input.probability, 0, 1);

    const commonProbability = this.readSignal(input, 'commonScoreMatrix');

    const registeredProbability = this.readSignal(
      input,
      'registeredMarketModel',
    );

    const comparisonProbability = this.readSignal(input, 'comparisonModel');

    const deviations: number[] = [];

    if (commonProbability !== null) {
      deviations.push(Math.abs(selectedProbability - commonProbability));
    }

    if (registeredProbability !== null) {
      deviations.push(Math.abs(selectedProbability - registeredProbability));
    }

    if (comparisonProbability !== null) {
      deviations.push(Math.abs(selectedProbability - comparisonProbability));
    }

    const modelPathCoherence =
      deviations.length > 0
        ? this.clamp(
            1 -
              (deviations.reduce((sum, value) => sum + value, 0) /
                deviations.length) *
                4,
            0,
            1,
          )
        : modelAgreement;

    const directionalEvidence = this.clamp(
      Math.abs(directionalDifference) * comparisonConfidence,
      0,
      1,
    );

    const goalEvidence = this.clamp(
      ((Math.abs(goalProductionDifference) +
        Math.abs(goalPreventionDifference)) /
        2) *
        comparisonConfidence,
      0,
      1,
    );

    return this.clamp(
      modelPathCoherence * 0.45 +
        comparisonConfidence * 0.25 +
        modelAgreement * 0.15 +
        directionalEvidence * 0.075 +
        goalEvidence * 0.075,
      0,
      1,
    );
  }

  private matchResultDistributionIsCoherent(
    probabilities: {
      home: number;
      draw: number;
      away: number;
    },
    input: {
      modelOutputs?: Record<string, unknown>;
      modelSignals?: Record<string, unknown>;
    },
  ): boolean {
    const normalized = this.normalize1X2Probabilities(probabilities);

    const modelHome = this.readSignal(input, 'homeWin');

    const modelDraw = this.readSignal(input, 'draw');

    const modelAway = this.readSignal(input, 'awayWin');

    if (modelHome === null && modelDraw === null && modelAway === null) {
      return true;
    }

    const modelDistribution = this.normalize1X2Probabilities({
      home: modelHome ?? normalized.home,

      draw: modelDraw ?? normalized.draw,

      away: modelAway ?? normalized.away,
    });

    const distance =
      (Math.abs(normalized.home - modelDistribution.home) +
        Math.abs(normalized.draw - modelDistribution.draw) +
        Math.abs(normalized.away - modelDistribution.away)) /
      3;

    return distance <= 0.15;
  }

  private getCoherenceMultiplier(evidenceCoherence: number): number {
    if (evidenceCoherence >= 0.85) {
      return 1;
    }

    if (evidenceCoherence >= 0.75) {
      return 0.98;
    }

    if (evidenceCoherence >= 0.65) {
      return 0.95;
    }

    if (evidenceCoherence >= 0.55) {
      return 0.91;
    }

    if (evidenceCoherence >= 0.45) {
      return 0.85;
    }

    return 0.75;
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

  private readSignal(
    input: {
      modelSignals?: Record<string, unknown>;
      modelOutputs?: Record<string, unknown>;
    },
    key: string,
  ): number | null {
    const signal = input.modelSignals?.[key];

    if (typeof signal === 'number' && Number.isFinite(signal)) {
      return signal;
    }

    const output = input.modelOutputs?.[key];

    if (typeof output === 'number' && Number.isFinite(output)) {
      return output;
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
