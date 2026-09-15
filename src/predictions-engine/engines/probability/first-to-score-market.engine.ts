import { Injectable } from '@nestjs/common';

import { PredictionMarket } from '../../enums/prediction-market.enum';
import { MarketModel } from '../../interfaces/market-model.interface';
import { MarketModelInput } from '../../interfaces/market-model-input.interface';
import { ProbabilityModelResult } from '../../interfaces/probability-result.interface';

@Injectable()
export class FirstToScoreMarketEngine implements MarketModel {
  supports(market: PredictionMarket): boolean {
    return market === PredictionMarket.FIRST_TO_SCORE;
  }

  calculate(input: MarketModelInput): ProbabilityModelResult {
    const homeRate = this.normalizeRate(input.features.home.scoredFirstRate);

    const awayRate = this.normalizeRate(input.features.away.scoredFirstRate);

    const h2hHomeRate = this.normalizeRate(
      input.features.h2h?.homeScoredFirstRate,
    );

    const h2hAwayRate = this.normalizeRate(
      input.features.h2h?.awayScoredFirstRate,
    );

    const homeScoreFirst = this.weightedAverage([
      {
        value: homeRate,
        weight: 0.65,
      },
      {
        value: h2hHomeRate,
        weight: h2hHomeRate > 0 ? 0.1 : 0,
      },
    ]);

    const awayScoreFirst = this.weightedAverage([
      {
        value: awayRate,
        weight: 0.65,
      },
      {
        value: h2hAwayRate,
        weight: h2hAwayRate > 0 ? 0.1 : 0,
      },
    ]);

    const none = this.clamp(1 - homeScoreFirst - awayScoreFirst, 0, 1);

    const total = homeScoreFirst + awayScoreFirst + none;

    const probabilities =
      total > 0
        ? {
            home: homeScoreFirst / total,
            away: awayScoreFirst / total,
            none: none / total,
          }
        : {
            home: 0,
            away: 0,
            none: 1,
          };

    const probability = this.resolveSelection(input.selection, probabilities);

    const sampleSize = Math.max(input.features.overallSampleSize ?? 0, 0);

    const dataQuality = this.clamp(
      input.features.overallDataQuality ?? 0,
      0,
      100,
    );

    return {
      market: input.market,
      selection: input.selection,
      probability,
      supportingProbability: probability,
      sampleSize,
      dataQuality,
      modelReliability: this.clamp(
        (1 - Math.exp(-sampleSize / 20)) * 0.35 +
          (dataQuality / 100) * 0.4 +
          (homeRate + awayRate > 0 ? 0.25 : 0),
      ),
      modelName: 'scored-first-rate-model',
      modelVersion: 'raw-first-score-v1',
      modelOutputs: {
        home: probabilities.home,
        away: probabilities.away,
        none: probabilities.none,
      },
      modelSignals: {
        home: probabilities.home,
        away: probabilities.away,
        none: probabilities.none,
      },
    };
  }

  private resolveSelection(
    selection: string,
    probabilities: {
      home: number;
      away: number;
      none: number;
    },
  ): number {
    switch (selection.trim().toUpperCase()) {
      case 'HOME':
      case '1':
      case 'HOME_FIRST':
        return probabilities.home;

      case 'AWAY':
      case '2':
      case 'AWAY_FIRST':
        return probabilities.away;

      case 'NONE':
      case 'NO_GOAL':
      case 'NO_SCORE':
      case '0':
        return probabilities.none;

      default:
        return 0;
    }
  }

  private weightedAverage(
    values: Array<{
      value: number;
      weight: number;
    }>,
  ): number {
    const valid = values.filter(
      (entry) =>
        Number.isFinite(entry.value) && entry.value >= 0 && entry.weight > 0,
    );

    if (!valid.length) {
      return 0;
    }

    const weight = valid.reduce((sum, entry) => sum + entry.weight, 0);

    if (weight <= 0) {
      return 0;
    }

    return (
      valid.reduce((sum, entry) => sum + entry.value * entry.weight, 0) / weight
    );
  }

  private normalizeRate(value: number | null | undefined): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      return 0;
    }

    if (value > 1) {
      return this.clamp(value / 100);
    }

    return this.clamp(value);
  }

  private clamp(value: number, minimum = 0, maximum = 1): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
