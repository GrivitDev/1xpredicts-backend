import { Injectable } from '@nestjs/common';

import { PredictionRisk } from '../../enums/prediction-risk.enum';

import { PredictionStatus } from '../../enums/prediction-status.enum';

import {
  PredictionSignal,
  PredictionSignalRecommendation,
} from '../../interfaces/prediction-signal.interface';

import {
  FinalDecisionRecommendation,
  FinalMarketDecision,
} from '../../interfaces/final-decision-result.interface';

import { FinalMarketCandidate } from '../../interfaces/final-market-candidate.interface';

import { PredictionConfidenceService } from '../../services/prediction-confidence.service';

import { PredictionOddsService } from '../../services/prediction-odds.service';

import { PredictionRiskService } from '../../services/prediction-risk.service';

import { SignalAggregatorService } from '../../services/signal-aggregator.service';

@Injectable()
export class FinalDecisionEngine {
  constructor(
    private readonly signalAggregatorService: SignalAggregatorService,

    private readonly confidenceService: PredictionConfidenceService,

    private readonly riskService: PredictionRiskService,

    private readonly oddsService: PredictionOddsService,
  ) {}

  decide(
    signals: PredictionSignal[],
    calibrationBySelection: Map<string, number> = new Map(),
  ): FinalMarketDecision[] {
    const marketSelections = new Map<
      string,
      Map<string, PredictionSignalRecommendation[]>
    >();

    for (const signal of signals) {
      if (
        signal.status !== PredictionStatus.COMPLETED &&
        signal.status !== PredictionStatus.PARTIAL
      ) {
        continue;
      }

      for (const recommendation of signal.recommendations ?? []) {
        if (!recommendation.market || !recommendation.selection) {
          continue;
        }

        if (!marketSelections.has(recommendation.market)) {
          marketSelections.set(recommendation.market, new Map());
        }

        const selections = marketSelections.get(recommendation.market)!;

        if (!selections.has(recommendation.selection)) {
          selections.set(recommendation.selection, []);
        }

        selections.get(recommendation.selection)!.push(recommendation);
      }
    }

    const decisions: FinalMarketDecision[] = [];

    for (const [market, selections] of marketSelections) {
      const candidates: FinalMarketCandidate[] = [];

      for (const [selection, recommendations] of selections) {
        const aggregate =
          this.signalAggregatorService.combineRecommendation(recommendations);

        const calibration =
          calibrationBySelection.get(`${market}:${selection}`) ?? 70;

        const confidence = this.confidenceService.calculate(
          aggregate.probability,
          aggregate.dataQuality,
          aggregate.sourceAgreement,
          calibration,
          aggregate.dataQuality,
        );

        const odds = this.oddsService.calculateFairOdds(aggregate.probability);

        const reasonCodes = this.collectReasonCodes(recommendations);

        candidates.push({
          market: market as FinalMarketCandidate['market'],

          selection,

          label:
            recommendations.find((item) => item.selection === selection)
              ?.selection ?? selection,

          probability: aggregate.probability,

          confidence,

          odds,

          sourceAgreement: aggregate.sourceAgreement,

          dataQuality: aggregate.dataQuality,

          calibration,

          availableSources: aggregate.availableSources,

          reasonCodes,
        });
      }

      const validCandidates = candidates.filter(
        (candidate) =>
          candidate.probability >= 30 &&
          candidate.confidence >= 50 &&
          candidate.dataQuality >= 40,
      );

      if (validCandidates.length === 0) {
        decisions.push({
          market,

          status: PredictionStatus.INSUFFICIENT_DATA,

          candidates,
        });

        continue;
      }

      const recommendations = this.selectRiskRecommendations(validCandidates);

      decisions.push({
        market,

        status:
          recommendations.low || recommendations.medium || recommendations.high
            ? PredictionStatus.COMPLETED
            : PredictionStatus.INSUFFICIENT_DATA,

        candidates,

        ...recommendations,
      });
    }

    return decisions;
  }

  private selectRiskRecommendations(candidates: FinalMarketCandidate[]): {
    low?: FinalDecisionRecommendation;
    medium?: FinalDecisionRecommendation;
    high?: FinalDecisionRecommendation;
  } {
    const ordered = [...candidates].sort(
      (a, b) => b.probability - a.probability || b.confidence - a.confidence,
    );

    if (ordered.length === 0) {
      return {};
    }

    const lowCandidate =
      ordered.find(
        (candidate) =>
          candidate.probability >= 70 && candidate.confidence >= 80,
      ) ?? ordered[0];

    const remainingAfterLow = ordered.filter(
      (candidate) => candidate.selection !== lowCandidate.selection,
    );

    const mediumPool = remainingAfterLow.filter(
      (candidate) => candidate.probability >= 50 && candidate.probability < 70,
    );

    const mediumCandidate =
      mediumPool[0] ?? this.findClosestToProbability(remainingAfterLow, 60);

    const remainingAfterMedium = remainingAfterLow.filter(
      (candidate) =>
        !mediumCandidate || candidate.selection !== mediumCandidate.selection,
    );

    const highPool = remainingAfterMedium.filter(
      (candidate) => candidate.probability < 55,
    );

    const highCandidate =
      highPool[0] ?? this.findClosestToProbability(remainingAfterMedium, 40);

    return {
      low: this.toRecommendation(lowCandidate, PredictionRisk.LOW),

      medium:
        mediumCandidate && mediumCandidate.selection !== lowCandidate.selection
          ? this.toRecommendation(mediumCandidate, PredictionRisk.MEDIUM)
          : undefined,

      high:
        highCandidate &&
        highCandidate.selection !== lowCandidate.selection &&
        highCandidate.selection !== mediumCandidate?.selection
          ? this.toRecommendation(highCandidate, PredictionRisk.HIGH)
          : undefined,
    };
  }

  private toRecommendation(
    candidate: FinalMarketCandidate,
    risk: PredictionRisk,
  ): FinalDecisionRecommendation {
    return {
      risk,

      selection: candidate.selection,

      label: candidate.label,

      probability: candidate.probability,

      confidence: candidate.confidence,

      odds: candidate.odds,

      sourceAgreement: candidate.sourceAgreement,

      dataQuality: candidate.dataQuality,

      reasonCodes: candidate.reasonCodes,
    };
  }

  private findClosestToProbability(
    candidates: FinalMarketCandidate[],
    target: number,
  ): FinalMarketCandidate | undefined {
    if (candidates.length === 0) {
      return undefined;
    }

    return [...candidates].sort(
      (a, b) =>
        Math.abs(a.probability - target) - Math.abs(b.probability - target),
    )[0];
  }

  private collectReasonCodes(
    recommendations: PredictionSignalRecommendation[],
  ): string[] {
    return [
      ...new Set(
        recommendations.flatMap(
          (recommendation) => recommendation.reasonCodes ?? [],
        ),
      ),
    ];
  }
}
