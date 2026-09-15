import { MarketCandidate } from '../interfaces/market-candidate.interface';

export class MarketSelectionUtil {
  static selectBest(candidates: MarketCandidate[]): MarketCandidate | null {
    if (!candidates.length) {
      return null;
    }

    /*
     * ----------------------------------------------------------
     * MARKET SELECTION
     * ----------------------------------------------------------
     *
     * Every configured market must produce its strongest
     * prediction candidate.
     *
     * We do NOT filter on:
     *
     *   eligible
     *   probability
     *   confidence
     *   safety
     *   risk
     *   decision score
     *
     * Those values describe the candidate.
     *
     * The FinalDecisionEngine is responsible for determining
     * whether the selected candidate is sufficiently supported
     * by evidence.
     */

    return [...candidates].sort((a, b) => {
      /*
       * Primary signal:
       * agreement between the underlying models.
       */
      const agreementDifference =
        Number(b.modelAgreement ?? 0) - Number(a.modelAgreement ?? 0);

      if (agreementDifference !== 0) {
        return agreementDifference;
      }

      /*
       * Secondary signal:
       * data quality.
       */
      const dataQualityDifference =
        Number(b.dataQuality ?? 0) - Number(a.dataQuality ?? 0);

      if (dataQualityDifference !== 0) {
        return dataQualityDifference;
      }

      /*
       * Third signal:
       * confidence in the probability estimate.
       */
      const confidenceDifference =
        Number(b.confidence ?? 0) - Number(a.confidence ?? 0);

      if (confidenceDifference !== 0) {
        return confidenceDifference;
      }

      /*
       * Fourth signal:
       * probability.
       *
       * This is used only after evidence quality has been compared.
       */
      const probabilityDifference =
        Number(b.probability ?? 0) - Number(a.probability ?? 0);

      if (probabilityDifference !== 0) {
        return probabilityDifference;
      }

      /*
       * Final tie-breaker:
       * combined decision score.
       */
      return Number(b.decisionScore ?? 0) - Number(a.decisionScore ?? 0);
    })[0];
  }
}
