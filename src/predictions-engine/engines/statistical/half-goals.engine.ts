import { Injectable } from '@nestjs/common';

export interface HalfGoalMarketProbability {
  selection: string;
  probability: number;
}

@Injectable()
export class HalfGoalsEngine {
  private readonly lines = [0.5, 1.5, 2.5, 3.5, 4.5];

  generate(goalDistribution: number[]): HalfGoalMarketProbability[] {
    const results: HalfGoalMarketProbability[] = [];

    for (const line of this.lines) {
      const threshold = Math.floor(line) + 1;

      let underProbability = 0;
      let overProbability = 0;

      for (let goals = 0; goals < goalDistribution.length; goals += 1) {
        const probability = goalDistribution[goals] ?? 0;

        if (goals >= threshold) {
          overProbability += probability;
        } else {
          underProbability += probability;
        }
      }

      results.push({
        selection: `Over ${line}`,
        probability: this.clamp(overProbability),
      });

      results.push({
        selection: `Under ${line}`,
        probability: this.clamp(underProbability),
      });
    }

    return results;
  }

  calculateFromExpectedGoals(
    expectedGoals: number,
  ): HalfGoalMarketProbability[] {
    const distribution = this.poissonDistribution(
      Math.max(0, expectedGoals),
      10,
    );

    return this.generate(distribution);
  }

  private poissonDistribution(lambda: number, maximumGoals: number): number[] {
    const values: number[] = [];
    const first = Math.exp(-lambda);

    values.push(first);

    for (let goals = 1; goals <= maximumGoals; goals += 1) {
      values.push(values[goals - 1] * (lambda / goals));
    }

    const total = values.reduce((sum, value) => sum + value, 0);

    if (total <= 0) {
      return values.map(() => 0);
    }

    return values.map((value) => value / total);
  }

  private clamp(value: number): number {
    return Math.min(1, Math.max(0, value));
  }
}
