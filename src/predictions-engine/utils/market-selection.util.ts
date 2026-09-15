import { MarketCandidate } from '../interfaces/market-candidate.interface';

export class MarketSelectionUtil {
  static selectBest(candidates: MarketCandidate[]): MarketCandidate | null {
    if (!candidates.length) {
      return null;
    }

    const eligible = candidates.filter(
      (candidate) => candidate.eligible !== false,
    );

    if (!eligible.length) {
      return null;
    }

    return [...eligible].sort((a, b) => {
      const decisionDifference =
        Number(b.decisionScore ?? 0) - Number(a.decisionScore ?? 0);

      if (decisionDifference !== 0) {
        return decisionDifference;
      }

      const confidenceDifference =
        Number(b.confidence ?? 0) - Number(a.confidence ?? 0);

      if (confidenceDifference !== 0) {
        return confidenceDifference;
      }

      return Number(b.probability ?? 0) - Number(a.probability ?? 0);
    })[0];
  }
}
