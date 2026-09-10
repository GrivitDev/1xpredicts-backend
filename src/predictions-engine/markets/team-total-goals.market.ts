import { Injectable } from '@nestjs/common';

import { PredictionMarket } from '../enums/prediction-market.enum';

import { GoalProbabilityDistribution } from '../interfaces/prediction-probability.interface';

@Injectable()
export class TeamTotalGoalsMarket {
  private readonly lines = [0.5, 1.5, 2.5, 3.5, 4.5];

  calculate(distribution: GoalProbabilityDistribution) {
    const results: Array<{
      market: PredictionMarket;
      selection: string;
      label: string;
      probability: number;
    }> = [];

    for (const line of this.lines) {
      const homeOver = this.greaterThan(distribution.homeGoals, line);

      const awayOver = this.greaterThan(distribution.awayGoals, line);

      results.push(
        {
          market: PredictionMarket.TEAM_TOTAL_GOALS,
          selection: `HOME_OVER_${String(line).replace('.', '_')}`,
          label: `Home Over ${line}`,
          probability: homeOver,
        },
        {
          market: PredictionMarket.TEAM_TOTAL_GOALS,
          selection: `HOME_UNDER_${String(line).replace('.', '_')}`,
          label: `Home Under ${line}`,
          probability: 1 - homeOver,
        },
        {
          market: PredictionMarket.TEAM_TOTAL_GOALS,
          selection: `AWAY_OVER_${String(line).replace('.', '_')}`,
          label: `Away Over ${line}`,
          probability: awayOver,
        },
        {
          market: PredictionMarket.TEAM_TOTAL_GOALS,
          selection: `AWAY_UNDER_${String(line).replace('.', '_')}`,
          label: `Away Under ${line}`,
          probability: 1 - awayOver,
        },
      );
    }

    return results;
  }

  private greaterThan(
    distribution: Record<number, number>,
    line: number,
  ): number {
    let probability = 0;

    for (const [goals, value] of Object.entries(distribution)) {
      if (Number(goals) > line) {
        probability += value;
      }
    }

    return this.clamp(probability);
  }

  private clamp(value: number): number {
    return Math.min(1, Math.max(0, value));
  }
}
