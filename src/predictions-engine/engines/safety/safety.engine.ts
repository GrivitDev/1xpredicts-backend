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
     * EVIDENCE
     * ----------------------------------------------------------
     *
     * Safety measures reliability/uncertainty of the evidence.
     *
     * Probability is intentionally NOT treated as a major safety
     * signal. Otherwise broad, naturally high-probability markets
     * become artificially "safer" than more specific predictions.
     */

    const probabilitySupport = this.calculateProbabilitySupport(probability);

    /*
     * Probability remains diagnostic only.
     *
     * It contributes only a very small uncertainty component.
     */
    const probabilityRisk = 1 - probabilitySupport;

    const modelRisk = 1 - modelReliability;

    const dataRisk = 1 - dataQuality;

    const agreementRisk = 1 - agreement;

    const sampleRisk = 1 - sampleReliability;

    /*
     * Selection-aware evidence is critical.
     *
     * Absolute team differences alone are insufficient because
     * both sides of a market would otherwise receive the same
     * evidence score.
     */
    const selectionEvidence = this.calculateSelectionEvidence({
      market: input.market,
      selection: input.selection,
      comparisonConfidence,
      directionalDifference,
      goalProductionDifference,
      goalPreventionDifference,
      evidenceCoherence: explicitCoherence,
    });

    const comparisonEvidence = this.clamp(
      explicitCoherence !== null
        ? explicitCoherence * 0.55 + selectionEvidence * 0.45
        : selectionEvidence,
      0,
      1,
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
     * Structural risk represents general uncertainty in the
     * evidence package.
     *
     * Probability is deliberately excluded here.
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
     * DYNAMIC RISK
     * ----------------------------------------------------------
     *
     * Probability has only a small diagnostic contribution.
     *
     * Safety cannot become a duplicate probability score.
     */
    const riskScore =
      probabilityRisk * 0.03 +
      dataRisk * 0.22 +
      modelRisk * 0.2 +
      agreementRisk * 0.21 +
      comparisonRisk * 0.23 +
      sampleRisk * 0.08 +
      calibrationRisk * 0.02 +
      structuralRisk * 0.01;

    const normalizedRisk = this.clamp(riskScore, 0, 1);

    const safetyScore = this.clamp((1 - normalizedRisk) * 100, 0, 100);

    const risk = PredictionRiskUtil.fromScores({
      probability,
      confidence: 0,
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
     * Safety is descriptive.
     *
     * It does not reject predictions merely because:
     *   - probability is low
     *   - risk is high
     *   - confidence is low
     *
     * Hard contradiction remains downstream.
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
      selectionEvidence,
      probabilitySupport,
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

    if (comparisonConfidence <= 0) {
      return 0.5;
    }

    const upper = input.selection.trim().toUpperCase();

    const directional = this.clamp(input.directionalDifference, -1, 1);

    const production = this.clamp(input.goalProductionDifference, -1, 1);

    const prevention = this.clamp(input.goalPreventionDifference, -1, 1);

    const environment = this.clamp(production - prevention, -1, 1);

    let alignment = 0.5;

    /*
     * ----------------------------------------------------------
     * MATCH RESULT
     * ----------------------------------------------------------
     */
    if (input.market === PredictionMarket.MATCH_RESULT) {
      if (upper === 'HOME' || upper === '1' || upper === 'HOME_WIN') {
        alignment = 0.5 + directional * 0.5;
      } else if (upper === 'AWAY' || upper === '2' || upper === 'AWAY_WIN') {
        alignment = 0.5 - directional * 0.5;
      } else if (upper === 'DRAW' || upper === 'X') {
        alignment = 1 - Math.abs(directional);
      }
    } else if (input.market === PredictionMarket.BOTH_TEAMS_TO_SCORE) {
      /*
       * ----------------------------------------------------------
       * BTTS
       * ----------------------------------------------------------
       */
      const positiveSignal = this.clamp(0.5 + environment * 0.5, 0, 1);

      if (upper === 'YES' || upper === 'BTTS_YES' || upper === '1') {
        alignment = positiveSignal;
      } else if (upper === 'NO' || upper === 'BTTS_NO' || upper === '0') {
        alignment = 1 - positiveSignal;
      }
    } else if (
      /*
       * ----------------------------------------------------------
       * GOAL-DIRECTION MARKETS
       * ----------------------------------------------------------
       */
      input.market === PredictionMarket.OVER_UNDER ||
      input.market === PredictionMarket.FIRST_HALF_GOALS ||
      input.market === PredictionMarket.SECOND_HALF_GOALS
    ) {
      const positiveSignal = this.clamp(0.5 + environment * 0.5, 0, 1);

      if (upper.startsWith('OVER_')) {
        alignment = positiveSignal;
      } else if (upper.startsWith('UNDER_')) {
        alignment = 1 - positiveSignal;
      }
    } else if (input.market === PredictionMarket.TEAM_TOTAL_GOALS) {
      /*
       * ----------------------------------------------------------
       * TEAM TOTAL GOALS
       * ----------------------------------------------------------
       *
       * Team totals must use the relevant team's production /
       * prevention evidence rather than whole-match direction.
       */
      const isHome = upper.startsWith('HOME_');

      const isAway = upper.startsWith('AWAY_');

      if (isHome) {
        const positiveSignal = this.clamp(0.5 + production * 0.5, 0, 1);

        if (upper.includes('_OVER_')) {
          alignment = positiveSignal;
        } else if (upper.includes('_UNDER_')) {
          alignment = 1 - positiveSignal;
        }
      } else if (isAway) {
        const positiveSignal = this.clamp(0.5 - prevention * 0.5, 0, 1);

        if (upper.includes('_OVER_')) {
          alignment = positiveSignal;
        } else if (upper.includes('_UNDER_')) {
          alignment = 1 - positiveSignal;
        }
      }
    } else if (input.market === PredictionMarket.GOAL_RANGE) {
      /*
       * ----------------------------------------------------------
       * GOAL RANGE
       * ----------------------------------------------------------
       *
       * Generic directional evidence cannot safely distinguish
       * exact ranges. Keep this neutral rather than pretending
       * that "over-like" evidence selects a specific range.
       */
      alignment = 0.5;
    } else if (
      /*
       * ----------------------------------------------------------
       * HANDICAPS
       * ----------------------------------------------------------
       */
      input.market === PredictionMarket.ASIAN_HANDICAP ||
      input.market === PredictionMarket.EUROPEAN_HANDICAP
    ) {
      if (upper.startsWith('HOME_')) {
        alignment = 0.5 + directional * 0.5;
      } else if (upper.startsWith('AWAY_')) {
        alignment = 0.5 - directional * 0.5;
      } else if (upper.startsWith('DRAW_')) {
        alignment = 1 - Math.abs(directional);
      }
    }

    const coherence =
      input.evidenceCoherence !== null
        ? this.clamp(input.evidenceCoherence, 0, 1)
        : 0.5;

    /*
     * Selection alignment is the principal evidence signal.
     *
     * Coherence is supporting evidence rather than a replacement
     * for market-specific direction.
     */
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
    dataQuality: number;
    modelReliability: number;
    agreement: number;
    calibrationReliability: number;
    sampleReliability: number;
    comparisonEvidence: number;
    selectionEvidence: number;
    probabilitySupport: number;
    safetyScore: number;
    risk: PredictionRisk;
  }): string[] {
    const reasons: string[] = [];

    /*
     * Probability is deliberately described as diagnostic.
     */
    if (input.probability < 0.5) {
      reasons.push(
        'Probability is below 50%, so the raw outcome estimate is weaker.',
      );
    } else if (input.probability < 0.65) {
      reasons.push(
        'Probability is moderate and must be interpreted with the market-specific evidence.',
      );
    } else if (input.probability >= 0.9) {
      reasons.push(
        'Probability is very high, but safety is independently assessed from evidence quality.',
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

    if (input.selectionEvidence < 0.5) {
      reasons.push(
        'Evidence for the specific selected proposition is relatively weak.',
      );
    }

    if (input.comparisonEvidence < 0.5) {
      reasons.push(
        'Comparison evidence is not yet strongly aligned with the selected proposition.',
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
