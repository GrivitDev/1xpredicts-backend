import { Injectable } from '@nestjs/common';

import { PredictionMarket } from '../enums/prediction-market.enum';

export interface HalfGoalDistribution {
  totalGoals: Record<number, number>;
}

@Injectable()
export class SecondHalfGoalsMarket {
  private readonly lines = [0.5, 1.5, 2.5, 3.5, 4.5];

  calculate(distribution: HalfGoalDistribution | null) {
    if (!distribution) {
      return [];
    }

    const results: Array<{
      market: PredictionMarket;
      selection: string;
      label: string;
      probability: number;
    }> = [];

    for (const line of this.lines) {
      const over = this.calculateGreaterThan(distribution.totalGoals, line);

      results.push(
        {
          market: PredictionMarket.SECOND_HALF_GOALS,
          selection: `OVER_${this.formatLine(line)}`,
          label: `Over ${line}`,
          probability: over,
        },
        {
          market: PredictionMarket.SECOND_HALF_GOALS,
          selection: `UNDER_${this.formatLine(line)}`,
          label: `Under ${line}`,
          probability: 1 - over,
        },
      );
    }

    return results;
  }

  private calculateGreaterThan(
    distribution: Record<number, number>,
    line: number,
  ): number {
    return this.clamp(
      Object.entries(distribution).reduce(
        (sum, [goals, probability]) =>
          Number(goals) > line ? sum + probability : sum,
        0,
      ),
    );
  }

  private formatLine(value: number): string {
    return String(value).replace('.', '_');
  }

  private clamp(value: number): number {
    return Math.min(1, Math.max(0, value));
  }
}
