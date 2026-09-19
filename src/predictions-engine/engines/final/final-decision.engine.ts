import { Injectable } from '@nestjs/common';

import { PredictionMarket } from '../../enums/prediction-market.enum';
import { PredictionSource } from '../../enums/prediction-source.enum';

import { FinalDecision } from '../../interfaces/final-decision.interface';

import { DecisionScoreUtil } from '../../utils/decision-score.util';
import { PredictionRiskUtil } from '../../utils/prediction-risk.util';

@Injectable()
export class FinalDecisionEngine {
  private static readonly MIN_PUBLICATION_CONFIDENCE = 60;

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
     * 0.50 = neutral
     * > 0.50 = supporting evidence advantage
     * < 0.50 = evidence disadvantage
     */
    relativeEvidenceAdvantage?: number;

    /*
     * Selection meaningfulness / specificity.
     *
     * 0.50 = neutral
     * Higher = more specific/actionable selection
     * Lower = broader selection
     *
     * This is NOT probability, confidence, value, or risk.
     */
    marketSpecificity?: number;

    /*
     * Explicit contradiction supplied by the coherence layer.
     */
    hardContradiction?: boolean;

    modelSignals?: Record<string, unknown>;

    modelOutputs?: Record<string, unknown>;
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

    const relativeEvidenceAdvantage = this.clamp(
      input.relativeEvidenceAdvantage ?? 0.5,
      0,
      1,
    );

    /*
     * Meaningfulness is configuration-derived candidate metadata.
     *
     * It is allowed to influence candidate quality/ranking through
     * DecisionScoreUtil, but it does not alter probability or
     * confidence and it is not a publication gate by itself.
     */
    const marketSpecificity = this.clamp(input.marketSpecificity ?? 0.5, 0, 1);

    const isMatchResult =
      input.market === PredictionMarket.MATCH_RESULT &&
      !!input.matchResultProbabilities;

    /*
     * ----------------------------------------------------------
     * MARKET-LEVEL EVIDENCE
     * ----------------------------------------------------------
     *
     * MATCH_RESULT uses one common evidence package for the
     * normalized HOME / DRAW / AWAY distribution.
     */
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
     * SUPPORTING SIGNALS
     * ----------------------------------------------------------
     *
     * These remain evidence descriptors.
     *
     * They are not converted into additional probabilities.
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

    /*
     * Coherence comes directly from the coherence layer.
     *
     * It must not be reconstructed here from other probability
     * representations.
     */
    const evidenceCoherence =
      input.evidenceCoherence !== undefined
        ? this.clamp(input.evidenceCoherence, 0, 1)
        : this.clamp(this.readSignal(input, 'evidenceCoherence') ?? 0.5, 0, 1);

    /*
     * ----------------------------------------------------------
     * FINAL RISK
     * ----------------------------------------------------------
     *
     * FinalDecisionEngine is the sole final risk authority.
     *
     * Risk is calculated AFTER probability and confidence are
     * both available.
     */
    const riskScore = PredictionRiskUtil.score({
      probability,
      confidence,
      safetyScore: effectiveEvidence.safetyScore,
      modelAgreement: effectiveEvidence.modelAgreement,
      dataQuality: effectiveEvidence.dataQuality,
      calibrationReliability: effectiveEvidence.calibrationReliability,
    });

    const risk = PredictionRiskUtil.fromRiskScore(riskScore);

    /*
     * ----------------------------------------------------------
     * DECISION SCORE
     * ----------------------------------------------------------
     *
     * This is the final candidate-quality score.
     *
     * It does not redefine probability or confidence.
     *
     * marketSpecificity is now passed through instead of being
     * hardcoded to the old neutral 0.5 value.
     */
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

    /*
     * ----------------------------------------------------------
     * CONTRADICTION
     * ----------------------------------------------------------
     */
    const modelCoherentSignal = this.readSignal(input, 'marketCoherent');

    const hardContradiction =
      input.hardContradiction === true ||
      (modelCoherentSignal !== null && modelCoherentSignal < 1);

    let rejectionReason: string | null = null;

    if (hardContradiction) {
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

    /*
     * ----------------------------------------------------------
     * PUBLICATION CONFIDENCE GATE
     * ----------------------------------------------------------
     *
     * Probability and confidence are completely independent.
     *
     * Probability does NOT impose any minimum confidence
     * relative to its percentage.
     *
     * The only confidence publication requirement is:
     *
     *   confidence >= 60
     *
     * Confidence is never increased here to satisfy the rule.
     */
    if (
      rejectionReason === null &&
      confidence < FinalDecisionEngine.MIN_PUBLICATION_CONFIDENCE
    ) {
      rejectionReason = 'CONFIDENCE_BELOW_PUBLICATION_MINIMUM';
    }

    /*
     * ----------------------------------------------------------
     * FINAL RESULT
     * ----------------------------------------------------------
     */
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
    const home = this.clamp(probabilities.home, 0, 1);

    const draw = this.clamp(probabilities.draw, 0, 1);

    const away = this.clamp(probabilities.away, 0, 1);

    const total = home + draw + away;

    /*
     * An invalid distribution must never be silently converted
     * into a synthetic 1X2 distribution.
     */
    if (!Number.isFinite(total) || total <= 0) {
      return false;
    }

    const normalized = {
      home: home / total,
      draw: draw / total,
      away: away / total,
    };

    const modelHome = this.readSignal(input, 'homeWin');

    const modelDraw = this.readSignal(input, 'draw');

    const modelAway = this.readSignal(input, 'awayWin');

    /*
     * No separate reference distribution exists.
     *
     * A valid normalized 1X2 distribution is therefore
     * structurally coherent.
     */
    if (modelHome === null && modelDraw === null && modelAway === null) {
      return true;
    }

    const referenceHome = this.clamp(modelHome ?? normalized.home, 0, 1);

    const referenceDraw = this.clamp(modelDraw ?? normalized.draw, 0, 1);

    const referenceAway = this.clamp(modelAway ?? normalized.away, 0, 1);

    const referenceTotal = referenceHome + referenceDraw + referenceAway;

    if (!Number.isFinite(referenceTotal) || referenceTotal <= 0) {
      return false;
    }

    const reference = {
      home: referenceHome / referenceTotal,
      draw: referenceDraw / referenceTotal,
      away: referenceAway / referenceTotal,
    };

    const distance =
      (Math.abs(normalized.home - reference.home) +
        Math.abs(normalized.draw - reference.draw) +
        Math.abs(normalized.away - reference.away)) /
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

    if (!Number.isFinite(total) || total <= 0) {
      return {
        home: 0,
        draw: 0,
        away: 0,
      };
    }

    return {
      home: home / total,
      draw: draw / total,
      away: away / total,
    };
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
