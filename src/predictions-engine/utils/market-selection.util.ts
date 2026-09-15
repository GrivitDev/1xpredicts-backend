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
     * HOME, DRAW and AWAY are mutually exclusive outcomes.
     *
     * The outcome with the highest normalized probability should
     * be selected.
     *
     * Agreement is used only after probability, so DRAW cannot
     * become the selected result simply because the models happen
     * to agree more strongly around it.
     */
    if (market === PredictionMarket.MATCH_RESULT) {
      return [...candidates].sort((a, b) => {
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

    /*
     * ----------------------------------------------------------
     * OTHER MARKETS
     * ----------------------------------------------------------
     */
    return [...candidates].sort((a, b) => {
      const agreementDifference =
        Number(b.modelAgreement ?? 0) - Number(a.modelAgreement ?? 0);

      if (agreementDifference !== 0) {
        return agreementDifference;
      }

      const dataQualityDifference =
        Number(b.dataQuality ?? 0) - Number(a.dataQuality ?? 0);

      if (dataQualityDifference !== 0) {
        return dataQualityDifference;
      }

      const confidenceDifference =
        Number(b.confidence ?? 0) - Number(a.confidence ?? 0);

      if (confidenceDifference !== 0) {
        return confidenceDifference;
      }

      const probabilityDifference =
        Number(b.probability ?? 0) - Number(a.probability ?? 0);

      if (probabilityDifference !== 0) {
        return probabilityDifference;
      }

      return Number(b.decisionScore ?? 0) - Number(a.decisionScore ?? 0);
    })[0];
  }
}
