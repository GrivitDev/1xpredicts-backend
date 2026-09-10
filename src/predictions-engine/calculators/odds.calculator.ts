import { Injectable } from '@nestjs/common';

import { clampProbability } from '../utils/probability.util';

@Injectable()
export class OddsCalculator {
  /**
   * Converts model probability to fair decimal odds.
   *
   * Example:
   * 0.50 -> 2.00
   * 0.75 -> 1.33
   */
  probabilityToFairOdds(probability: number): number {
    const normalized = clampProbability(probability);

    if (normalized <= 0) {
      return 0;
    }

    return Number((1 / normalized).toFixed(2));
  }

  /**
   * Converts a percentage probability into fair decimal odds.
   */
  percentageToFairOdds(percentage: number): number {
    if (!Number.isFinite(percentage) || percentage <= 0) {
      return 0;
    }

    return this.probabilityToFairOdds(percentage / 100);
  }

  /**
   * Converts decimal odds into implied probability.
   */
  oddsToProbability(odds: number): number {
    if (!Number.isFinite(odds) || odds <= 0) {
      return 0;
    }

    return Number((1 / odds).toFixed(6));
  }

  /**
   * Converts decimal odds into implied percentage probability.
   */
  oddsToPercentage(odds: number): number {
    return Number((this.oddsToProbability(odds) * 100).toFixed(2));
  }

  /**
   * Applies a configurable pricing margin to fair odds.
   *
   * margin is expressed as a percentage:
   * 5 = 5%
   */
  applyMargin(fairOdds: number, marginPercentage: number): number {
    if (
      !Number.isFinite(fairOdds) ||
      fairOdds <= 0 ||
      !Number.isFinite(marginPercentage) ||
      marginPercentage < 0
    ) {
      return 0;
    }

    const multiplier = 1 + marginPercentage / 100;

    return Number((fairOdds / multiplier).toFixed(2));
  }

  /**
   * Calculates combined decimal odds.
   *
   * This method is intended for selections where simple
   * multiplication is mathematically appropriate.
   *
   * Correlated selections should use the joint probability
   * calculator instead.
   */
  combineDecimalOdds(odds: number[]): number {
    const validOdds = odds.filter((odd) => Number.isFinite(odd) && odd > 0);

    if (validOdds.length === 0) {
      return 0;
    }

    const combined = validOdds.reduce((total, odd) => total * odd, 1);

    return Number(combined.toFixed(2));
  }
}
