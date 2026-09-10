import { Injectable } from '@nestjs/common';

import { PredictionMarket } from '../enums/prediction-market.enum';

import { GoalProbabilityDistribution } from '../interfaces/prediction-probability.interface';

@Injectable()
export class DrawNoBetMarket {
  calculate(distribution: GoalProbabilityDistribution) {
    let home = 0;

    let away = 0;

    for (const scoreline of distribution.scorelines) {
      if (scoreline.homeGoals > scoreline.awayGoals) {
        home += scoreline.probability;
      } else if (scoreline.homeGoals < scoreline.awayGoals) {
        away += scoreline.probability;
      }
    }

    const decisiveProbability = home + away;

    if (decisiveProbability <= 0) {
      return [
        {
          market: PredictionMarket.DRAW_NO_BET,
          selection: 'HOME',
          label: 'Home',
          probability: 0.5,
        },
        {
          market: PredictionMarket.DRAW_NO_BET,
          selection: 'AWAY',
          label: 'Away',
          probability: 0.5,
        },
      ];
    }

    return [
      {
        market: PredictionMarket.DRAW_NO_BET,
        selection: 'HOME',
        label: 'Home',
        probability: this.clamp(home / decisiveProbability),
      },
      {
        market: PredictionMarket.DRAW_NO_BET,
        selection: 'AWAY',
        label: 'Away',
        probability: this.clamp(away / decisiveProbability),
      },
    ];
  }

  private clamp(value: number): number {
    return Math.min(1, Math.max(0, value));
  }
}
