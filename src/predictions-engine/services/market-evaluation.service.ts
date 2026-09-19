// src/predictions-engine/services/market-evaluation.service.ts

import { Injectable } from '@nestjs/common';

import { ENABLED_PREDICTION_MARKETS } from '../config/prediction-markets.config';
import { PREDICTION_ENGINE_CONFIG } from '../config/prediction-engine.config';

import { PredictionMarket } from '../enums/prediction-market.enum';

import { MarketEvaluation } from '../interfaces/market-evaluation.interface';
import { MarketModelInput } from '../interfaces/market-model-input.interface';
import { RawPredictionFeatures } from '../interfaces/raw-prediction-features.interface';
import { EnsembleResult } from '../interfaces/ensemble-result.interface';
import { ValueResult } from '../interfaces/value-result.interface';
import { ProbabilityModelResult } from '../interfaces/probability-result.interface';

import { CalibrationService } from '../calibration/calibration.service';

import { RawGoalModelUtil } from '../engines/probability/raw-goal-model.util';
import { MarketProbabilityUtil } from '../engines/probability/market-probability.util';
import { ProbabilityEngine } from '../engines/probability/probability.engine';

import { SafetyEngine } from '../engines/safety/safety.engine';

import { EnsembleEngine } from '../engines/ensemble/ensemble.engine';

import { FinalDecisionEngine } from '../engines/final/final-decision.engine';

import { OddsCalculationService } from '../engines/value/odds-calculation.service';
import { ValueEngine } from '../engines/value/value.engine';

import {
  MarketCoherenceResult,
  MarketCoherenceService,
} from './market-coherence.service';

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
    private readonly marketCoherenceService: MarketCoherenceService,
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

    /*
     * ----------------------------------------------------------
     * MEANINGFULNESS CONFIGURATION
     * ----------------------------------------------------------
     *
     * Meaningfulness is configuration metadata.
     *
     * It does not represent:
     *
     *   - probability
     *   - confidence
     *   - value
     *   - fair odds
     *   - risk
     *
     * It describes how specific/actionable the configured
     * selection is as a product prediction.
     */
    const meaningfulnessBySelection = new Map<
      string,
      PredictionMeaningfulnessTier
    >();

    /*
     * ----------------------------------------------------------
     * COMMON GOAL MODEL
     * ----------------------------------------------------------
     */
    const goalModel = RawGoalModelUtil.calculate(features);

    /*
     * ----------------------------------------------------------
     * MARKET CANDIDATES
     * ----------------------------------------------------------
     */
    for (const configuration of marketConfigurations) {
      const configuredMeaningfulness =
        this.getConfiguredMeaningfulness(configuration);

      meaningfulnessBySelection.set(
        this.getCandidateKey(configuration.market, configuration.selection),
        configuredMeaningfulness,
      );

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

      /*
       * --------------------------------------------------------
       * COMMON STRUCTURAL MARKET PROBABILITY
       * --------------------------------------------------------
       */
      const commonProbability = MarketProbabilityUtil.calculate(
        goalModel,
        input.market,
        input.selection,
      );

      const rawProbability =
        this.readProbabilitySignal(probability, 'rawCommonProbability') ??
        commonProbability.probability;

      const probabilitySignals = this.getProbabilitySignals(probability);

      /*
       * --------------------------------------------------------
       * MARKET COHERENCE
       * --------------------------------------------------------
       */
      const coherence = this.marketCoherenceService.validate({
        features,

        goalModel,

        market: input.market,

        selection: input.selection,

        probability: probability.probability,

        rawProbability,

        commonProbability,
      });

      const evidenceCoherence = coherence.evidenceSupport;

      /*
       * --------------------------------------------------------
       * SAFETY
       * --------------------------------------------------------
       *
       * Safety is upstream structural evidence.
       *
       * Confidence is deliberately not supplied here so that
       * Safety -> Confidence -> Safety circularity is avoided.
       */
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

        evidenceCoherence,
      });

      /*
       * --------------------------------------------------------
       * ENSEMBLE / CONFIDENCE
       * --------------------------------------------------------
       */
      const ensemble = this.ensembleEngine.calculate({
        probability,

        safety,

        calibrationAdjustment: calibration?.adjustment ?? 0,

        calibrationReliability: calibration?.reliabilityScore ?? 0,

        comparisonConfidence: probabilitySignals.comparisonConfidence,

        directionalDifference: probabilitySignals.directionalDifference,

        goalProductionDifference: probabilitySignals.goalProductionDifference,

        goalPreventionDifference: probabilitySignals.goalPreventionDifference,

        evidenceCoherence,
      });

      /*
       * --------------------------------------------------------
       * PRESERVE COHERENCE / SUPPORT SIGNALS
       * --------------------------------------------------------
       */
      candidates.push({
        ...ensemble,

        modelSignals: {
          ...(ensemble.modelSignals ?? {}),

          comparisonConfidence: probabilitySignals.comparisonConfidence,

          directionalDifference: probabilitySignals.directionalDifference,

          goalProductionDifference: probabilitySignals.goalProductionDifference,

          goalPreventionDifference: probabilitySignals.goalPreventionDifference,

          evidenceCoherence,

          marketCoherent: coherence.coherent ? 1 : 0,

          coherenceProbabilityDifference: coherence.probabilityDifference,

          comparisonDirection:
            coherence.comparisonDirection === 'HOME'
              ? 1
              : coherence.comparisonDirection === 'AWAY'
                ? -1
                : 0,
        },

        modelOutputs: ensemble.modelOutputs,
      });

      /*
       * --------------------------------------------------------
       * INTERNAL FAIR ODDS / VALUE
       * --------------------------------------------------------
       *
       * ValueEngine owns the internal pricing path.
       *
       * No external bookmaker price is involved.
       */
      const value = this.valueEngine.calculate(input, probability);

      valueResults.push(value);
    }

    /*
     * ----------------------------------------------------------
     * MATCH RESULT
     * ----------------------------------------------------------
     */
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

    const matchResultConfidence = isMatchResult
      ? this.calculateMatchResultConfidence(matchResultCandidates)
      : undefined;

    /*
     * ----------------------------------------------------------
     * FIRST-PASS DECISIONS
     * ----------------------------------------------------------
     */
    const preliminaryCandidates = candidates.map((candidate) => {
      const normalizedProbability =
        isMatchResult && matchResultProbabilities
          ? this.getMatchResultSelectionProbability(
              candidate.selection,
              matchResultProbabilities,
            )
          : candidate.probability;

      const candidateSignals = this.getEnsembleSignals(candidate);

      const confidence =
        isMatchResult && matchResultConfidence !== undefined
          ? matchResultConfidence
          : candidate.confidence;

      const decision = this.finalDecisionEngine.decide({
        market: candidate.market,

        selection: candidate.selection,

        probability: normalizedProbability,

        confidence,

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

        evidenceCoherence: candidateSignals.evidenceCoherence,

        ...(isMatchResult && matchResultProbabilities && matchResultEvidence
          ? {
              matchResultProbabilities,
              matchResultEvidence,
            }
          : {}),
      });

      const coherence = this.getCandidateCoherence(candidate);

      return {
        candidate,

        decision,

        normalizedProbability,

        signals: candidateSignals,

        coherence,
      };
    });

    /*
     * ----------------------------------------------------------
     * RELATIVE CANDIDATE EVIDENCE
     * ----------------------------------------------------------
     */
    const relativeCandidates = preliminaryCandidates.map((candidate) => {
      const relativeEvidenceAdvantage = this.calculateRelativeEvidenceAdvantage(
        candidate,
        preliminaryCandidates,
      );

      const meaningfulness =
        meaningfulnessBySelection.get(
          this.getCandidateKey(
            candidate.candidate.market,
            candidate.candidate.selection,
          ),
        ) ?? 'STANDARD';

      /*
       * Meaningfulness is converted into the existing
       * marketSpecificity channel.
       *
       * This is NOT probability and is NOT confidence.
       */
      const marketSpecificity = this.calculateMarketSpecificity(meaningfulness);

      return {
        ...candidate,

        relativeEvidenceAdvantage,

        meaningfulness,

        marketSpecificity,
      };
    });

    /*
     * ----------------------------------------------------------
     * FINAL CANDIDATE DECISIONS
     * ----------------------------------------------------------
     */
    const selectionCandidates = relativeCandidates.map((candidate) => {
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

        evidenceCoherence: signals.evidenceCoherence,

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

        meaningfulness: candidate.meaningfulness,

        risk: finalDecision.risk,

        decisionScore: finalDecision.decisionScore,

        riskScore: ensemble.safetyResult.riskScore,

        eligible: finalDecision.accepted,

        rejectionReason: finalDecision.rejectionReason,
      };
    });

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

    /*
     * ----------------------------------------------------------
     * FINAL SELECTED DECISION
     * ----------------------------------------------------------
     */
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
        selectedRelativeCandidate?.relativeEvidenceAdvantage ?? 0.5,

      /*
       * Preserve the configured meaningfulness of the selected
       * candidate rather than reverting to the old neutral value.
       */
      marketSpecificity:
        selectedRelativeCandidate?.marketSpecificity ??
        this.calculateMarketSpecificity(selected.meaningfulness),

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

    /*
     * ----------------------------------------------------------
     * SELECTED FAIR ODDS
     * ----------------------------------------------------------
     *
     * Fair odds are generated exclusively from our internal
     * probability model.
     */
    let fairOdds: number | undefined;

    const selectedValue = valueResults.find(
      (value) =>
        value.market === selected.market &&
        value.selection === selected.selection,
    );

    const selectedFairOdds = selectedValue?.fairOdds;

    if (
      typeof selectedFairOdds === 'number' &&
      Number.isFinite(selectedFairOdds) &&
      selectedFairOdds >= 1
    ) {
      fairOdds = this.round(selectedFairOdds, 4);
    }

    /*
     * ----------------------------------------------------------
     * NORMALIZED MATCH-RESULT FAIR ODDS
     * ----------------------------------------------------------
     *
     * Match-result probabilities must form one coherent 1X2
     * distribution before prices are assigned.
     */
    if (isMatchResult && matchResultProbabilities) {
      const selectedProbability = this.getMatchResultSelectionProbability(
        selected.selection,
        matchResultProbabilities,
      );

      if (Number.isFinite(selectedProbability) && selectedProbability > 0) {
        fairOdds = this.round(1 / selectedProbability, 4);
      }

      /*
       * Preserve normalized fair odds for every 1X2 candidate.
       */
      for (const candidate of matchResultCandidates) {
        const candidateProbability = this.getMatchResultSelectionProbability(
          candidate.selection,
          matchResultProbabilities,
        );

        if (
          !Number.isFinite(candidateProbability) ||
          candidateProbability <= 0
        ) {
          continue;
        }

        const existing = valueResults.find(
          (value) =>
            value.market === PredictionMarket.MATCH_RESULT &&
            value.selection === candidate.selection,
        );

        const normalizedFairOdds = this.round(1 / candidateProbability, 4);

        if (existing) {
          existing.fairOdds = normalizedFairOdds;

          existing.modelProbability = candidateProbability;
        } else {
          valueResults.push({
            market: PredictionMarket.MATCH_RESULT,

            selection: candidate.selection,

            fairOdds: normalizedFairOdds,

            modelProbability: candidateProbability,

            pricingMethod: 'PROBABILITY',

            hasFairOdds:
              Number.isFinite(normalizedFairOdds) && normalizedFairOdds >= 1,
          });
        }
      }
    }

    /*
     * ----------------------------------------------------------
     * NON-MATCH FAIR ODDS FALLBACK
     * ----------------------------------------------------------
     */
    if (!isMatchResult && fairOdds === undefined && selectedCandidate) {
      const selectedProbabilityResult = selectedCandidate.probabilityResult;

      if (selectedProbabilityResult) {
        const odds = this.oddsCalculationService.calculate(
          selectedProbabilityResult,
        );

        const calculatedFairOdds = odds.fairOdds;

        if (
          typeof calculatedFairOdds === 'number' &&
          Number.isFinite(calculatedFairOdds) &&
          calculatedFairOdds >= 1
        ) {
          fairOdds = this.round(calculatedFairOdds, 4);
        }
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

    return this.clamp(0.5 + difference * 1.5, 0, 1);
  }

  private calculateCandidateEvidenceStrength(
    candidate: PreliminaryCandidate,
  ): number {
    if (candidate.coherence) {
      return this.clamp(candidate.coherence.evidenceSupport, 0, 1);
    }

    return 0.5;
  }

  private calculateMarketSpecificity(
    meaningfulness: PredictionMeaningfulnessTier,
  ): number {
    switch (meaningfulness) {
      case 'SPECIFIC':
        return 0.75;

      case 'STANDARD':
        return 0.5;

      case 'BROAD':
        return 0.25;

      default:
        return 0.5;
    }
  }

  private getConfiguredMeaningfulness(
    configuration: ConfiguredPredictionMarket,
  ): PredictionMeaningfulnessTier {
    const meaningfulness = configuration.meaningfulness;

    if (
      meaningfulness === 'BROAD' ||
      meaningfulness === 'STANDARD' ||
      meaningfulness === 'SPECIFIC'
    ) {
      return meaningfulness;
    }

    /*
     * A missing/invalid configuration should not create a
     * false specificity advantage.
     */
    return 'STANDARD';
  }

  private getCandidateKey(market: PredictionMarket, selection: string): string {
    return `${market}:${selection.trim().toUpperCase()}`;
  }

  private readProbabilitySignal(
    probability: ProbabilityModelResult,
    key: string,
  ): number | null {
    const signal = probability.modelSignals?.[key];

    if (typeof signal === 'number' && Number.isFinite(signal)) {
      return signal;
    }

    const output = probability.modelOutputs?.[key];

    if (typeof output === 'number' && Number.isFinite(output)) {
      return output;
    }

    return null;
  }

  private getProbabilitySignals(probability: ProbabilityModelResult): {
    comparisonConfidence: number;

    directionalDifference: number;

    goalProductionDifference: number;

    goalPreventionDifference: number;

    evidenceCoherence?: number;
  } {
    const result = probability as ProbabilityModelResult & {
      comparisonConfidence?: number;

      directionalDifference?: number;

      goalProductionDifference?: number;

      goalPreventionDifference?: number;

      evidenceCoherence?: number;
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

  private getCandidateCoherence(
    candidate: EnsembleResult,
  ): MarketCoherenceResult | null {
    const evidenceSupport = candidate.modelSignals?.evidenceCoherence;

    const probabilityDifference =
      candidate.modelSignals?.coherenceProbabilityDifference;

    const marketCoherent = candidate.modelSignals?.marketCoherent;

    if (
      typeof evidenceSupport !== 'number' ||
      !Number.isFinite(evidenceSupport)
    ) {
      return null;
    }

    return {
      coherent: marketCoherent === undefined ? true : marketCoherent >= 1,

      reasons: [],

      probabilityDifference:
        typeof probabilityDifference === 'number' &&
        Number.isFinite(probabilityDifference)
          ? probabilityDifference
          : 0,

      comparisonDirection: 'NEUTRAL',

      evidenceSupport: this.clamp(evidenceSupport, 0, 1),

      comparisonConfidence: this.clamp(
        candidate.modelSignals?.comparisonConfidence ?? 0,
        0,
        1,
      ),

      directionalDifference: this.clamp(
        candidate.modelSignals?.directionalDifference ?? 0,
        -1,
        1,
      ),

      goalProductionDifference: this.clamp(
        candidate.modelSignals?.goalProductionDifference ?? 0,
        -1,
        1,
      ),

      goalPreventionDifference: this.clamp(
        candidate.modelSignals?.goalPreventionDifference ?? 0,
        -1,
        1,
      ),
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

    if (total <= 0 || !Number.isFinite(total)) {
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

  private calculateMatchResultConfidence(candidates: EnsembleResult[]): number {
    if (!candidates.length) {
      return 0;
    }

    const confidenceValues = candidates
      .map((candidate) => this.clamp(candidate.confidence, 0, 98))
      .filter((value) => Number.isFinite(value));

    if (!confidenceValues.length) {
      return 0;
    }

    const average =
      confidenceValues.reduce((sum, value) => sum + value, 0) /
      confidenceValues.length;

    return this.clamp(average, 0, 98);
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

type PredictionMeaningfulnessTier = 'BROAD' | 'STANDARD' | 'SPECIFIC';

type ConfiguredPredictionMarket =
  (typeof ENABLED_PREDICTION_MARKETS)[number] & {
    meaningfulness: PredictionMeaningfulnessTier;
  };

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

  coherence: MarketCoherenceResult | null;

  relativeEvidenceAdvantage?: number;

  meaningfulness?: PredictionMeaningfulnessTier;

  marketSpecificity?: number;
}
