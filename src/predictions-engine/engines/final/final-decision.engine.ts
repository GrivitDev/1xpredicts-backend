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

    /*
     * Candidate comparison.
     *
     * 0.50 = no evidence advantage over alternatives
     * >0.50 = this candidate has stronger supporting evidence
     * <0.50 = an alternative has stronger supporting evidence
     */
    relativeEvidenceAdvantage?: number;

    /*
     * Specificity is descriptive only.
     *
     * It must never be used as a reward for choosing a more
     * difficult market. Neutral = 0.50.
     */
    marketSpecificity?: number;

    /*
     * Low evidence support is not a contradiction.
     */
    hardContradiction?: boolean;

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

    const relativeEvidenceAdvantage = this.clamp(
      input.relativeEvidenceAdvantage ?? 0.5,
      0,
      1,
    );

    const marketSpecificity = this.clamp(input.marketSpecificity ?? 0.5, 0, 1);

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

    const score = DecisionScoreUtil.calculate({
      probability,
      confidence,
      safetyScore: effectiveEvidence.safetyScore,
      modelAgreement: effectiveEvidence.modelAgreement,
      dataQuality: effectiveEvidence.dataQuality,
      calibrationReliability: effectiveEvidence.calibrationReliability,

      comparisonConfidence,
      directionalDifference,
      goalProductionDifference,
      goalPreventionDifference,
      evidenceCoherence,

      relativeEvidenceAdvantage,
      marketSpecificity,
    });

    let rejectionReason: string | null = null;

    if (input.hardContradiction === true) {
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

      ...(isMatchResult && input.matchResultProbabilities
        ? {
            matchResultProbabilities: this.normalize1X2Probabilities(
              input.matchResultProbabilities,
            ),
          }
        : {}),

      confidence,

      safetyScore: effectiveEvidence.safetyScore,

      modelAgreement: effectiveEvidence.modelAgreement,

      dataQuality: effectiveEvidence.dataQuality,

      calibrationReliability: effectiveEvidence.calibrationReliability,

      comparisonConfidence,

      directionalDifference,

      goalProductionDifference,

      goalPreventionDifference,

      evidenceCoherence,

      relativeEvidenceAdvantage,

      marketSpecificity,

      modelSignals: this.normalizeModelRecord(input.modelSignals),

      modelOutputs: this.normalizeModelRecord(input.modelOutputs),

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

    return this.clamp(input.confidence, 0, 98);
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

    const averageDeviation =
      deviations.length > 0
        ? deviations.reduce((sum, value) => sum + value, 0) / deviations.length
        : 0;

    const modelPathCoherence =
      this.calculateDeviationCoherence(averageDeviation);

    const selectionAlignment = this.calculateSelectionAlignment(
      input.market,
      input.selection,
      directionalDifference,
      goalProductionDifference,
      goalPreventionDifference,
      comparisonConfidence,
    );

    return this.clamp(
      modelPathCoherence * 0.4 +
        modelAgreement * 0.2 +
        comparisonConfidence * 0.15 +
        selectionAlignment * 0.25,
      0,
      1,
    );
  }

  private calculateDeviationCoherence(deviation: number): number {
    if (!Number.isFinite(deviation)) {
      return 0.5;
    }

    if (deviation <= 0.08) {
      return 1;
    }

    if (deviation >= 0.35) {
      return 0;
    }

    return this.clamp(1 - (deviation - 0.08) / 0.27, 0, 1);
  }

  private calculateSelectionAlignment(
    market: PredictionMarket,
    selection: string,
    directionalDifference: number,
    goalProductionDifference: number,
    goalPreventionDifference: number,
    comparisonConfidence: number,
  ): number {
    if (comparisonConfidence <= 0) {
      return 0.5;
    }

    const upper = selection.trim().toUpperCase();

    const directional = this.clamp(directionalDifference, -1, 1);

    const production = this.clamp(goalProductionDifference, -1, 1);

    const prevention = this.clamp(goalPreventionDifference, -1, 1);

    const environment = this.clamp(production - prevention, -1, 1);

    if (market === PredictionMarket.MATCH_RESULT) {
      if (upper === 'HOME' || upper === '1' || upper === 'HOME_WIN') {
        return this.clamp(
          (0.5 + directional * 0.5) * comparisonConfidence,
          0,
          1,
        );
      }

      if (upper === 'AWAY' || upper === '2' || upper === 'AWAY_WIN') {
        return this.clamp(
          (0.5 - directional * 0.5) * comparisonConfidence,
          0,
          1,
        );
      }

      if (upper === 'DRAW' || upper === 'X') {
        return this.clamp(
          (1 - Math.abs(directional)) * comparisonConfidence,
          0,
          1,
        );
      }
    }

    if (market === PredictionMarket.BOTH_TEAMS_TO_SCORE) {
      const positiveSignal = this.clamp(0.5 + environment * 0.5, 0, 1);

      if (upper === 'YES' || upper === 'BTTS_YES' || upper === '1') {
        return this.clamp(positiveSignal * comparisonConfidence, 0, 1);
      }

      if (upper === 'NO' || upper === 'BTTS_NO' || upper === '0') {
        return this.clamp((1 - positiveSignal) * comparisonConfidence, 0, 1);
      }
    }

    if (
      market === PredictionMarket.OVER_UNDER ||
      market === PredictionMarket.FIRST_HALF_GOALS ||
      market === PredictionMarket.SECOND_HALF_GOALS
    ) {
      const positiveSignal = this.clamp(0.5 + environment * 0.5, 0, 1);

      if (upper.startsWith('OVER_')) {
        return this.clamp(positiveSignal * comparisonConfidence, 0, 1);
      }

      if (upper.startsWith('UNDER_')) {
        return this.clamp((1 - positiveSignal) * comparisonConfidence, 0, 1);
      }
    }

    if (market === PredictionMarket.TEAM_TOTAL_GOALS) {
      const isHome = upper.startsWith('HOME_');
      const isAway = upper.startsWith('AWAY_');

      if (!isHome && !isAway) {
        return 0.5;
      }

      const teamDirection = isHome ? production : -prevention;

      const positiveSignal = this.clamp(0.5 + teamDirection * 0.5, 0, 1);

      if (upper.includes('_OVER_')) {
        return this.clamp(positiveSignal * comparisonConfidence, 0, 1);
      }

      if (upper.includes('_UNDER_')) {
        return this.clamp((1 - positiveSignal) * comparisonConfidence, 0, 1);
      }
    }

    /*
     * GOAL_RANGE is a mutually-exclusive distribution.
     *
     * Comparison signals do not contain enough information to
     * safely classify a specific range, so neutral evidence is
     * returned rather than pretending that broad directional
     * evidence supports an exact range.
     */
    if (market === PredictionMarket.GOAL_RANGE) {
      return 0.5;
    }

    if (
      market === PredictionMarket.ASIAN_HANDICAP ||
      market === PredictionMarket.EUROPEAN_HANDICAP
    ) {
      const homeSelection = upper.startsWith('HOME_');

      const awaySelection = upper.startsWith('AWAY_');

      if (homeSelection) {
        return this.clamp(
          (0.5 + directional * 0.5) * comparisonConfidence,
          0,
          1,
        );
      }

      if (awaySelection) {
        return this.clamp(
          (0.5 - directional * 0.5) * comparisonConfidence,
          0,
          1,
        );
      }

      if (upper.startsWith('DRAW_')) {
        return this.clamp(
          (1 - Math.abs(directional)) * comparisonConfidence,
          0,
          1,
        );
      }
    }

    return 0.5;
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

  private normalizeModelRecord(
    input?: Record<string, unknown>,
  ): Record<string, number> | undefined {
    if (!input) {
      return undefined;
    }

    const result: Record<string, number> = {};

    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        result[key] = value;
      }
    }

    return Object.keys(result).length > 0 ? result : undefined;
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
