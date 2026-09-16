// src/predictions-engine/services/market-evaluation.service.ts

import { Injectable } from '@nestjs/common';

import { ENABLED_PREDICTION_MARKETS } from '../config/prediction-markets.config';
import { PREDICTION_ENGINE_CONFIG } from '../config/prediction-engine.config';

import { PredictionMarket } from '../enums/prediction-market.enum';

import { MarketEvaluation } from '../interfaces/market-evaluation.interface';
import { MarketModelInput } from '../interfaces/market-model-input.interface';
import { RawPredictionFeatures } from '../interfaces/raw-prediction-features.interface';
import { EnsembleResult } from '../interfaces/ensemble-result.interface';
import { MarketCandidate } from '../interfaces/market-candidate.interface';
import { ValueResult } from '../interfaces/value-result.interface';

import { CalibrationService } from '../calibration/calibration.service';

import { ProbabilityEngine } from '../engines/probability/probability.engine';
import { SafetyEngine } from '../engines/safety/safety.engine';
import { EnsembleEngine } from '../engines/ensemble/ensemble.engine';
import { FinalDecisionEngine } from '../engines/final/final-decision.engine';
import { OddsCalculationService } from '../engines/value/odds-calculation.service';
import { ValueEngine } from '../engines/value/value.engine';

import { MarketSelectionUtil } from '../utils/market-selection.util';

@Injectable()
export class MarketEvaluationService {
  private readonly modelVersion = PREDICTION_ENGINE_CONFIG.modelVersion;

  constructor(
    private readonly calibrationService: CalibrationService,
    private readonly probabilityEngine: ProbabilityEngine,
    private readonly oddsCalculationService: OddsCalculationService,
    private readonly valueEngine: ValueEngine,
    private readonly safetyEngine: SafetyEngine,
    private readonly ensembleEngine: EnsembleEngine,
    private readonly finalDecisionEngine: FinalDecisionEngine,
  ) {}

  async evaluateMarket(
    features: RawPredictionFeatures,
    market: (typeof ENABLED_PREDICTION_MARKETS)[number]['market'],
  ): Promise<MarketEvaluation> {
    const marketConfigurations = ENABLED_PREDICTION_MARKETS.filter(
      (item) => item.market === market && item.enabled,
    );

    const candidates: EnsembleResult[] = [];
    const valueResults: ValueResult[] = [];

    for (const configuration of marketConfigurations) {
      const calibration = await this.calibrationService.getCalibration(
        configuration.market,
        configuration.selection,
        this.modelVersion,
      );

      const input: MarketModelInput = {
        features,
        market: configuration.market,
        selection: configuration.selection,
        calibrationAdjustment: calibration?.adjustment ?? 0,
      };

      const probability = this.probabilityEngine.calculate(input);

      if (
        !Number.isFinite(probability.probability) ||
        probability.probability <= 0
      ) {
        continue;
      }

      const probabilitySignals = this.getProbabilitySignals(probability);

      const safety = this.safetyEngine.calculate({
        market: input.market,
        selection: input.selection,
        probability: probability.probability,
        modelReliability: probability.modelReliability,
        dataQuality: probability.dataQuality,
        modelAgreement: probability.modelAgreement ?? 0,
        calibrationReliability: calibration?.reliabilityScore ?? 0,
        calibrationError: calibration?.calibrationError ?? 0,
        sampleSize: probability.sampleSize,

        comparisonConfidence: probabilitySignals.comparisonConfidence,

        directionalDifference: probabilitySignals.directionalDifference,

        goalProductionDifference: probabilitySignals.goalProductionDifference,

        goalPreventionDifference: probabilitySignals.goalPreventionDifference,

        ...(probabilitySignals.evidenceCoherence !== undefined
          ? {
              evidenceCoherence: probabilitySignals.evidenceCoherence,
            }
          : {}),
      });

      const ensemble = this.ensembleEngine.calculate({
        probability,
        safety,
        calibrationAdjustment: calibration?.adjustment ?? 0,
        calibrationReliability: calibration?.reliabilityScore ?? 0,

        comparisonConfidence: probabilitySignals.comparisonConfidence,

        directionalDifference: probabilitySignals.directionalDifference,

        goalProductionDifference: probabilitySignals.goalProductionDifference,

        goalPreventionDifference: probabilitySignals.goalPreventionDifference,

        ...(probabilitySignals.evidenceCoherence !== undefined
          ? {
              evidenceCoherence: probabilitySignals.evidenceCoherence,
            }
          : {}),
      });

      candidates.push({
        ...ensemble,

        /*
         * Preserve the signals required later for candidate-to-candidate
         * comparison. These do not alter probability.
         */
        modelSignals: {
          ...(ensemble.modelSignals ?? {}),
          comparisonConfidence: probabilitySignals.comparisonConfidence,
          directionalDifference: probabilitySignals.directionalDifference,
          goalProductionDifference: probabilitySignals.goalProductionDifference,
          goalPreventionDifference: probabilitySignals.goalPreventionDifference,
          ...(probabilitySignals.evidenceCoherence !== undefined
            ? {
                evidenceCoherence: probabilitySignals.evidenceCoherence,
              }
            : {}),
        },

        modelOutputs: ensemble.modelOutputs,
      });

      if (market !== PredictionMarket.MATCH_RESULT) {
        const odds = this.oddsCalculationService.calculate(probability);

        const value = this.valueEngine.calculate(
          input,
          probability.probability,
          odds.fairOdds,
        );

        valueResults.push(value);
      }
    }

    const isMatchResult = market === PredictionMarket.MATCH_RESULT;

    const matchResultCandidates = isMatchResult
      ? this.getMatchResultCandidates(candidates)
      : [];

    const matchResultProbabilities = isMatchResult
      ? this.normalizeMatchResultProbabilities(matchResultCandidates)
      : null;

    const matchResultEvidence = isMatchResult
      ? this.calculateMatchResultEvidence(matchResultCandidates)
      : null;

    /*
     * ----------------------------------------------------------
     * FIRST-PASS DECISIONS
     * ----------------------------------------------------------
     *
     * Every candidate is evaluated independently first.
     *
     * This is important because candidate comparison must not
     * contaminate the underlying probability.
     */
    const preliminaryCandidates: PreliminaryCandidate[] = candidates.map(
      (candidate) => {
        const normalizedProbability =
          isMatchResult && matchResultProbabilities
            ? this.getMatchResultSelectionProbability(
                candidate.selection,
                matchResultProbabilities,
              )
            : candidate.probability;

        const candidateSignals = this.getEnsembleSignals(candidate);

        const decision = this.finalDecisionEngine.decide({
          market: candidate.market,
          selection: candidate.selection,
          probability: normalizedProbability,
          confidence: candidate.confidence,
          safetyScore: candidate.safetyResult.safetyScore,
          modelAgreement: candidate.modelAgreement,
          dataQuality: candidate.dataQuality,
          calibrationReliability: candidate.calibrationReliability,

          comparisonConfidence: candidateSignals.comparisonConfidence,

          directionalDifference: candidateSignals.directionalDifference,

          goalProductionDifference: candidateSignals.goalProductionDifference,

          goalPreventionDifference: candidateSignals.goalPreventionDifference,

          modelSignals: candidate.modelSignals,

          modelOutputs: candidate.modelOutputs,

          ...(candidateSignals.evidenceCoherence !== undefined
            ? {
                evidenceCoherence: candidateSignals.evidenceCoherence,
              }
            : {}),

          ...(isMatchResult && matchResultProbabilities && matchResultEvidence
            ? {
                matchResultProbabilities,
                matchResultEvidence,
              }
            : {}),
        });

        return {
          candidate,
          decision,
          normalizedProbability,
          signals: candidateSignals,
        };
      },
    );

    /*
     * ----------------------------------------------------------
     * RELATIVE CANDIDATE EVIDENCE
     * ----------------------------------------------------------
     *
     * The engine must not simply select the candidate with the
     * largest probability.
     *
     * We therefore calculate:
     *
     *   absolute evidence
     *   +
     *   relative evidence against the alternatives
     *   +
     *   market-specificity
     *
     * Safety is intentionally excluded from the relative evidence
     * calculation. Otherwise broad/easy selections could win simply
     * because they are safer.
     */
    const relativeCandidates = preliminaryCandidates.map((candidate) => {
      const relativeEvidenceAdvantage = this.calculateRelativeEvidenceAdvantage(
        candidate,
        preliminaryCandidates,
      );

      const marketSpecificity = this.calculateMarketSpecificity(
        market,
        candidate.decision.selection,
      );

      return {
        ...candidate,
        relativeEvidenceAdvantage,
        marketSpecificity,
      };
    });

    /*
     * ----------------------------------------------------------
     * FINAL DECISIONS WITH CANDIDATE COMPARISON
     * ----------------------------------------------------------
     */
    const selectionCandidates: MarketCandidate[] = relativeCandidates.map(
      (candidate) => {
        const { decision, candidate: ensemble, signals } = candidate;

        const finalDecision = this.finalDecisionEngine.decide({
          market: decision.market,
          selection: decision.selection,
          probability: decision.probability,
          confidence: decision.confidence,
          safetyScore: decision.safetyScore,
          modelAgreement: decision.modelAgreement,
          dataQuality: decision.dataQuality,
          calibrationReliability: decision.calibrationReliability,

          comparisonConfidence: signals.comparisonConfidence,

          directionalDifference: signals.directionalDifference,

          goalProductionDifference: signals.goalProductionDifference,

          goalPreventionDifference: signals.goalPreventionDifference,

          modelSignals: ensemble.modelSignals,

          modelOutputs: ensemble.modelOutputs,

          relativeEvidenceAdvantage: candidate.relativeEvidenceAdvantage,

          marketSpecificity: candidate.marketSpecificity,

          ...(signals.evidenceCoherence !== undefined
            ? {
                evidenceCoherence: signals.evidenceCoherence,
              }
            : {}),

          ...(isMatchResult && matchResultProbabilities && matchResultEvidence
            ? {
                matchResultProbabilities,
                matchResultEvidence,
              }
            : {}),
        });

        return {
          market: finalDecision.market,
          selection: finalDecision.selection,
          probability: finalDecision.probability,
          confidence: finalDecision.confidence,
          safetyScore: finalDecision.safetyScore,
          modelAgreement: finalDecision.modelAgreement,
          dataQuality: finalDecision.dataQuality,
          calibrationReliability: finalDecision.calibrationReliability,
          risk: finalDecision.risk,
          decisionScore: finalDecision.decisionScore,
          riskScore: ensemble.safetyResult.riskScore,
          eligible: finalDecision.accepted,
          rejectionReason: finalDecision.rejectionReason,
        };
      },
    );

    const selected = MarketSelectionUtil.selectBest(selectionCandidates);

    if (!selected) {
      return {
        market,
        candidates,
        valueResults,
      };
    }

    const selectedCandidate = candidates.find(
      (candidate) =>
        candidate.market === selected.market &&
        candidate.selection === selected.selection,
    );

    const selectedRelativeCandidate = relativeCandidates.find(
      (candidate) =>
        candidate.candidate.market === selected.market &&
        candidate.candidate.selection === selected.selection,
    );

    const selectedSignals = selectedCandidate
      ? this.getEnsembleSignals(selectedCandidate)
      : {
          comparisonConfidence: 0,
          directionalDifference: 0,
          goalProductionDifference: 0,
          goalPreventionDifference: 0,
          evidenceCoherence: undefined,
        };

    const finalDecisionInput = {
      market: selected.market,
      selection: selected.selection,
      probability: selected.probability,
      confidence: selected.confidence,
      safetyScore: selected.safetyScore,
      modelAgreement: selected.modelAgreement,
      dataQuality: selected.dataQuality,
      calibrationReliability: selected.calibrationReliability,

      comparisonConfidence: selectedSignals.comparisonConfidence,

      directionalDifference: selectedSignals.directionalDifference,

      goalProductionDifference: selectedSignals.goalProductionDifference,

      goalPreventionDifference: selectedSignals.goalPreventionDifference,

      modelSignals: selectedCandidate?.modelSignals,

      modelOutputs: selectedCandidate?.modelOutputs,

      relativeEvidenceAdvantage:
        selectedRelativeCandidate?.relativeEvidenceAdvantage ?? 0,

      marketSpecificity: selectedRelativeCandidate?.marketSpecificity ?? 0.5,

      ...(selectedSignals.evidenceCoherence !== undefined
        ? {
            evidenceCoherence: selectedSignals.evidenceCoherence,
          }
        : {}),

      ...(isMatchResult && matchResultProbabilities && matchResultEvidence
        ? {
            matchResultProbabilities,
            matchResultEvidence,
          }
        : {}),
    };

    const finalDecision = this.finalDecisionEngine.decide(finalDecisionInput);

    let fairOdds: number | undefined;

    if (isMatchResult && matchResultProbabilities) {
      const selectedProbability = this.getMatchResultSelectionProbability(
        selected.selection,
        matchResultProbabilities,
      );

      if (selectedProbability > 0) {
        fairOdds = this.round(1 / selectedProbability, 4);
      }

      for (const candidate of matchResultCandidates) {
        const candidateProbability = this.getMatchResultSelectionProbability(
          candidate.selection,
          matchResultProbabilities,
        );

        if (candidateProbability <= 0) {
          continue;
        }

        valueResults.push({
          market: PredictionMarket.MATCH_RESULT,
          selection: candidate.selection,
          fairOdds: this.round(1 / candidateProbability, 4),
          modelProbability: candidateProbability,
          probabilityEdge: 0,
          valueScore: 0,
          hasValue: false,
        });
      }
    } else {
      const selectedProbabilityResult = selectedCandidate?.probabilityResult;

      if (selectedProbabilityResult) {
        const odds = this.oddsCalculationService.calculate(
          selectedProbabilityResult,
        );

        fairOdds = odds.fairOdds ?? undefined;
      }
    }

    return {
      market,
      candidates,
      valueResults,
      decision: finalDecision,

      ...(isMatchResult && matchResultProbabilities
        ? {
            matchResultProbabilities,
            matchResultConfidence: finalDecision.confidence,
          }
        : {}),

      fairOdds,
    };
  }

  private calculateRelativeEvidenceAdvantage(
    candidate: PreliminaryCandidate,
    allCandidates: PreliminaryCandidate[],
  ): number {
    if (allCandidates.length <= 1) {
      return 0.5;
    }

    const candidateEvidence =
      this.calculateCandidateEvidenceStrength(candidate);

    const alternatives = allCandidates.filter(
      (other) => other.candidate.selection !== candidate.candidate.selection,
    );

    if (!alternatives.length) {
      return 0.5;
    }

    const alternativeEvidence = Math.max(
      ...alternatives.map((other) =>
        this.calculateCandidateEvidenceStrength(other),
      ),
    );

    const difference = candidateEvidence - alternativeEvidence;

    /*
     * 0.5 means there is no meaningful evidence advantage.
     *
     * The result approaches 1 only when this candidate has a
     * genuine evidence advantage over its strongest alternative.
     *
     * A high probability alone cannot generate this value.
     */
    return this.clamp(0.5 + difference * 1.5, 0, 1);
  }

  private calculateCandidateEvidenceStrength(
    candidate: PreliminaryCandidate,
  ): number {
    const signals = candidate.signals;

    const comparisonConfidence = this.clamp(signals.comparisonConfidence, 0, 1);

    const directionalEvidence = this.clamp(
      Math.abs(signals.directionalDifference),
      0,
      1,
    );

    const productionEvidence = this.clamp(
      Math.abs(signals.goalProductionDifference),
      0,
      1,
    );

    const preventionEvidence = this.clamp(
      Math.abs(signals.goalPreventionDifference),
      0,
      1,
    );

    const goalEvidence = this.clamp(
      (productionEvidence + preventionEvidence) / 2,
      0,
      1,
    );

    const coherence = this.clamp(
      signals.evidenceCoherence ?? candidate.candidate.modelAgreement,
      0,
      1,
    );

    const agreement = this.clamp(candidate.candidate.modelAgreement, 0, 1);

    const dataQuality = this.clamp(candidate.candidate.dataQuality / 100, 0, 1);

    /*
     * Safety is deliberately excluded.
     *
     * This measures predictive evidence, not ease of settlement.
     */
    return this.clamp(
      comparisonConfidence * 0.28 +
        directionalEvidence * 0.16 +
        goalEvidence * 0.16 +
        coherence * 0.22 +
        agreement * 0.1 +
        dataQuality * 0.08,
      0,
      1,
    );
  }

  private calculateMarketSpecificity(
    market: PredictionMarket,
    selection: string,
  ): number {
    const upper = selection.trim().toUpperCase();

    /*
     * Broad lines are deliberately prevented from receiving an
     * automatic specificity advantage simply because they are
     * easier to satisfy.
     *
     * This does NOT change probability.
     */
    if (market === PredictionMarket.OVER_UNDER) {
      if (upper === 'OVER_1.5' || upper === 'UNDER_1.5') {
        return 0.7;
      }

      if (upper === 'OVER_2.5' || upper === 'UNDER_2.5') {
        return 0.82;
      }

      if (upper === 'OVER_3.5' || upper === 'UNDER_3.5') {
        return 0.9;
      }

      if (upper === 'OVER_4.5' || upper === 'UNDER_4.5') {
        return 0.78;
      }
    }

    if (
      market === PredictionMarket.FIRST_HALF_GOALS ||
      market === PredictionMarket.SECOND_HALF_GOALS
    ) {
      if (upper === 'OVER_1.5' || upper === 'UNDER_1.5') {
        return 0.72;
      }

      if (upper === 'OVER_2.5' || upper === 'UNDER_2.5') {
        return 0.86;
      }

      if (upper === 'OVER_3.5' || upper === 'UNDER_3.5') {
        return 0.9;
      }
    }

    if (market === PredictionMarket.TEAM_TOTAL_GOALS) {
      if (upper.endsWith('_1.5')) {
        return 0.75;
      }

      if (upper.endsWith('_2.5')) {
        return 0.88;
      }

      if (upper.endsWith('_3.5')) {
        return 0.92;
      }
    }

    if (market === PredictionMarket.GOAL_RANGE) {
      if (upper === '0-1') {
        return 0.78;
      }

      if (upper === '2') {
        return 0.9;
      }

      if (upper === '3-4') {
        return 0.88;
      }

      if (upper === '5+') {
        return 0.84;
      }
    }

    if (market === PredictionMarket.ASIAN_HANDICAP) {
      const line = this.extractHandicapLine(upper);

      if (line !== null) {
        const magnitude = Math.abs(line);

        if (magnitude >= 1.5) {
          return 0.95;
        }

        if (magnitude >= 1) {
          return 0.9;
        }

        if (magnitude >= 0.5) {
          return 0.84;
        }
      }
    }

    if (market === PredictionMarket.EUROPEAN_HANDICAP) {
      const line = this.extractHandicapLine(upper);

      if (line !== null) {
        if (line === 0) {
          return 0.76;
        }

        if (Math.abs(line) === 1) {
          return 0.88;
        }
      }
    }

    /*
     * Result markets are already inherently specific.
     */
    return 1;
  }

  private extractHandicapLine(selection: string): number | null {
    const match = selection.match(/_(\\-?\d+(?:\.\d+)?)$/);

    if (!match) {
      return null;
    }

    const value = Number(match[1]);

    return Number.isFinite(value) ? value : null;
  }

  private getProbabilitySignals(probability: unknown): {
    comparisonConfidence: number;
    directionalDifference: number;
    goalProductionDifference: number;
    goalPreventionDifference: number;
    evidenceCoherence?: number;
  } {
    const result = probability as {
      comparisonConfidence?: number;
      directionalDifference?: number;
      goalProductionDifference?: number;
      goalPreventionDifference?: number;
      evidenceCoherence?: number;

      modelSignals?: {
        comparisonConfidence?: number;
        directionalDifference?: number;
        goalProductionDifference?: number;
        goalPreventionDifference?: number;
        evidenceCoherence?: number;
      };
    };

    const signals = result.modelSignals;

    const rawEvidenceCoherence =
      result.evidenceCoherence ?? signals?.evidenceCoherence;

    return {
      comparisonConfidence: this.clamp(
        result.comparisonConfidence ?? signals?.comparisonConfidence ?? 0,
        0,
        1,
      ),

      directionalDifference: this.clamp(
        result.directionalDifference ?? signals?.directionalDifference ?? 0,
        -1,
        1,
      ),

      goalProductionDifference: this.clamp(
        result.goalProductionDifference ??
          signals?.goalProductionDifference ??
          0,
        -1,
        1,
      ),

      goalPreventionDifference: this.clamp(
        result.goalPreventionDifference ??
          signals?.goalPreventionDifference ??
          0,
        -1,
        1,
      ),

      evidenceCoherence:
        typeof rawEvidenceCoherence === 'number' &&
        Number.isFinite(rawEvidenceCoherence)
          ? this.clamp(rawEvidenceCoherence, 0, 1)
          : undefined,
    };
  }

  private getEnsembleSignals(candidate: EnsembleResult): {
    comparisonConfidence: number;
    directionalDifference: number;
    goalProductionDifference: number;
    goalPreventionDifference: number;
    evidenceCoherence?: number;
  } {
    const result = candidate as EnsembleResult & {
      comparisonConfidence?: number;
      directionalDifference?: number;
      goalProductionDifference?: number;
      goalPreventionDifference?: number;
      evidenceCoherence?: number;
    };

    const rawEvidenceCoherence =
      result.evidenceCoherence ?? candidate.modelSignals?.evidenceCoherence;

    return {
      comparisonConfidence: this.clamp(
        result.comparisonConfidence ??
          candidate.modelSignals?.comparisonConfidence ??
          0,
        0,
        1,
      ),

      directionalDifference: this.clamp(
        result.directionalDifference ??
          candidate.modelSignals?.directionalDifference ??
          0,
        -1,
        1,
      ),

      goalProductionDifference: this.clamp(
        result.goalProductionDifference ??
          candidate.modelSignals?.goalProductionDifference ??
          0,
        -1,
        1,
      ),

      goalPreventionDifference: this.clamp(
        result.goalPreventionDifference ??
          candidate.modelSignals?.goalPreventionDifference ??
          0,
        -1,
        1,
      ),

      evidenceCoherence:
        typeof rawEvidenceCoherence === 'number' &&
        Number.isFinite(rawEvidenceCoherence)
          ? this.clamp(rawEvidenceCoherence, 0, 1)
          : undefined,
    };
  }

  private getMatchResultCandidates(
    candidates: EnsembleResult[],
  ): EnsembleResult[] {
    return candidates.filter(
      (candidate) =>
        candidate.market === PredictionMarket.MATCH_RESULT &&
        ['HOME', 'DRAW', 'AWAY'].includes(candidate.selection),
    );
  }

  private normalizeMatchResultProbabilities(candidates: EnsembleResult[]): {
    home: number;
    draw: number;
    away: number;
  } {
    const home =
      candidates.find((candidate) => candidate.selection === 'HOME')
        ?.probability ?? 0;

    const draw =
      candidates.find((candidate) => candidate.selection === 'DRAW')
        ?.probability ?? 0;

    const away =
      candidates.find((candidate) => candidate.selection === 'AWAY')
        ?.probability ?? 0;

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

  private getMatchResultSelectionProbability(
    selection: string,
    probabilities: {
      home: number;
      draw: number;
      away: number;
    },
  ): number {
    switch (selection.trim().toUpperCase()) {
      case 'HOME':
        return probabilities.home;

      case 'DRAW':
        return probabilities.draw;

      case 'AWAY':
        return probabilities.away;

      default:
        return 0;
    }
  }

  private calculateMatchResultEvidence(candidates: EnsembleResult[]): {
    modelAgreement: number;
    dataQuality: number;
    safetyScore: number;
    calibrationReliability: number;
  } {
    if (!candidates.length) {
      return {
        modelAgreement: 0,
        dataQuality: 0,
        safetyScore: 0,
        calibrationReliability: 0,
      };
    }

    return {
      modelAgreement:
        candidates.reduce(
          (sum, candidate) => sum + this.clamp(candidate.modelAgreement, 0, 1),
          0,
        ) / candidates.length,

      dataQuality:
        candidates.reduce(
          (sum, candidate) => sum + this.clamp(candidate.dataQuality, 0, 100),
          0,
        ) / candidates.length,

      safetyScore:
        candidates.reduce(
          (sum, candidate) =>
            sum + this.clamp(candidate.safetyResult.safetyScore, 0, 100),
          0,
        ) / candidates.length,

      calibrationReliability:
        candidates.reduce(
          (sum, candidate) =>
            sum + this.clamp(candidate.calibrationReliability, 0, 100),
          0,
        ) / candidates.length,
    };
  }

  private round(value: number, decimals: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    const factor = Math.pow(10, decimals);

    return Math.round(value * factor) / factor;
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}

interface PreliminaryCandidate {
  candidate: EnsembleResult;
  decision: {
    market: PredictionMarket;
    selection: string;
    probability: number;
    confidence: number;
    safetyScore: number;
    modelAgreement: number;
    dataQuality: number;
    calibrationReliability: number;
    risk: unknown;
    decisionScore: number;
    accepted: boolean;
    rejectionReason?: string;
  };
  normalizedProbability: number;
  signals: {
    comparisonConfidence: number;
    directionalDifference: number;
    goalProductionDifference: number;
    goalPreventionDifference: number;
    evidenceCoherence?: number;
  };
  relativeEvidenceAdvantage?: number;
  marketSpecificity?: number;
}
