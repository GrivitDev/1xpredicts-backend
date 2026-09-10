import { Injectable } from '@nestjs/common';

import { PredictionMarket } from '../enums/prediction-market.enum';

import { GoalProbabilityDistribution } from '../interfaces/prediction-probability.interface';

@Injectable()
export class DoubleChanceMarket {
  calculate(distribution: GoalProbabilityDistribution) {
    let home = 0;
    let draw = 0;
    let away = 0;

    for (const scoreline of distribution.scorelines) {
      if (scoreline.homeGoals > scoreline.awayGoals) {
        home += scoreline.probability;
      } else if (scoreline.homeGoals === scoreline.awayGoals) {
        draw += scoreline.probability;
      } else {
        away += scoreline.probability;
      }
    }

    return [
      {
        market: PredictionMarket.DOUBLE_CHANCE,
        selection: 'HOME_DRAW',
        label: '1X — Home or Draw',
        probability: this.clamp(home + draw),
      },
      {
        market: PredictionMarket.DOUBLE_CHANCE,
        selection: 'DRAW_AWAY',
        label: 'X2 — Draw or Away',
        probability: this.clamp(draw + away),
      },
      {
        market: PredictionMarket.DOUBLE_CHANCE,
        selection: 'HOME_AWAY',
        label: '12 — Home or Away',
        probability: this.clamp(home + away),
      },
    ];
  }

  private clamp(value: number): number {
    return Math.min(1, Math.max(0, value));
  }
}
