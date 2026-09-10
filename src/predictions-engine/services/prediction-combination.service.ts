import { Injectable } from '@nestjs/common';

import { MarketRecommendation } from '../interfaces/market-recommendation.interface';

export interface CombinedPredictionSelection {
  selection: string;
  probability: number;
  confidence: number;
}

export interface CombinedPredictionResult {
  probability: number;
  confidence: number;
  fairOdds: number;
  selections: CombinedPredictionSelection[];
}

@Injectable()
export class PredictionCombinationService {
  combine(recommendations: MarketRecommendation[]): CombinedPredictionResult {
    const selections = recommendations
      .filter(
        (recommendation) =>
          recommendation &&
          recommendation.selection &&
          recommendation.probability > 0,
      )
      .map((recommendation) => ({
        selection: recommendation.selection,
        probability: recommendation.probability,
        confidence: recommendation.confidence,
      }));

    if (!selections.length) {
      return {
        probability: 0,
        confidence: 0,
        fairOdds: 0,
        selections: [],
      };
    }

    const probability = selections.reduce(
      (product, selection) => product * selection.probability,
      1,
    );

    const confidence =
      selections.reduce((sum, selection) => sum + selection.confidence, 0) /
      selections.length;

    return {
      probability,
      confidence,
      fairOdds: probability > 0 ? 1 / probability : 0,
      selections,
    };
  }
}
