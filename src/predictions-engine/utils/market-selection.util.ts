// src/predictions-engine/utils/market-selection.util.ts

import { PredictionMarket } from '../enums/prediction-market.enum';
import { MarketCandidate } from '../interfaces/market-candidate.interface';

export class MarketSelectionUtil {
  static selectBest(candidates: MarketCandidate[]): MarketCandidate | null {
    if (!candidates.length) {
      return null;
    }

    const market = candidates[0].market;

    /*
     * ----------------------------------------------------------
     * MATCH RESULT / 1X2
     * ----------------------------------------------------------
     *
     * HOME, DRAW and AWAY are mutually exclusive.
     *
     * The normalized 1X2 probability is the primary selection
     * signal. Supporting evidence is used only as a tie-breaker.
     */
    if (market === PredictionMarket.MATCH_RESULT) {
      return [...candidates].sort((a, b) => {
        const probabilityDifference =
          Number(b.probability ?? 0) - Number(a.probability ?? 0);

        if (probabilityDifference !== 0) {
          return probabilityDifference;
        }

        const decisionScoreDifference =
          Number(b.decisionScore ?? 0) - Number(a.decisionScore ?? 0);

        if (decisionScoreDifference !== 0) {
          return decisionScoreDifference;
        }

        const agreementDifference =
          Number(b.modelAgreement ?? 0) - Number(a.modelAgreement ?? 0);

        if (agreementDifference !== 0) {
          return agreementDifference;
        }

        const confidenceDifference =
          Number(b.confidence ?? 0) - Number(a.confidence ?? 0);

        if (confidenceDifference !== 0) {
          return confidenceDifference;
        }

        return Number(b.dataQuality ?? 0) - Number(a.dataQuality ?? 0);
      })[0];
    }

    /*
     * ----------------------------------------------------------
     * OTHER MARKETS
     * ----------------------------------------------------------
     *
     * The candidate's final decision score is the market-level
     * representation of probability + supporting evidence.
     *
     * Therefore it is the primary selector here.
     *
     * Probability is the first tie-breaker so a materially stronger
     * probability is not discarded because of a small supporting-
     * evidence difference.
     */
    return [...candidates].sort((a, b) => {
      const decisionScoreDifference =
        Number(b.decisionScore ?? 0) - Number(a.decisionScore ?? 0);

      if (decisionScoreDifference !== 0) {
        return decisionScoreDifference;
      }

      const probabilityDifference =
        Number(b.probability ?? 0) - Number(a.probability ?? 0);

      if (probabilityDifference !== 0) {
        return probabilityDifference;
      }

      const agreementDifference =
        Number(b.modelAgreement ?? 0) - Number(a.modelAgreement ?? 0);

      if (agreementDifference !== 0) {
        return agreementDifference;
      }

      const confidenceDifference =
        Number(b.confidence ?? 0) - Number(a.confidence ?? 0);

      if (confidenceDifference !== 0) {
        return confidenceDifference;
      }

      return Number(b.dataQuality ?? 0) - Number(a.dataQuality ?? 0);
    })[0];
  }
}
