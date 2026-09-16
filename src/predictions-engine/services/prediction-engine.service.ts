// src/predictions-engine/services/prediction-engine.service.ts

import { Injectable, Logger } from '@nestjs/common';

import { PredictionMarket } from '../enums/prediction-market.enum';
import { PredictionRisk } from '../enums/prediction-risk.enum';
import { PredictionSource } from '../enums/prediction-source.enum';

import { PredictionEngineResult } from '../interfaces/prediction-engine-result.interface';
import { PredictionResult } from '../interfaces/prediction-result.interface';
import { PredictionRunInput } from '../interfaces/prediction-run.interface';
import { MarketEvaluation } from '../interfaces/market-evaluation.interface';

import { ENABLED_PREDICTION_MARKETS } from '../config/prediction-markets.config';
import { PREDICTION_ENGINE_CONFIG } from '../config/prediction-engine.config';

import { RawPredictionDataService } from './raw-prediction-data.service';
import { RawPredictionFeatureService } from './raw-prediction-feature.service';
import { MarketEvaluationService } from './market-evaluation.service';

@Injectable()
export class PredictionEngineService {
  private readonly logger = new Logger(PredictionEngineService.name);

  constructor(
    private readonly rawPredictionDataService: RawPredictionDataService,
    private readonly rawPredictionFeatureService: RawPredictionFeatureService,
    private readonly marketEvaluationService: MarketEvaluationService,
  ) {}

  async generate(eventId: string): Promise<PredictionEngineResult | null> {
    const rawData = await this.rawPredictionDataService.getMatch(eventId);

    if (!rawData) {
      return null;
    }

    const features = this.rawPredictionFeatureService.build(rawData);

    const markets = this.getEnabledMarkets();

    const evaluations: MarketEvaluation[] = [];

    for (const market of markets) {
      const evaluation = await this.marketEvaluationService.evaluateMarket(
        features,
        market,
      );

      evaluations.push(evaluation);
    }

    /*
     * ----------------------------------------------------------
     * PUBLICATION PASS
     * ----------------------------------------------------------
     *
     * Every enabled market gets the strongest candidate produced
     * by the market evaluator.
     *
     * A prediction is published only when the final decision
     * accepts it. Low probability alone is not a rejection reason;
     * the final decision layer is responsible for evidence conflicts.
     */
    const predictions: PredictionResult[] = [];

    const selectedKeys = new Set<string>();

    for (const evaluation of evaluations) {
      const decision = evaluation.decision;

      if (!decision) {
        this.logger.warn(
          `Market evaluation returned no final decision: event=${eventId} market=${evaluation.market}`,
        );

        continue;
      }

      if (!decision.accepted) {
        this.logRejectedDecision(eventId, decision);

        continue;
      }

      const key = this.getPredictionKey(decision.market, decision.selection);

      if (selectedKeys.has(key)) {
        continue;
      }

      /*
       * MATCH_RESULT is different from every other market.
       *
       * The public confidence belongs to the complete HOME/DRAW/AWAY
       * distribution, not to the selected outcome independently.
       */
      const predictionConfidence =
        decision.market === PredictionMarket.MATCH_RESULT &&
        typeof evaluation.matchResultConfidence === 'number'
          ? evaluation.matchResultConfidence
          : decision.confidence;

      const prediction = this.buildPrediction(
        rawData,
        decision.market,
        decision.selection,
        decision.probability,
        predictionConfidence,
        decision.safetyScore,
        decision.modelAgreement,
        decision.dataQuality,
        decision.calibrationReliability,
        decision.risk,
        decision.decisionScore,
        decision.source,
        evaluation.matchResultProbabilities,
        evaluation.fairOdds,
      );

      predictions.push(prediction);

      selectedKeys.add(key);
    }

    predictions.sort((a, b) => b.decisionScore - a.decisionScore);

    const accepted = predictions.length;

    const rejected = Math.max(markets.length - accepted, 0);

    const run: PredictionRunInput = {
      eventId: rawData.fixture.eventId,

      competitionId: String(rawData.fixture.leagueId),

      season: rawData.fixture.season,

      fixtureDate: rawData.fixture.fixtureDate,

      homeTeam: {
        id: String(rawData.fixture.homeTeamId),

        name: rawData.homeTeam?.name ?? String(rawData.fixture.homeTeamId),
      },

      awayTeam: {
        id: String(rawData.fixture.awayTeamId),

        name: rawData.awayTeam?.name ?? String(rawData.fixture.awayTeamId),
      },

      predictions: predictions.map((prediction) => ({
        market: prediction.market,

        selection: prediction.selection,

        probability: prediction.probability,

        confidence: prediction.confidence,

        fairOdds: prediction.fairOdds,

        predictionId: this.getPredictionKey(
          prediction.market,
          prediction.selection,
        ),

        ...(prediction.market === PredictionMarket.MATCH_RESULT &&
        prediction.matchResultProbabilities
          ? {
              matchResultProbabilities: prediction.matchResultProbabilities,
            }
          : {}),
      })),
    };

    const strongestPrediction = this.getStrongestPrediction(predictions);

    const lowRiskCount = predictions.filter(
      (prediction) => prediction.risk === PredictionRisk.LOW,
    ).length;

    const mediumRiskCount = predictions.filter(
      (prediction) => prediction.risk === PredictionRisk.MEDIUM,
    ).length;

    const highRiskCount = predictions.filter(
      (prediction) => prediction.risk === PredictionRisk.HIGH,
    ).length;

    const result: PredictionEngineResult = {
      eventId,

      generatedAt: new Date(),

      run,

      predictions,

      marketsProcessed: markets.length,

      accepted,

      rejected,

      acceptedMarkets: predictions.map((prediction) =>
        this.getPredictionKey(prediction.market, prediction.selection),
      ),

      lowRiskCount,

      mediumRiskCount,

      highRiskCount,

      strongestPrediction,
    };

    this.logger.log(
      [
        `Prediction generation completed`,
        `event=${eventId}`,
        `markets=${markets.length}`,
        `accepted=${accepted}`,
        `rejected=${rejected}`,
      ].join(' '),
    );

    if (accepted === 0) {
      this.logger.warn(
        `No publishable predictions passed the evidence gate: event=${eventId}`,
      );
    }

    return result;
  }

  private logRejectedDecision(
    eventId: string,
    decision: NonNullable<MarketEvaluation['decision']>,
  ): void {
    this.logger.warn(
      [
        `Prediction rejected`,
        `event=${eventId}`,
        `market=${decision.market}`,
        `selection=${decision.selection}`,
        `probability=${this.formatNumber(decision.probability)}`,
        `confidence=${this.formatNumber(decision.confidence)}`,
        `safety=${this.formatNumber(decision.safetyScore)}`,
        `agreement=${this.formatNumber(decision.modelAgreement)}`,
        `dataQuality=${this.formatNumber(decision.dataQuality)}`,
        `calibration=${this.formatNumber(decision.calibrationReliability)}`,
        `decisionScore=${this.formatNumber(decision.decisionScore)}`,
        `risk=${decision.risk}`,
        `source=${decision.source}`,
        `reason=${decision.rejectionReason ?? 'UNKNOWN'}`,
      ].join(' | '),
    );
  }

  private buildPrediction(
    rawData: Awaited<
      ReturnType<RawPredictionDataService['getMatch']>
    > extends infer T
      ? NonNullable<T>
      : never,

    market: PredictionMarket,

    selection: string,

    probability: number,

    confidence: number,

    safetyScore: number,

    modelAgreement: number,

    dataQuality: number,

    calibrationReliability: number,

    risk: PredictionRisk,

    decisionScore: number,

    source: PredictionSource,

    matchResultProbabilities?: {
      home: number;
      draw: number;
      away: number;
    },

    fairOdds?: number,
  ): PredictionResult {
    return {
      eventId: rawData.fixture.eventId,

      competitionId: String(rawData.fixture.leagueId),

      season: rawData.fixture.season,

      fixtureDate: rawData.fixture.fixtureDate,

      homeTeamId: String(rawData.fixture.homeTeamId),

      awayTeamId: String(rawData.fixture.awayTeamId),

      homeTeamName:
        rawData.homeTeam?.name ?? String(rawData.fixture.homeTeamId),

      awayTeamName:
        rawData.awayTeam?.name ?? String(rawData.fixture.awayTeamId),

      market,

      selection,

      probability: this.clamp(probability, 0, 1),

      ...(market === PredictionMarket.MATCH_RESULT && matchResultProbabilities
        ? {
            matchResultProbabilities: {
              home: this.clamp(matchResultProbabilities.home, 0, 1),

              draw: this.clamp(matchResultProbabilities.draw, 0, 1),

              away: this.clamp(matchResultProbabilities.away, 0, 1),
            },
          }
        : {}),

      fairOdds:
        typeof fairOdds === 'number' && Number.isFinite(fairOdds)
          ? fairOdds
          : undefined,

      confidence: this.clamp(confidence, 0, 98),

      safetyScore: this.clamp(safetyScore, 0, 100),

      modelAgreement: this.clamp(modelAgreement, 0, 1),

      dataQuality: this.clamp(dataQuality, 0, 100),

      calibrationReliability: this.clamp(calibrationReliability, 0, 100),

      risk,

      decisionScore: this.clamp(decisionScore, 0, 1),

      source,

      modelVersion: PREDICTION_ENGINE_CONFIG.modelVersion,

      generatedAt: new Date(),
    };
  }

  private getEnabledMarkets(): PredictionMarket[] {
    return [
      ...new Set(
        ENABLED_PREDICTION_MARKETS.filter((item) => item.enabled).map(
          (item) => item.market,
        ),
      ),
    ];
  }

  private getStrongestPrediction(
    predictions: PredictionResult[],
  ): PredictionResult | null {
    if (!predictions.length) {
      return null;
    }

    return [...predictions].sort(
      (a, b) => b.decisionScore - a.decisionScore,
    )[0];
  }

  private getPredictionKey(
    market: PredictionMarket,
    selection: string,
  ): string {
    return `${market}:${selection}`;
  }

  private formatNumber(value: number): string {
    if (!Number.isFinite(value)) {
      return 'NaN';
    }

    return value.toFixed(3);
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
