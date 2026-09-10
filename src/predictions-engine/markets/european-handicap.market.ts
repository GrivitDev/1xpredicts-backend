import { Injectable } from '@nestjs/common';

import { PredictionMarket } from '../enums/prediction-market.enum';

import { GoalProbabilityDistribution } from '../interfaces/prediction-probability.interface';

export interface EuropeanHandicapResult {
  market: PredictionMarket;

  selection: string;

  label: string;

  probability: number;
}

@Injectable()
export class EuropeanHandicapMarket {
  private readonly handicaps = [-3, -2, -1, 0, 1, 2, 3];

  calculate(
    distribution: GoalProbabilityDistribution,
  ): EuropeanHandicapResult[] {
    const results: EuropeanHandicapResult[] = [];

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
  ): EuropeanHandicapResult {
    let homeResult = 0;
    let awayResult = 0;

    for (const scoreline of distribution.scorelines) {
      const adjustedDifference = home
        ? scoreline.homeGoals + handicap - scoreline.awayGoals
        : scoreline.homeGoals - (scoreline.awayGoals + handicap);

      if (adjustedDifference > 0) {
        homeResult += scoreline.probability;
      } else {
        awayResult += scoreline.probability;
      }
    }

    const requestedSide = home ? 'home' : 'away';

    let probability: number;

    let selection: string;

    let label: string;

    if (requestedSide === 'home') {
      probability = homeResult;

      selection = `HOME_${this.formatNumber(handicap)}`;

      label = `Home ${this.formatLabel(handicap)}`;
    } else {
      probability = awayResult;

      selection = `AWAY_${this.formatNumber(handicap)}`;

      label = `Away ${this.formatLabel(handicap)}`;
    }

    /**
     * European Handicap is a three-way market.
     *
     * For a specific team handicap selection, the probability
     * represents that adjusted team winning.
     *
     * The full adjusted result distribution remains available
     * through calculateThreeWay().
     */
    return {
      market: PredictionMarket.EUROPEAN_HANDICAP,
      selection,
      label,
      probability: this.clamp(probability),
    };
  }

  calculateThreeWay(
    distribution: GoalProbabilityDistribution,
    home: boolean,
    handicap: number,
  ) {
    let homeResult = 0;
    let drawResult = 0;
    let awayResult = 0;

    for (const scoreline of distribution.scorelines) {
      const adjustedDifference = home
        ? scoreline.homeGoals + handicap - scoreline.awayGoals
        : scoreline.homeGoals - (scoreline.awayGoals + handicap);

      if (adjustedDifference > 0) {
        homeResult += scoreline.probability;
      } else if (adjustedDifference === 0) {
        drawResult += scoreline.probability;
      } else {
        awayResult += scoreline.probability;
      }
    }

    return {
      home: this.clamp(homeResult),
      draw: this.clamp(drawResult),
      away: this.clamp(awayResult),
    };
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

  private formatLabel(value: number): string {
    if (value > 0) {
      return `+${value}`;
    }

    return `${value}`;
  }

  private clamp(value: number): number {
    return Math.min(1, Math.max(0, value));
  }
}
