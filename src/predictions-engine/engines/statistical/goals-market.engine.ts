import { Injectable } from '@nestjs/common';

import { PredictionMarket } from '../../enums/prediction-market.enum';

import { GoalProbabilityDistribution } from '../../interfaces/prediction-probability.interface';

@Injectable()
export class GoalsMarketEngine {
  private readonly lines = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5];

  calculateOverUnder(distribution: GoalProbabilityDistribution) {
    return this.lines.flatMap((line) => {
      const over = this.totalGoalsGreaterThan(distribution, line);

      return [
        {
          market: PredictionMarket.OVER_UNDER,
          selection: `OVER_${this.formatLine(line)}`,
          label: `Over ${line}`,
          probability: over,
        },
        {
          market: PredictionMarket.OVER_UNDER,
          selection: `UNDER_${this.formatLine(line)}`,
          label: `Under ${line}`,
          probability: this.clamp(1 - over),
        },
      ];
    });
  }

  calculateTeamGoals(distribution: GoalProbabilityDistribution) {
    const results: Array<{
      market: PredictionMarket;
      selection: string;
      label: string;
      probability: number;
    }> = [];

    for (const line of [0.5, 1.5, 2.5, 3.5, 4.5]) {
      const homeOver = this.teamGoalsGreaterThan(distribution.homeGoals, line);

      const awayOver = this.teamGoalsGreaterThan(distribution.awayGoals, line);

      results.push(
        {
          market: PredictionMarket.TEAM_TOTAL_GOALS,
          selection: `HOME_OVER_${this.formatLine(line)}`,
          label: `Home Over ${line}`,
          probability: homeOver,
        },
        {
          market: PredictionMarket.TEAM_TOTAL_GOALS,
          selection: `HOME_UNDER_${this.formatLine(line)}`,
          label: `Home Under ${line}`,
          probability: this.clamp(1 - homeOver),
        },
        {
          market: PredictionMarket.TEAM_TOTAL_GOALS,
          selection: `AWAY_OVER_${this.formatLine(line)}`,
          label: `Away Over ${line}`,
          probability: awayOver,
        },
        {
          market: PredictionMarket.TEAM_TOTAL_GOALS,
          selection: `AWAY_UNDER_${this.formatLine(line)}`,
          label: `Away Under ${line}`,
          probability: this.clamp(1 - awayOver),
        },
      );
    }

    return results;
  }

  private totalGoalsGreaterThan(
    distribution: GoalProbabilityDistribution,
    line: number,
  ): number {
    return this.clamp(
      Object.entries(distribution.totalGoals).reduce(
        (sum, [goals, probability]) =>
          Number(goals) > line ? sum + probability : sum,
        0,
      ),
    );
  }

  private teamGoalsGreaterThan(
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
