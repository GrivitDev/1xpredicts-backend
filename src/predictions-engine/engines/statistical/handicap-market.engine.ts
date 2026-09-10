import { Injectable } from '@nestjs/common';

export interface HandicapProbability {
  selection: string;
  probability: number;
}

@Injectable()
export class HandicapMarketEngine {
  private readonly asianLines = [
    -3.5, -3, -2.5, -2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2, 2.5, 3, 3.5,
  ];

  private readonly europeanLines = [-3, -2, -1, 0, 1, 2, 3];

  calculateAsian(scoreMatrix: number[][]): HandicapProbability[] {
    const results: HandicapProbability[] = [];

    for (const line of this.asianLines) {
      const home = this.calculateAsianSide(scoreMatrix, line, true);

      const away = this.calculateAsianSide(scoreMatrix, line, false);

      results.push({
        selection: `Home ${this.formatLine(line)}`,
        probability: home,
      });

      results.push({
        selection: `Away ${this.formatLine(line)}`,
        probability: away,
      });
    }

    return results;
  }

  calculateEuropean(scoreMatrix: number[][]): HandicapProbability[] {
    const results: HandicapProbability[] = [];

    for (const line of this.europeanLines) {
      const home = this.calculateEuropeanSide(scoreMatrix, line, true);

      const away = this.calculateEuropeanSide(scoreMatrix, line, false);

      results.push({
        selection: `Home ${this.formatLine(line)}`,
        probability: home,
      });

      results.push({
        selection: `Away ${this.formatLine(line)}`,
        probability: away,
      });
    }

    return results;
  }

  private calculateAsianSide(
    matrix: number[][],
    line: number,
    homeSide: boolean,
  ): number {
    let probability = 0;

    for (let homeGoals = 0; homeGoals < matrix.length; homeGoals += 1) {
      for (
        let awayGoals = 0;
        awayGoals < matrix[homeGoals].length;
        awayGoals += 1
      ) {
        const weight = matrix[homeGoals][awayGoals] ?? 0;
        const difference = homeGoals - awayGoals;
        const adjustedDifference = homeSide
          ? difference + line
          : -difference + line;

        /*
         * For half-goal Asian lines there is no push.
         *
         * Whole-number Asian lines can push. Push probability is
         * excluded from the win probability rather than incorrectly
         * treating a push as a win.
         */
        if (adjustedDifference > 0) {
          probability += weight;
        }
      }
    }

    return this.clamp(probability);
  }

  private calculateEuropeanSide(
    matrix: number[][],
    line: number,
    homeSide: boolean,
  ): number {
    let probability = 0;

    for (let homeGoals = 0; homeGoals < matrix.length; homeGoals += 1) {
      for (
        let awayGoals = 0;
        awayGoals < matrix[homeGoals].length;
        awayGoals += 1
      ) {
        const weight = matrix[homeGoals][awayGoals] ?? 0;
        const difference = homeGoals - awayGoals;

        const adjustedDifference = homeSide
          ? difference + line
          : -difference + line;

        if (adjustedDifference > 0) {
          probability += weight;
        }
      }
    }

    return this.clamp(probability);
  }

  private formatLine(line: number): string {
    if (line > 0) {
      return `+${line}`;
    }

    return `${line}`;
  }

  private clamp(value: number): number {
    return Math.min(1, Math.max(0, value));
  }
}
