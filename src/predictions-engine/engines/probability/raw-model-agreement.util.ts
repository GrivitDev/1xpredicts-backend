import { RawPredictionFeatures } from '../../interfaces/raw-prediction-features.interface';

export interface RawModelAgreementResult {
  agreement: number;
  modelOutputs: Record<string, number>;
  signals: string[];
}

export class RawModelAgreementUtil {
  static calculate(
    features: RawPredictionFeatures,
    probability: number,
  ): RawModelAgreementResult {
    const outputs = this.collectIndependentSignals(features, probability);

    const values = Object.values(outputs).filter(
      (value) => Number.isFinite(value) && value >= 0 && value <= 1,
    );

    if (values.length < 2) {
      return {
        agreement: 0,
        modelOutputs: outputs,
        signals: Object.keys(outputs),
      };
    }

    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;

    const meanAbsoluteDeviation =
      values.reduce((sum, value) => sum + Math.abs(value - mean), 0) /
      values.length;

    const agreement = this.clamp(1 - meanAbsoluteDeviation * 2.5);

    return {
      agreement,
      modelOutputs: outputs,
      signals: Object.keys(outputs),
    };
  }

  private static collectIndependentSignals(
    features: RawPredictionFeatures,
    probability: number,
  ): Record<string, number> {
    const signals: Record<string, number> = {
      primaryModel: this.clamp(probability),
    };

    const recentSignal = this.getRecentSignal(features);

    if (recentSignal !== null) {
      signals.recentForm = recentSignal;
    }

    const historicalSignal = this.getHistoricalSignal(features);

    if (historicalSignal !== null) {
      signals.historicalRate = historicalSignal;
    }

    const standingSignal = this.getStandingSignal(features);

    if (standingSignal !== null) {
      signals.standing = standingSignal;
    }

    const h2hSignal = this.getH2HSignal(features);

    if (h2hSignal !== null) {
      signals.headToHead = h2hSignal;
    }

    return signals;
  }

  private static getRecentSignal(
    features: RawPredictionFeatures,
  ): number | null {
    const home = this.safeRate(features.home.recent?.winRate);

    const away = this.safeRate(features.away.recent?.winRate);

    if (home === null || away === null) {
      return null;
    }

    return this.clamp((home + (1 - away)) / 2);
  }

  private static getHistoricalSignal(
    features: RawPredictionFeatures,
  ): number | null {
    const home = this.safeRate(features.home.winRate);

    const away = this.safeRate(features.away.winRate);

    if (home === null || away === null) {
      return null;
    }

    return this.clamp((home + (1 - away)) / 2);
  }

  private static getStandingSignal(
    features: RawPredictionFeatures,
  ): number | null {
    const homeRank = features.standings?.home?.rank;

    const awayRank = features.standings?.away?.rank;

    if (
      typeof homeRank !== 'number' ||
      typeof awayRank !== 'number' ||
      !Number.isFinite(homeRank) ||
      !Number.isFinite(awayRank)
    ) {
      return null;
    }

    const homePoints = features.standings?.home?.points;

    const awayPoints = features.standings?.away?.points;

    if (typeof homePoints !== 'number' || typeof awayPoints !== 'number') {
      return null;
    }

    const total = Math.abs(homePoints) + Math.abs(awayPoints);

    if (total <= 0) {
      return null;
    }

    return this.clamp(homePoints / total);
  }

  private static getH2HSignal(features: RawPredictionFeatures): number | null {
    const homeWins = features.h2h?.homeWins;

    const awayWins = features.h2h?.awayWins;

    const draws = features.h2h?.draws;

    const total =
      Number(homeWins ?? 0) + Number(awayWins ?? 0) + Number(draws ?? 0);

    if (total <= 0 || !Number.isFinite(total)) {
      return null;
    }

    return this.clamp(Number(homeWins ?? 0) / total);
  }

  private static safeRate(value: number | null | undefined): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return null;
    }

    if (value < 0) {
      return 0;
    }

    return this.clamp(value > 1 ? value / 100 : value);
  }

  private static clamp(value: number, minimum = 0, maximum = 1): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
