import { Injectable, Logger } from '@nestjs/common';

import { PredictionMarket } from '../enums/prediction-market.enum';

import { PredictionEngineResult } from '../interfaces/prediction-engine-result.interface';
import { PredictionResult } from '../interfaces/prediction-result.interface';
import { PredictionRunInput } from '../interfaces/prediction-run.interface';

import { RawPredictionDataService } from './raw-prediction-data.service';
import { RawPredictionFeatureService } from './raw-prediction-feature.service';
import { MarketEvaluationService } from './market-evaluation.service';

import { ENABLED_PREDICTION_MARKETS } from '../config/prediction-markets.config';
import { PredictionRisk } from '../enums/prediction-risk.enum';

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

    const features = await this.rawPredictionFeatureService.build(rawData);

    const markets = this.getEnabledMarkets();

    const predictions: PredictionResult[] = [];

    let rejected = 0;

    for (const market of markets) {
      const evaluation = await this.marketEvaluationService.evaluateMarket(
        features,
        market,
      );

      if (!evaluation?.decision) {
        rejected++;
        continue;
      }

      if (!evaluation.decision.accepted) {
        rejected++;
        continue;
      }

      const decision = evaluation.decision;

      predictions.push({
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

        market: decision.market,
        selection: decision.selection,

        probability: decision.probability,
        confidence: decision.confidence,

        safetyScore: decision.safetyScore,
        modelAgreement: decision.modelAgreement,
        dataQuality: decision.dataQuality,
        calibrationReliability: decision.calibrationReliability,

        risk: decision.risk,
        decisionScore: decision.decisionScore,

        source: decision.source,
        modelVersion: 'raw-ensemble-v1',

        generatedAt: new Date(),
      });
    }

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

      accepted: predictions.length,

      rejected,

      acceptedMarkets: predictions.map(
        (prediction) => `${prediction.market}:${prediction.selection}`,
      ),

      lowRiskCount,
      mediumRiskCount,
      highRiskCount,

      strongestPrediction,
    };

    this.logger.log(
      `Prediction generation completed: event=${eventId} markets=${markets.length} accepted=${predictions.length} rejected=${rejected}`,
    );

    return result;
  }

  private getEnabledMarkets(): PredictionMarket[] {
    const config = ENABLED_PREDICTION_MARKETS as unknown as {
      markets?:
        | Record<
            string,
            {
              enabled?: boolean;
            }
          >
        | Array<{
            market: PredictionMarket;
            enabled?: boolean;
          }>;
    };

    if (!config.markets) {
      return Object.values(PredictionMarket);
    }

    if (Array.isArray(config.markets)) {
      return config.markets
        .filter((item) => item.enabled !== false)
        .map((item) => item.market);
    }

    return Object.entries(config.markets)
      .filter(([, value]) => value?.enabled !== false)
      .map(([market]) => market as PredictionMarket);
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
}
