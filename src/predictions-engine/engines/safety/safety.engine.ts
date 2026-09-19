// src/predictions-engine/engines/safety/safety.engine.ts

import { Injectable } from '@nestjs/common';

import { PredictionMarket } from '../../enums/prediction-market.enum';
import { PredictionRisk } from '../../enums/prediction-risk.enum';

import { SafetyResult } from '../../interfaces/safety-result.interface';

import { CalibrationRiskUtil } from '../../utils/calibration-risk.util';
import { ConfidenceUtil } from '../../utils/confidence.util';
import { PredictionRiskUtil } from '../../utils/prediction-risk.util';

@Injectable()
export class SafetyEngine {
  calculate(input: {
    market: PredictionMarket;
    selection: string;

    probability: number;
    confidence?: number;

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
    /*
     * ----------------------------------------------------------
     * NORMALIZED EVIDENCE
     * ----------------------------------------------------------
     *
     * Safety measures robustness of the evidence package.
     *
     * Probability is retained for downstream diagnostics/risk
     * handling, but it does not make a prediction safer merely
     * because it is numerically high.
     */
    const probability = this.clamp(input.probability, 0, 1);

    const confidence = this.clamp(input.confidence ?? 0, 0, 98);

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

    const evidenceCoherence =
      input.evidenceCoherence !== undefined
        ? this.clamp(input.evidenceCoherence, 0, 1)
        : null;

    const sampleSize = Math.max(Math.floor(input.sampleSize ?? 0), 0);

    const sampleReliability = ConfidenceUtil.sampleReliability(sampleSize);

    /*
     * ----------------------------------------------------------
     * SELECTION-ALIGNED EVIDENCE
     * ----------------------------------------------------------
     *
     * Safety should inspect whether the supporting evidence is
     * appropriate for the selected proposition.
     *
     * Evidence magnitude alone is not enough.
     */
    const selectionEvidence = this.calculateSelectionEvidence({
      market: input.market,
      selection: input.selection,
      comparisonConfidence,
      directionalDifference,
      goalProductionDifference,
      goalPreventionDifference,
      evidenceCoherence,
    });

    /*
     * Explicit coherence is preferred when available.
     *
     * Otherwise the selection-aware comparison evidence becomes
     * the fallback rather than inventing a separate signal.
     */
    const comparisonEvidence =
      evidenceCoherence !== null
        ? this.clamp(evidenceCoherence * 0.55 + selectionEvidence * 0.45, 0, 1)
        : selectionEvidence;

    /*
     * ----------------------------------------------------------
     * CALIBRATION RISK
     * ----------------------------------------------------------
     *
     * Calibration risk is evidence-quality risk.
     *
     * The current confidence value is passed through when available
     * instead of forcing confidence = 0.
     */
    const calibrationRisk =
      sampleSize > 0
        ? CalibrationRiskUtil.calculate({
            confidence,
            reliability: calibrationReliability,
            sampleSize,
            calibrationError: input.calibrationError ?? 0,
          })
        : 0;

    /*
     * ----------------------------------------------------------
     * EVIDENCE RISKS
     * ----------------------------------------------------------
     */
    const modelRisk = 1 - modelReliability;

    const dataRisk = 1 - dataQuality;

    const agreementRisk = 1 - agreement;

    const sampleRisk = 1 - sampleReliability;

    const comparisonRisk = 1 - comparisonEvidence;

    /*
     * ----------------------------------------------------------
     * STRUCTURAL RISK
     * ----------------------------------------------------------
     *
     * This describes weakness in the supporting evidence package.
     *
     * Probability is deliberately excluded.
     */
    const structuralRisk = this.calculateStructuralRisk({
      modelReliability,
      dataQuality,
      agreement,
      comparisonEvidence,
      sampleReliability,
      calibrationReliability,
    });

    /*
     * ----------------------------------------------------------
     * DYNAMIC SAFETY RISK
     * ----------------------------------------------------------
     *
     * Safety is derived from evidence quality rather than from
     * probability magnitude.
     *
     * Probability is intentionally not used here.
     */
    const riskScore =
      dataRisk * 0.24 +
      modelRisk * 0.22 +
      agreementRisk * 0.2 +
      comparisonRisk * 0.19 +
      sampleRisk * 0.08 +
      calibrationRisk * 0.04 +
      structuralRisk * 0.03;

    const normalizedRisk = this.clamp(riskScore, 0, 1);

    const safetyScore = this.clamp((1 - normalizedRisk) * 100, 0, 100);

    /*
     * ----------------------------------------------------------
     * RISK CLASSIFICATION
     * ----------------------------------------------------------
     *
     * PredictionRiskUtil remains responsible for converting the
     * continuous evidence/risk picture into the existing enum.
     *
     * The important correction is that confidence is no longer
     * hard-coded to zero.
     */
    const risk = PredictionRiskUtil.fromScores({
      probability,
      confidence,
      safetyScore,
      modelAgreement: agreement,
      dataQuality: input.dataQuality,
      calibrationReliability: input.calibrationReliability,
    });

    /*
     * ----------------------------------------------------------
     * SAFETY STATUS
     * ----------------------------------------------------------
     *
     * This is a descriptive structural status.
     *
     * It should not become a second candidate-selection system.
     */
    const isSafe =
      modelReliability >= 0.35 &&
      dataQuality >= 0.35 &&
      agreement >= 0.35 &&
      comparisonEvidence >= 0.35 &&
      sampleReliability >= 0.25;

    const reasons = this.buildReasons({
      probability,
      confidence,
      dataQuality,
      modelReliability,
      agreement,
      calibrationReliability,
      sampleReliability,
      comparisonEvidence,
      selectionEvidence,
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

      riskScore: normalizedRisk * 100,

      isSafe,

      reasons,
    };
  }

  private calculateSelectionEvidence(input: {
    market: PredictionMarket;
    selection: string;
    comparisonConfidence: number;
    directionalDifference: number;
    goalProductionDifference: number;
    goalPreventionDifference: number;
    evidenceCoherence: number | null;
  }): number {
    const comparisonConfidence = this.clamp(input.comparisonConfidence, 0, 1);

    /*
     * No comparison evidence means we should remain neutral rather
     * than manufacture positive support.
     */
    if (comparisonConfidence <= 0) {
      return 0.5;
    }

    const upper = input.selection.trim().toUpperCase();

    const directional = this.clamp(input.directionalDifference, -1, 1);

    const production = this.clamp(input.goalProductionDifference, -1, 1);

    const prevention = this.clamp(input.goalPreventionDifference, -1, 1);

    /*
     * ----------------------------------------------------------
     * MATCH RESULT / HANDICAP DIRECTION
     * ----------------------------------------------------------
     *
     * Positive directionalDifference means the home side has the
     * stronger directional signal.
     *
     * Negative means the away side has the stronger signal.
     */
    let alignment = 0.5;

    if (input.market === PredictionMarket.MATCH_RESULT) {
      if (upper === 'HOME' || upper === '1' || upper === 'HOME_WIN') {
        alignment = 0.5 + directional * 0.5;
      } else if (upper === 'AWAY' || upper === '2' || upper === 'AWAY_WIN') {
        alignment = 0.5 - directional * 0.5;
      } else if (upper === 'DRAW' || upper === 'X') {
        /*
         * A strong directional difference is evidence against a
         * draw. Similar team direction is more compatible with draw.
         */
        alignment = 1 - Math.abs(directional);
      }
    } else if (
      input.market === PredictionMarket.ASIAN_HANDICAP ||
      input.market === PredictionMarket.EUROPEAN_HANDICAP
    ) {
      if (upper.startsWith('HOME_') || upper === 'HOME' || upper === '1') {
        alignment = 0.5 + directional * 0.5;
      } else if (
        upper.startsWith('AWAY_') ||
        upper === 'AWAY' ||
        upper === '2'
      ) {
        alignment = 0.5 - directional * 0.5;
      } else if (
        upper.startsWith('DRAW_') ||
        upper === 'DRAW' ||
        upper === 'X'
      ) {
        alignment = 1 - Math.abs(directional);
      }
    } else if (input.market === PredictionMarket.BOTH_TEAMS_TO_SCORE) {
      /*
       * BTTS needs both teams to maintain scoring capability.
       *
       * Production supports scoring.
       * Poor prevention means opponents can score.
       *
       * We therefore use the combination as a general scoring
       * environment rather than treating one side alone as decisive.
       */
      const scoringEnvironment = this.clamp(
        0.5 + (production - prevention) * 0.5,
        0,
        1,
      );

      if (upper === 'YES' || upper === 'BTTS_YES' || upper === '1') {
        alignment = scoringEnvironment;
      } else if (upper === 'NO' || upper === 'BTTS_NO' || upper === '0') {
        alignment = 1 - scoringEnvironment;
      }
    } else if (
      input.market === PredictionMarket.OVER_UNDER ||
      input.market === PredictionMarket.FIRST_HALF_GOALS ||
      input.market === PredictionMarket.SECOND_HALF_GOALS
    ) {
      /*
       * Positive production minus prevention represents a more
       * goal-friendly environment.
       */
      const goalEnvironment = this.clamp(
        0.5 + (production - prevention) * 0.5,
        0,
        1,
      );

      if (
        upper.startsWith('OVER_') ||
        upper.startsWith('OVER:') ||
        upper.startsWith('OVER ')
      ) {
        alignment = goalEnvironment;
      } else if (
        upper.startsWith('UNDER_') ||
        upper.startsWith('UNDER:') ||
        upper.startsWith('UNDER ')
      ) {
        alignment = 1 - goalEnvironment;
      }
    } else if (input.market === PredictionMarket.TEAM_TOTAL_GOALS) {
      /*
       * Team totals should primarily use directional team evidence.
       *
       * For the home team:
       *   positive production difference supports home scoring.
       *
       * For the away team:
       *   negative production difference means the away side is
       *   relatively weaker in production.
       */
      if (upper.startsWith('HOME_')) {
        const homeProduction = this.clamp(0.5 + production * 0.5, 0, 1);

        if (upper.includes('_OVER_') || upper.includes('_OVER:')) {
          alignment = homeProduction;
        } else if (upper.includes('_UNDER_') || upper.includes('_UNDER:')) {
          alignment = 1 - homeProduction;
        }
      } else if (upper.startsWith('AWAY_')) {
        const awayProduction = this.clamp(0.5 - production * 0.5, 0, 1);

        if (upper.includes('_OVER_') || upper.includes('_OVER:')) {
          alignment = awayProduction;
        } else if (upper.includes('_UNDER_') || upper.includes('_UNDER:')) {
          alignment = 1 - awayProduction;
        }
      }
    } else if (input.market === PredictionMarket.GOAL_RANGE) {
      /*
       * Generic team-comparison evidence cannot safely identify
       * one exact total-goal range.
       *
       * Remain neutral rather than inventing precision.
       */
      alignment = 0.5;
    }

    /*
     * Evidence coherence is supplementary.
     *
     * It never replaces selection-specific alignment.
     */
    const coherence =
      input.evidenceCoherence !== null
        ? this.clamp(input.evidenceCoherence, 0, 1)
        : 0.5;

    return this.clamp(
      alignment * 0.65 + comparisonConfidence * 0.2 + coherence * 0.15,
      0,
      1,
    );
  }

  private calculateStructuralRisk(input: {
    modelReliability: number;
    dataQuality: number;
    agreement: number;
    comparisonEvidence: number;
    sampleReliability: number;
    calibrationReliability: number;
  }): number {
    const evidenceQuality =
      input.modelReliability * 0.28 +
      input.dataQuality * 0.2 +
      input.agreement * 0.2 +
      input.comparisonEvidence * 0.17 +
      input.sampleReliability * 0.08 +
      input.calibrationReliability * 0.07;

    return this.clamp(1 - this.clamp(evidenceQuality, 0, 1), 0, 1);
  }

  private buildReasons(input: {
    probability: number;
    confidence: number;
    dataQuality: number;
    modelReliability: number;
    agreement: number;
    calibrationReliability: number;
    sampleReliability: number;
    comparisonEvidence: number;
    selectionEvidence: number;
    safetyScore: number;
    risk: PredictionRisk;
  }): string[] {
    const reasons: string[] = [];

    /*
     * Probability and confidence are described separately.
     */
    if (input.probability < 0.5) {
      reasons.push(
        'Probability is below 50%; safety is assessed independently from that probability magnitude.',
      );
    } else if (input.probability >= 0.9) {
      reasons.push(
        'Probability is very high, but safety remains based on evidence quality rather than probability magnitude.',
      );
    }

    if (input.confidence < 50) {
      reasons.push(
        'Confidence is limited, indicating that the probability estimate has weaker evidence support.',
      );
    } else if (input.confidence >= 85) {
      reasons.push(
        'Confidence indicates strong trust in the supporting evidence package.',
      );
    }

    if (input.dataQuality < 0.5) {
      reasons.push('Data quality limits the safety assessment.');
    }

    if (input.modelReliability < 0.5) {
      reasons.push(
        'Probability-model reliability is limited by the available evidence.',
      );
    }

    if (input.agreement < 0.5) {
      reasons.push(
        'Probability-producing components show meaningful structural inconsistency.',
      );
    }

    if (input.selectionEvidence < 0.5) {
      reasons.push(
        'Evidence for the specific selected proposition is relatively weak.',
      );
    }

    if (input.comparisonEvidence < 0.5) {
      reasons.push(
        'Comparison evidence is not strongly aligned with the selected proposition.',
      );
    }

    if (input.calibrationReliability < 0.55) {
      reasons.push('Calibration history is limited or still developing.');
    }

    if (input.sampleReliability < 0.6) {
      reasons.push(
        'The historical sample remains limited for a strong safety assessment.',
      );
    }

    if (input.safetyScore >= 80) {
      reasons.push(
        'The combined evidence supports a strong safety assessment.',
      );
    } else if (input.safetyScore >= 65) {
      reasons.push(
        'The combined evidence supports a moderate safety assessment.',
      );
    } else if (input.safetyScore >= 50) {
      reasons.push(
        'The available evidence supports a cautious safety assessment.',
      );
    } else {
      reasons.push(
        'The evidence package has significant structural uncertainty.',
      );
    }

    if (input.risk === PredictionRisk.HIGH) {
      reasons.push(
        'Risk remains high after combining evidence quality and uncertainty.',
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
