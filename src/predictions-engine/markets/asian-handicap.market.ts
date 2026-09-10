import { Injectable } from '@nestjs/common';

import { PredictionMarket } from '../enums/prediction-market.enum';

import { GoalProbabilityDistribution } from '../interfaces/prediction-probability.interface';

export interface AsianHandicapResult {
  market: PredictionMarket;

  selection: string;

  label: string;

  probability: number;

  pushProbability: number;

  lossProbability: number;
}

@Injectable()
export class AsianHandicapMarket {
  private readonly handicaps = [
    -3.5, -3, -2.5, -2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2, 2.5, 3, 3.5,
  ];

  calculate(distribution: GoalProbabilityDistribution): AsianHandicapResult[] {
    const results: AsianHandicapResult[] = [];

    for (const handicap of this.handicaps) {
      results.push(
        this.calculateSelection(distribution, true, handicap),
        this.calculateSelection(distribution, false, handicap),
      );
    }

    return results;
  }

  private calculateSelection(
    distribution: GoalProbabilityDistribution,
    home: boolean,
    handicap: number,
  ): AsianHandicapResult {
    let win = 0;
    let push = 0;
    let loss = 0;

    for (const scoreline of distribution.scorelines) {
      const goalDifference = home
        ? scoreline.homeGoals - scoreline.awayGoals
        : scoreline.awayGoals - scoreline.homeGoals;

      const adjusted = goalDifference + handicap;

      if (adjusted > 0) {
        win += scoreline.probability;
      } else if (adjusted === 0) {
        push += scoreline.probability;
      } else {
        loss += scoreline.probability;
      }
    }

    const selection = this.buildSelection(home, handicap);

    return {
      market: PredictionMarket.ASIAN_HANDICAP,
      selection,
      label: this.buildLabel(home, handicap),
      probability: this.clamp(win),
      pushProbability: this.clamp(push),
      lossProbability: this.clamp(loss),
    };
  }

  private buildSelection(home: boolean, handicap: number): string {
    const side = home ? 'HOME' : 'AWAY';

    const number = this.formatNumber(handicap);

    return `${side}_${number}`;
  }

  private buildLabel(home: boolean, handicap: number): string {
    const side = home ? 'Home' : 'Away';

    const formatted = handicap > 0 ? `+${handicap}` : `${handicap}`;

    return `${side} ${formatted}`;
  }

  private formatNumber(value: number): string {
    if (value > 0) {
      return `PLUS_${String(value).replace('.', '_')}`;
    }

    if (value < 0) {
      return `MINUS_${String(Math.abs(value)).replace('.', '_')}`;
    }

    return '0';
  }

  private clamp(value: number): number {
    return Math.min(1, Math.max(0, value));
  }
}
