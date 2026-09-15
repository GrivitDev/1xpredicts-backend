import { ProbabilityModelResult } from '../../interfaces/probability-result.interface';

export class MarketProbabilityUtil {
  static getProbability(
    result: ProbabilityModelResult | null | undefined,
  ): number {
    if (!result) {
      return 0;
    }

    return this.clamp(result.probability, 0, 1);
  }

  static firstAvailable(...values: Array<number | null | undefined>): number {
    for (const value of values) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
    }

    return 0;
  }

  static complement(value: number): number {
    return this.clamp(1 - value, 0, 1);
  }

  static normalize(values: number[]): number[] {
    if (!values.length) {
      return [];
    }

    const safeValues = values.map((value) => this.clamp(value, 0, 1));

    const total = safeValues.reduce((sum, value) => sum + value, 0);

    if (total <= 0) {
      const equalShare = 1 / safeValues.length;

      return safeValues.map(() => equalShare);
    }

    return safeValues.map((value) => value / total);
  }

  static sampleSize(result: ProbabilityModelResult | null | undefined): number {
    if (!result?.sampleSize) {
      return 0;
    }

    return Math.max(Math.floor(result.sampleSize), 0);
  }

  static dataQuality(
    result: ProbabilityModelResult | null | undefined,
  ): number {
    return this.clamp(result?.dataQuality ?? 0, 0, 100);
  }

  static modelReliability(
    input:
      | ProbabilityModelResult
      | {
          modelReliability?: number;
          dataQuality?: number;
          sampleSize?: number;
        }
      | number
      | null
      | undefined,
    dataQuality?: number,
    sampleSize?: number,
  ): number {
    if (typeof input === 'number') {
      return this.clamp(input, 0, 1);
    }

    if (!input) {
      return 0;
    }

    const explicit =
      'modelReliability' in input ? input.modelReliability : undefined;

    if (typeof explicit === 'number' && Number.isFinite(explicit)) {
      return this.clamp(explicit, 0, 1);
    }

    const quality =
      this.clamp(
        dataQuality ??
          ('dataQuality' in input ? Number(input.dataQuality ?? 0) : 0),
        0,
        100,
      ) / 100;

    const samples = Math.max(
      Math.floor(
        sampleSize ??
          ('sampleSize' in input ? Number(input.sampleSize ?? 0) : 0),
      ),
      0,
    );

    const sampleReliability = 1 - Math.exp(-samples / 40);

    return this.clamp(quality * 0.55 + sampleReliability * 0.45, 0, 1);
  }

  static clamp(value: number, minimum: number, maximum: number): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
