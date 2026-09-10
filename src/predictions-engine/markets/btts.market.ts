import { Injectable } from '@nestjs/common';

export interface BttsSelection {
  selection: string;
  probability: number;
}

@Injectable()
export class BttsMarket {
  getSupportedSelections(): string[] {
    return ['Yes', 'No'];
  }

  build(probabilityYes: number): BttsSelection[] {
    const yes = this.clamp(probabilityYes);

    return [
      {
        selection: 'Yes',
        probability: yes,
      },
      {
        selection: 'No',
        probability: this.clamp(1 - yes),
      },
    ];
  }

  fromScoreMatrix(scoreMatrix: number[][]): BttsSelection[] {
    let yes = 0;

    for (let homeGoals = 0; homeGoals < scoreMatrix.length; homeGoals += 1) {
      for (
        let awayGoals = 0;
        awayGoals < scoreMatrix[homeGoals].length;
        awayGoals += 1
      ) {
        if (homeGoals > 0 && awayGoals > 0) {
          yes += scoreMatrix[homeGoals][awayGoals] ?? 0;
        }
      }
    }

    return this.build(yes);
  }

  private clamp(value: number): number {
    return Math.min(1, Math.max(0, value));
  }
}
