import { Injectable } from '@nestjs/common';

export interface OverUnderSelection {
  selection: string;
  probability: number;
}

@Injectable()
export class OverUnderMarket {
  readonly lines = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5];

  build(totalGoalsDistribution: number[]): OverUnderSelection[] {
    const results: OverUnderSelection[] = [];

    for (const line of this.lines) {
      const threshold = Math.floor(line) + 1;

      let over = 0;
      let under = 0;

      for (let goals = 0; goals < totalGoalsDistribution.length; goals += 1) {
        const probability = totalGoalsDistribution[goals] ?? 0;

        if (goals >= threshold) {
          over += probability;
        } else {
          under += probability;
        }
      }

      results.push({
        selection: `Over ${line}`,
        probability: this.clamp(over),
      });

      results.push({
        selection: `Under ${line}`,
        probability: this.clamp(under),
      });
    }

    return results;
  }

  getSupportedSelections(): string[] {
    return this.lines.flatMap((line) => [`Over ${line}`, `Under ${line}`]);
  }

  private clamp(value: number): number {
    return Math.min(1, Math.max(0, value));
  }
}
