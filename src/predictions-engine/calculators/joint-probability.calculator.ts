import { Injectable } from '@nestjs/common';

import { clampProbability } from '../utils/probability.util';

export interface JointProbabilitySelection {
  probability: number;
}

export interface JointProbabilityPair {
  firstProbability: number;
  secondProbability: number;
  jointProbability: number;
}

@Injectable()
export class JointProbabilityCalculator {
  /**
   * Calculates a joint probability from mutually independent
   * selections.
   *
   * Correlated football selections must use a shared underlying
   * distribution instead of this method.
   */
  independent(selections: JointProbabilitySelection[]): number {
    if (selections.length === 0) {
      return 0;
    }

    return Number(
      selections
        .reduce(
          (probability, selection) =>
            probability * clampProbability(selection.probability),
          1,
        )
        .toFixed(6),
    );
  }

  /**
   * Calculates a joint probability directly from a provided
   * joint probability value.
   */
  fromJointProbability(jointProbability: number): number {
    return Number(clampProbability(jointProbability).toFixed(6));
  }

  /**
   * Calculates the complement of a probability.
   */
  complement(probability: number): number {
    return Number((1 - clampProbability(probability)).toFixed(6));
  }

  /**
   * Calculates a conditional joint probability:
   *
   * P(A and B) = P(A) * P(B | A)
   */
  conditional(probabilityA: number, probabilityBGivenA: number): number {
    return Number(
      (
        clampProbability(probabilityA) * clampProbability(probabilityBGivenA)
      ).toFixed(6),
    );
  }

  /**
   * Converts a joint probability into a percentage.
   */
  toPercentage(probability: number): number {
    return Number((clampProbability(probability) * 100).toFixed(2));
  }

  /**
   * Returns the probability of at least one event occurring
   * under the independence assumption.
   */
  atLeastOne(probabilities: number[]): number {
    if (probabilities.length === 0) {
      return 0;
    }

    const none = probabilities.reduce(
      (probability, current) => probability * this.complement(current),
      1,
    );

    return Number((1 - none).toFixed(6));
  }
}
