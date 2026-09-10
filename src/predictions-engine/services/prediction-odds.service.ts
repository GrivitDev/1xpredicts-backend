import { Injectable } from '@nestjs/common';

import { OddsCalculator } from '../calculators/odds.calculator';

@Injectable()
export class PredictionOddsService {
  constructor(private readonly oddsCalculator: OddsCalculator) {}

  calculateFairOdds(probability: number): number {
    return this.oddsCalculator.percentageToFairOdds(probability);
  }

  calculateCombinedFairOdds(probabilities: number[]): number {
    const valid = probabilities.filter(
      (probability) =>
        Number.isFinite(probability) && probability > 0 && probability <= 100,
    );

    if (valid.length === 0) {
      return 0;
    }

    const probability = valid.reduce(
      (result, value) => result * (value / 100),
      1,
    );

    return this.calculateFairOdds(probability * 100);
  }

  calculateCombinedOdds(odds: number[]): number {
    return this.oddsCalculator.combineDecimalOdds(odds);
  }
}
