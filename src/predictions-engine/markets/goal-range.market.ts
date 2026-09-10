import { Injectable } from '@nestjs/common';

import { PredictionMarket } from '../enums/prediction-market.enum';

import { GoalProbabilityDistribution } from '../interfaces/prediction-probability.interface';

@Injectable()
export class GoalRangeMarket {
  calculate(distribution: GoalProbabilityDistribution) {
    const ranges = [
      {
        selection: 'GOALS_0_1',
        label: '0–1 Goals',
        minimum: 0,
        maximum: 1,
      },
      {
        selection: 'GOALS_2_3',
        label: '2–3 Goals',
        minimum: 2,
        maximum: 3,
      },
      {
        selection: 'GOALS_4_5',
        label: '4–5 Goals',
        minimum: 4,
        maximum: 5,
      },
      {
        selection: 'GOALS_6_7',
        label: '6–7 Goals',
        minimum: 6,
        maximum: 7,
      },
      {
        selection: 'GOALS_8_PLUS',
        label: '8+ Goals',
        minimum: 8,
        maximum: Number.POSITIVE_INFINITY,
      },
    ];

    return ranges.map((range) => {
      const probability = Object.entries(distribution.totalGoals).reduce(
        (sum, [goals, value]) => {
          const totalGoals = Number(goals);

          if (totalGoals >= range.minimum && totalGoals <= range.maximum) {
            return sum + value;
          }

          return sum;
        },
        0,
      );

      return {
        market: PredictionMarket.GOAL_RANGE,
        selection: range.selection,
        label: range.label,
        probability: this.clamp(probability),
      };
    });
  }

  private clamp(value: number): number {
    return Math.min(1, Math.max(0, value));
  }
}
