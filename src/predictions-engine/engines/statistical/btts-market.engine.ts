import { Injectable } from '@nestjs/common';

import { PredictionMarket } from '../../enums/prediction-market.enum';

import { GoalProbabilityDistribution } from '../../interfaces/prediction-probability.interface';

import { StatisticalMarketSelectionResult } from '../../interfaces/statistical-market-result.interface';

@Injectable()
export class BttsMarketEngine {
  calculate(
    distribution: GoalProbabilityDistribution,
  ): StatisticalMarketSelectionResult[] {
    let yes = 0;

    for (const scoreline of distribution.scorelines) {
      if (scoreline.homeGoals > 0 && scoreline.awayGoals > 0) {
        yes += scoreline.probability;
      }
    }

    return [
      {
        market: PredictionMarket.BOTH_TEAMS_TO_SCORE,
        selection: 'BTTS_YES',
        label: 'Yes',
        probability: this.clamp(yes),
      },
      {
        market: PredictionMarket.BOTH_TEAMS_TO_SCORE,
        selection: 'BTTS_NO',
        label: 'No',
        probability: this.clamp(1 - yes),
      },
    ];
  }

  calculateBttsGoals(
    distribution: GoalProbabilityDistribution,
  ): StatisticalMarketSelectionResult[] {
    const selections: StatisticalMarketSelectionResult[] = [];

    const goalLines = [1.5, 2.5, 3.5, 4.5];

    for (const line of goalLines) {
      let probability = 0;

      for (const scoreline of distribution.scorelines) {
        const totalGoals = scoreline.homeGoals + scoreline.awayGoals;

        if (
          scoreline.homeGoals > 0 &&
          scoreline.awayGoals > 0 &&
          totalGoals > line
        ) {
          probability += scoreline.probability;
        }
      }

      selections.push({
        market: PredictionMarket.BTTS_GOALS,
        selection: `BTTS_OVER_${String(line).replace('.', '_')}`,
        label: `BTTS + Over ${line}`,
        probability: this.clamp(probability),
      });
    }

    for (const line of goalLines) {
      let probability = 0;

      for (const scoreline of distribution.scorelines) {
        const totalGoals = scoreline.homeGoals + scoreline.awayGoals;

        if (
          scoreline.homeGoals > 0 &&
          scoreline.awayGoals > 0 &&
          totalGoals < line
        ) {
          probability += scoreline.probability;
        }
      }

      selections.push({
        market: PredictionMarket.BTTS_GOALS,
        selection: `BTTS_UNDER_${String(line).replace('.', '_')}`,
        label: `BTTS + Under ${line}`,
        probability: this.clamp(probability),
      });
    }

    let bttsHomeWin = 0;
    let bttsDraw = 0;
    let bttsAwayWin = 0;

    let noBttsHomeWin = 0;
    let noBttsDraw = 0;
    let noBttsAwayWin = 0;

    for (const scoreline of distribution.scorelines) {
      const btts = scoreline.homeGoals > 0 && scoreline.awayGoals > 0;

      if (scoreline.homeGoals > scoreline.awayGoals) {
        if (btts) {
          bttsHomeWin += scoreline.probability;
        } else {
          noBttsHomeWin += scoreline.probability;
        }
      } else if (scoreline.homeGoals === scoreline.awayGoals) {
        if (btts) {
          bttsDraw += scoreline.probability;
        } else {
          noBttsDraw += scoreline.probability;
        }
      } else {
        if (btts) {
          bttsAwayWin += scoreline.probability;
        } else {
          noBttsAwayWin += scoreline.probability;
        }
      }
    }

    selections.push(
      {
        market: PredictionMarket.BTTS_GOALS,
        selection: 'BTTS_HOME_WIN',
        label: 'BTTS + Home Win',
        probability: this.clamp(bttsHomeWin),
      },
      {
        market: PredictionMarket.BTTS_GOALS,
        selection: 'BTTS_DRAW',
        label: 'BTTS + Draw',
        probability: this.clamp(bttsDraw),
      },
      {
        market: PredictionMarket.BTTS_GOALS,
        selection: 'BTTS_AWAY_WIN',
        label: 'BTTS + Away Win',
        probability: this.clamp(bttsAwayWin),
      },
      {
        market: PredictionMarket.BTTS_GOALS,
        selection: 'NO_BTTS_HOME_WIN',
        label: 'BTTS No + Home Win',
        probability: this.clamp(noBttsHomeWin),
      },
      {
        market: PredictionMarket.BTTS_GOALS,
        selection: 'NO_BTTS_DRAW',
        label: 'BTTS No + Draw',
        probability: this.clamp(noBttsDraw),
      },
      {
        market: PredictionMarket.BTTS_GOALS,
        selection: 'NO_BTTS_AWAY_WIN',
        label: 'BTTS No + Away Win',
        probability: this.clamp(noBttsAwayWin),
      },
    );

    return selections;
  }

  private clamp(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.min(1, Math.max(0, value));
  }
}
