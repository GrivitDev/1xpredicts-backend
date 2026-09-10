import { Injectable } from '@nestjs/common';

import { PredictionMarket } from '../enums/prediction-market.enum';

import { GoalProbabilityDistribution } from '../interfaces/prediction-probability.interface';

@Injectable()
export class CleanSheetMarket {
  calculate(distribution: GoalProbabilityDistribution) {
    let homeCleanSheet = 0;
    let awayCleanSheet = 0;
    let bothCleanSheet = 0;
    let neitherCleanSheet = 0;

    for (const scoreline of distribution.scorelines) {
      const homeClean = scoreline.awayGoals === 0;

      const awayClean = scoreline.homeGoals === 0;

      if (homeClean) {
        homeCleanSheet += scoreline.probability;
      }

      if (awayClean) {
        awayCleanSheet += scoreline.probability;
      }

      if (homeClean && awayClean) {
        bothCleanSheet += scoreline.probability;
      }

      if (!homeClean && !awayClean) {
        neitherCleanSheet += scoreline.probability;
      }
    }

    return [
      {
        market: PredictionMarket.CLEAN_SHEET,
        selection: 'HOME_CLEAN_SHEET',
        label: 'Home Clean Sheet',
        probability: this.clamp(homeCleanSheet),
      },
      {
        market: PredictionMarket.CLEAN_SHEET,
        selection: 'AWAY_CLEAN_SHEET',
        label: 'Away Clean Sheet',
        probability: this.clamp(awayCleanSheet),
      },
      {
        market: PredictionMarket.CLEAN_SHEET,
        selection: 'BOTH_CLEAN_SHEET',
        label: 'Both Clean Sheets',
        probability: this.clamp(bothCleanSheet),
      },
      {
        market: PredictionMarket.CLEAN_SHEET,
        selection: 'NO_CLEAN_SHEET',
        label: 'Neither Clean Sheet',
        probability: this.clamp(neitherCleanSheet),
      },
    ];
  }

  private clamp(value: number): number {
    return Math.min(1, Math.max(0, value));
  }
}
