import { Injectable } from '@nestjs/common';

import { PredictionMarket } from '../enums/prediction-market.enum';

import { GoalProbabilityDistribution } from '../interfaces/prediction-probability.interface';

@Injectable()
export class BttsGoalsMarket {
  private readonly lines = [1.5, 2.5, 3.5, 4.5];

  calculate(distribution: GoalProbabilityDistribution) {
    const results: Array<{
      market: PredictionMarket;
      selection: string;
      label: string;
      probability: number;
    }> = [];

    for (const line of this.lines) {
      let over = 0;
      let under = 0;

      for (const scoreline of distribution.scorelines) {
        const btts = scoreline.homeGoals > 0 && scoreline.awayGoals > 0;

        if (!btts) {
          continue;
        }

        const totalGoals = scoreline.homeGoals + scoreline.awayGoals;

        if (totalGoals > line) {
          over += scoreline.probability;
        }

        if (totalGoals < line) {
          under += scoreline.probability;
        }
      }

      results.push(
        {
          market: PredictionMarket.BTTS_GOALS,
          selection: `BTTS_OVER_${this.formatLine(line)}`,
          label: `BTTS + Over ${line}`,
          probability: this.clamp(over),
        },
        {
          market: PredictionMarket.BTTS_GOALS,
          selection: `BTTS_UNDER_${this.formatLine(line)}`,
          label: `BTTS + Under ${line}`,
          probability: this.clamp(under),
        },
      );
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

    results.push(
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

    return results;
  }

  private formatLine(value: number): string {
    return String(value).replace('.', '_');
  }

  private clamp(value: number): number {
    return Math.min(1, Math.max(0, value));
  }
}
