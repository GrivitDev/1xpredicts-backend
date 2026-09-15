import { Injectable } from '@nestjs/common';

import { PredictionMarket } from '../../enums/prediction-market.enum';
import { MarketModel } from '../../interfaces/market-model.interface';
import { MarketModelInput } from '../../interfaces/market-model-input.interface';
import { ProbabilityModelResult } from '../../interfaces/probability-result.interface';

import { RawGoalModelUtil } from './raw-goal-model.util';

@Injectable()
export class FirstToScoreMarketEngine implements MarketModel {
  supports(market: PredictionMarket): boolean {
    return market === PredictionMarket.FIRST_TO_SCORE;
  }

  calculate(input: MarketModelInput): ProbabilityModelResult {
    const goalModel = RawGoalModelUtil.calculate(input.features);

    const homeRate = this.normalizeRate(input.features.home.scoredFirstRate);

    const awayRate = this.normalizeRate(input.features.away.scoredFirstRate);

    const h2hHomeRate = this.normalizeRate(
      input.features.h2h?.homeScoredFirstRate,
    );

    const h2hAwayRate = this.normalizeRate(
      input.features.h2h?.awayScoredFirstRate,
    );

    /*
     * When historical first-score data exists, it is useful.
     * When it does not exist, use the goal model instead of
     * converting missing data into NONE = 100%.
     */
    const goalModelProbabilities = this.calculateGoalModelFirstScore(goalModel);

    const hasTeamFirstScoreData = homeRate > 0 || awayRate > 0;

    const historicalHome = this.weightedAverage([
      {
        value: homeRate,
        weight: homeRate > 0 ? 0.65 : 0,
      },
      {
        value: h2hHomeRate,
        weight: h2hHomeRate > 0 ? 0.1 : 0,
      },
    ]);

    const historicalAway = this.weightedAverage([
      {
        value: awayRate,
        weight: awayRate > 0 ? 0.65 : 0,
      },
      {
        value: h2hAwayRate,
        weight: h2hAwayRate > 0 ? 0.1 : 0,
      },
    ]);

    let probabilities: {
      home: number;
      away: number;
      none: number;
    };

    if (hasTeamFirstScoreData || h2hHomeRate > 0 || h2hAwayRate > 0) {
      /*
       * Historical first-score evidence gets priority, while the
       * goal model remains a stabilizing fallback signal.
       */
      const home = this.weightedAverage([
        {
          value: historicalHome,
          weight: historicalHome > 0 ? 0.7 : 0,
        },
        {
          value: goalModelProbabilities.home,
          weight: 0.3,
        },
      ]);

      const away = this.weightedAverage([
        {
          value: historicalAway,
          weight: historicalAway > 0 ? 0.7 : 0,
        },
        {
          value: goalModelProbabilities.away,
          weight: 0.3,
        },
      ]);

      probabilities = this.normalizeProbabilities({
        home,
        away,
        none: goalModelProbabilities.none,
      });
    } else {
      /*
       * No first-score history is available.
       * Use the scoring model directly.
       */
      probabilities = goalModelProbabilities;
    }

    const probability = this.resolveSelection(input.selection, probabilities);

    const sampleSize = Math.max(input.features.overallSampleSize ?? 0, 0);

    const dataQuality = this.clamp(
      input.features.overallDataQuality ?? 0,
      0,
      100,
    );

    const firstScoreDataReliability = this.calculateFirstScoreDataReliability(
      homeRate,
      awayRate,
      h2hHomeRate,
      h2hAwayRate,
    );

    const modelReliability = this.clamp(
      (1 - Math.exp(-sampleSize / 20)) * 0.3 +
        (dataQuality / 100) * 0.45 +
        firstScoreDataReliability * 0.25,
    );

    return {
      market: input.market,
      selection: input.selection,
      probability,
      supportingProbability: probability,
      sampleSize,
      dataQuality,
      modelReliability,
      modelName: 'scored-first-rate-model',
      modelVersion: 'raw-first-score-v2',
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

  private calculateGoalModelFirstScore(
    model: ReturnType<typeof RawGoalModelUtil.calculate>,
  ): {
    home: number;
    away: number;
    none: number;
  } {
    /*
     * RawGoalModelUtil does not contain scoring-event order.
     *
     * We therefore estimate first scorer from the expected scoring
     * rates while retaining the actual probability of a 0-0 outcome
     * for NONE.
     */
    const homeLambda = this.clamp(model.homeLambda, 0, 5);

    const awayLambda = this.clamp(model.awayLambda, 0, 5);

    const totalLambda = homeLambda + awayLambda;

    const none = this.clamp(model.matrix[0]?.[0] ?? 0);

    if (totalLambda <= 0) {
      return {
        home: 0,
        away: 0,
        none: 1,
      };
    }

    const scoredMatchProbability = this.clamp(1 - none);

    const homeShare = homeLambda / totalLambda;

    const awayShare = awayLambda / totalLambda;

    return this.normalizeProbabilities({
      home: scoredMatchProbability * homeShare,
      away: scoredMatchProbability * awayShare,
      none,
    });
  }

  private calculateFirstScoreDataReliability(
    homeRate: number,
    awayRate: number,
    h2hHomeRate: number,
    h2hAwayRate: number,
  ): number {
    const teamData =
      homeRate > 0 && awayRate > 0 ? 1 : homeRate > 0 || awayRate > 0 ? 0.5 : 0;

    const h2hData =
      h2hHomeRate > 0 && h2hAwayRate > 0
        ? 1
        : h2hHomeRate > 0 || h2hAwayRate > 0
          ? 0.5
          : 0;

    return this.clamp(teamData * 0.7 + h2hData * 0.3);
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

  private normalizeProbabilities(input: {
    home: number;
    away: number;
    none: number;
  }): {
    home: number;
    away: number;
    none: number;
  } {
    const home = this.clamp(input.home);

    const away = this.clamp(input.away);

    const none = this.clamp(input.none);

    const total = home + away + none;

    if (total <= 0) {
      return {
        home: 0,
        away: 0,
        none: 1,
      };
    }

    return {
      home: home / total,
      away: away / total,
      none: none / total,
    };
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

    const totalWeight = valid.reduce((sum, entry) => sum + entry.weight, 0);

    if (totalWeight <= 0) {
      return 0;
    }

    return (
      valid.reduce((sum, entry) => sum + entry.value * entry.weight, 0) /
      totalWeight
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
