import { Injectable } from '@nestjs/common';

import {
  PredictionSignal,
  PredictionSignalRecommendation,
} from '../interfaces/prediction-signal.interface';

import { clampPercentage, weightedAverage } from '../utils/probability.util';

@Injectable()
export class SignalAggregatorService {
  combineRecommendation(recommendations: PredictionSignalRecommendation[]): {
    probability: number;
    confidence: number;
    sourceAgreement: number;
    dataQuality: number;
    availableSources: number;
  } {
    if (recommendations.length === 0) {
      return {
        probability: 0,
        confidence: 0,
        sourceAgreement: 0,
        dataQuality: 0,
        availableSources: 0,
      };
    }

    const probability = weightedAverage(
      recommendations.map((item) => ({
        value: clampPercentage(item.probability),
        weight: 1,
      })),
    );

    const confidence = weightedAverage(
      recommendations.map((item) => ({
        value: clampPercentage(item.confidence),
        weight: 1,
      })),
    );

    const dataQuality = weightedAverage(
      recommendations.map((item) => ({
        value: clampPercentage(item.confidence),
        weight: 1,
      })),
    );

    const probabilityValues = recommendations.map((item) =>
      clampPercentage(item.probability),
    );

    const mean =
      probabilityValues.reduce((sum, value) => sum + value, 0) /
      probabilityValues.length;

    const deviation =
      probabilityValues.reduce(
        (sum, value) => sum + Math.abs(value - mean),
        0,
      ) / probabilityValues.length;

    const sourceAgreement = Math.max(0, Math.min(100, 100 - deviation * 2));

    return {
      probability: Number(probability.toFixed(2)),

      confidence: Number(confidence.toFixed(2)),

      sourceAgreement: Number(sourceAgreement.toFixed(2)),

      dataQuality: Number(dataQuality.toFixed(2)),

      availableSources: recommendations.length,
    };
  }

  findMatchingRecommendations(
    signals: PredictionSignal[],
    market: string,
    selection: string,
  ): PredictionSignalRecommendation[] {
    const results: PredictionSignalRecommendation[] = [];

    for (const signal of signals) {
      if (!signal.recommendations?.length) {
        continue;
      }

      for (const recommendation of signal.recommendations) {
        if (
          recommendation.market === market &&
          recommendation.selection === selection
        ) {
          results.push(recommendation);
        }
      }
    }

    return results;
  }
}
