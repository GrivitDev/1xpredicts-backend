import { Injectable, Logger } from '@nestjs/common';

import { PredictionMarket } from '../enums/prediction-market.enum';
import { PredictionRisk } from '../enums/prediction-risk.enum';
import { PredictionSource } from '../enums/prediction-source.enum';

import { PredictionEngineResult } from '../interfaces/prediction-engine-result.interface';
import { PredictionResult } from '../interfaces/prediction-result.interface';
import { PredictionRunInput } from '../interfaces/prediction-run.interface';
import { EnsembleResult } from '../interfaces/ensemble-result.interface';
import { MarketEvaluation } from '../interfaces/market-evaluation.interface';

import { ENABLED_PREDICTION_MARKETS } from '../config/prediction-markets.config';
import { PREDICTION_ENGINE_CONFIG } from '../config/prediction-engine.config';

import { DecisionScoreUtil } from '../utils/decision-score.util';

import { RawPredictionDataService } from './raw-prediction-data.service';
import { RawPredictionFeatureService } from './raw-prediction-feature.service';
import { MarketEvaluationService } from './market-evaluation.service';

@Injectable()
export class PredictionEngineService {
  private readonly logger = new Logger(PredictionEngineService.name);

  private readonly minimumPredictionsPerFixture = 6;

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
     * FIRST PASS
     * ----------------------------------------------------------
     *
     * Take every normal accepted market decision.
     *
     * There is intentionally NO six-prediction limit here.
     *
     * Every genuinely publishable market should survive.
     */
    const predictions: PredictionResult[] = [];

    const selectedKeys = new Set<string>();

    for (const evaluation of evaluations) {
      if (!evaluation.decision) {
        continue;
      }

      if (!evaluation.decision.accepted) {
        continue;
      }

      const key = this.getPredictionKey(
        evaluation.decision.market,
        evaluation.decision.selection,
      );

      if (selectedKeys.has(key)) {
        continue;
      }

      const prediction = this.buildPrediction(
        rawData,
        evaluation.decision.market,
        evaluation.decision.selection,
        evaluation.decision.probability,
        evaluation.decision.confidence,
        evaluation.decision.safetyScore,
        evaluation.decision.modelAgreement,
        evaluation.decision.dataQuality,
        evaluation.decision.calibrationReliability,
        evaluation.decision.risk,
        evaluation.decision.decisionScore,
        evaluation.decision.source,
      );

      predictions.push(prediction);

      selectedKeys.add(key);
    }

    /*
     * ----------------------------------------------------------
     * SECOND PASS
     * ----------------------------------------------------------
     *
     * Six is a FLOOR, not a ceiling.
     *
     * We inspect the strongest valid candidate from every market
     * family that did not already publish a prediction.
     *
     * This means:
     *
     *   6 strong markets  -> 6
     *   8 strong markets  -> 8
     *   12 strong markets -> 12
     *
     * We do NOT manufacture weak predictions simply to reach six.
     *
     * The fallback only exists to recover strong candidates that
     * were not accepted by the normal final-decision gate.
     */
    const fallbackCandidates = this.getFallbackCandidates(
      evaluations,
      selectedKeys,
    );

    for (const candidate of fallbackCandidates) {
      const key = this.getPredictionKey(candidate.market, candidate.selection);

      if (selectedKeys.has(key)) {
        continue;
      }

      /*
       * Do not stop at six.
       *
       * Every remaining valid market candidate is allowed to be
       * considered and published.
       */
      predictions.push(
        this.buildPrediction(
          rawData,
          candidate.market,
          candidate.selection,
          candidate.probability,
          candidate.confidence,
          candidate.safetyResult.safetyScore,
          candidate.modelAgreement,
          candidate.dataQuality,
          candidate.calibrationReliability,
          candidate.safetyResult.risk,
          this.calculateDecisionScore(candidate),
          PredictionSource.ENSEMBLE,
        ),
      );

      selectedKeys.add(key);
    }

    /*
     * Order the final predictions by decision strength so the
     * strongest selections appear first.
     */
    predictions.sort((a, b) => b.decisionScore - a.decisionScore);

    /*
     * This represents the number of market families for which
     * the engine produced a final prediction.
     */
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
      `Prediction generation completed: event=${eventId} markets=${markets.length} accepted=${accepted} rejected=${rejected} minimum=${this.minimumPredictionsPerFixture}`,
    );

    if (accepted < this.minimumPredictionsPerFixture) {
      this.logger.warn(
        `Prediction generation produced fewer than ${this.minimumPredictionsPerFixture} valid predictions: event=${eventId} count=${accepted}`,
      );
    }

    return result;
  }

  private getFallbackCandidates(
    evaluations: MarketEvaluation[],
    selectedKeys: Set<string>,
  ): EnsembleResult[] {
    const candidates: EnsembleResult[] = [];

    for (const evaluation of evaluations) {
      /*
       * The market evaluation contains potentially multiple
       * candidates for the same market family.
       *
       * We select only the strongest valid candidate for that
       * family so one market cannot flood the fixture with
       * duplicate selections.
       */
      const available = evaluation.candidates.filter((candidate) => {
        const key = this.getPredictionKey(
          candidate.market,
          candidate.selection,
        );

        if (selectedKeys.has(key)) {
          return false;
        }

        return (
          Number.isFinite(candidate.probability) &&
          candidate.probability > 0 &&
          Number.isFinite(candidate.confidence) &&
          candidate.confidence > 0 &&
          Number.isFinite(candidate.safetyResult.safetyScore) &&
          candidate.safetyResult.safetyScore > 0 &&
          Number.isFinite(candidate.modelAgreement) &&
          candidate.modelAgreement >= 0 &&
          Number.isFinite(candidate.dataQuality) &&
          candidate.dataQuality >= 0 &&
          Number.isFinite(candidate.calibrationReliability) &&
          candidate.calibrationReliability >= 0
        );
      });

      if (!available.length) {
        continue;
      }

      const strongest = [...available].sort(
        (a, b) =>
          this.calculateDecisionScore(b) - this.calculateDecisionScore(a),
      )[0];

      if (strongest) {
        candidates.push(strongest);
      }
    }

    /*
     * Strongest candidates are published first, but ALL valid
     * market-family candidates remain eligible.
     *
     * Six is therefore only the minimum fixture requirement.
     */
    return candidates.sort(
      (a, b) => this.calculateDecisionScore(b) - this.calculateDecisionScore(a),
    );
  }

  private calculateDecisionScore(candidate: EnsembleResult): number {
    return DecisionScoreUtil.calculate({
      probability: this.clamp(candidate.probability, 0, 1),

      confidence: this.clamp(candidate.confidence, 0, 98),

      safetyScore: this.clamp(candidate.safetyResult.safetyScore, 0, 100),

      modelAgreement: this.clamp(candidate.modelAgreement, 0, 1),

      dataQuality: this.clamp(candidate.dataQuality, 0, 100),

      calibrationReliability: this.clamp(
        candidate.calibrationReliability,
        0,
        100,
      ),
    }).total;
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

  private clamp(value: number, minimum: number, maximum: number): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
