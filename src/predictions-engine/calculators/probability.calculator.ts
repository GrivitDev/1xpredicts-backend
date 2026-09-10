import { Injectable } from '@nestjs/common';

import {
  clampProbability,
  normalizeProbabilities,
  percentageToProbability,
  probabilityToPercentage,
  roundPercentage,
  roundProbability,
  weightedAverage,
} from '../utils/probability.util';

@Injectable()
export class ProbabilityCalculator {
  /**
   * Converts a decimal probability (0..1) into a percentage (0..100).
   */
  toPercentage(probability: number): number {
    return probabilityToPercentage(probability);
  }

  /**
   * Converts a percentage (0..100) into a probability (0..1).
   */
  toProbability(percentage: number): number {
    return percentageToProbability(percentage);
  }

  /**
   * Ensures a probability remains within 0..1.
   */
  clamp(probability: number): number {
    return clampProbability(probability);
  }

  /**
   * Normalizes mutually exclusive probabilities so that they
   * sum to exactly 1.
   */
  normalize(probabilities: Record<string, number>): Record<string, number> {
    return normalizeProbabilities(probabilities);
  }

  /**
   * Produces a weighted probability from multiple sources.
   */
  combine(
    values: Array<{
      probability: number;
      weight: number;
    }>,
  ): number {
    return roundProbability(
      weightedAverage(
        values.map((item) => ({
          value: clampProbability(item.probability),
          weight: item.weight,
        })),
      ),
    );
  }

  /**
   * Produces a weighted percentage from multiple sources.
   */
  combinePercentage(
    values: Array<{
      probability: number;
      weight: number;
    }>,
  ): number {
    return roundPercentage(
      this.toPercentage(
        this.combine(
          values.map((item) => ({
            probability: item.probability,
            weight: item.weight,
          })),
        ),
      ),
    );
  }
}
