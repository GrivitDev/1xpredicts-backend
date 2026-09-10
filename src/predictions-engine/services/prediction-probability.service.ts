import { Injectable } from '@nestjs/common';

import { OddsCalculator } from '../calculators/odds.calculator';

@Injectable()
export class PredictionProbabilityService {
  constructor(private readonly oddsCalculator: OddsCalculator) {}

  normalizeMatchProbability(
    home: number,
    draw: number,
    away: number,
  ): {
    home: number;
    draw: number;
    away: number;
  } {
    const values = [Math.max(0, home), Math.max(0, draw), Math.max(0, away)];

    const total = values.reduce((sum, value) => sum + value, 0);

    if (total <= 0) {
      return {
        home: 33.33,
        draw: 33.33,
        away: 33.34,
      };
    }

    return {
      home: Number(((values[0] / total) * 100).toFixed(2)),
      draw: Number(((values[1] / total) * 100).toFixed(2)),
      away: Number(((values[2] / total) * 100).toFixed(2)),
    };
  }

  probabilityToOdds(probability: number): number {
    return this.oddsCalculator.percentageToFairOdds(probability);
  }

  combineProbabilities(probabilities: number[]): number {
    const valid = probabilities.filter(
      (value) => Number.isFinite(value) && value >= 0 && value <= 100,
    );

    if (valid.length === 0) {
      return 0;
    }

    const product = valid.reduce((result, value) => result * (value / 100), 1);

    return Number((product * 100).toFixed(2));
  }
}
