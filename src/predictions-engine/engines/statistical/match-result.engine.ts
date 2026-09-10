import { Injectable } from '@nestjs/common';

import { GoalProbabilityDistribution } from '../../interfaces/prediction-probability.interface';

@Injectable()
export class MatchResultEngine {
  calculate(distribution: GoalProbabilityDistribution): {
    home: number;
    draw: number;
    away: number;
  } {
    let home = 0;

    let draw = 0;

    let away = 0;

    for (const scoreline of distribution.scorelines) {
      if (scoreline.homeGoals > scoreline.awayGoals) {
        home += scoreline.probability;
      } else if (scoreline.homeGoals === scoreline.awayGoals) {
        draw += scoreline.probability;
      } else {
        away += scoreline.probability;
      }
    }

    const total = home + draw + away;

    if (total <= 0) {
      return {
        home: 1 / 3,
        draw: 1 / 3,
        away: 1 / 3,
      };
    }

    return {
      home: home / total,
      draw: draw / total,
      away: away / total,
    };
  }
}
