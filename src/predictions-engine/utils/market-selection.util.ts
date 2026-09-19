import { MarketCandidate } from '../interfaces/market-candidate.interface';

export class MarketSelectionUtil {
  static selectBest(candidates: MarketCandidate[]): MarketCandidate | null {
    if (!candidates.length) {
      return null;
    }

    /*
     * ----------------------------------------------------------
     * ELIGIBILITY
     * ----------------------------------------------------------
     *
     * FinalDecisionEngine is the authority that determines
     * whether a candidate is eligible for publication.
     *
     * A rejected candidate must never be selected.
     */
    const eligibleCandidates = candidates.filter(
      (candidate) => candidate.eligible === true,
    );

    if (!eligibleCandidates.length) {
      return null;
    }

    /*
     * ----------------------------------------------------------
     * FINAL DECISION SELECTION
     * ----------------------------------------------------------
     *
     * decisionScore is produced from the final decision inputs:
     *
     *   probability
     *   confidence
     *   safety
     *   model agreement
     *   data quality
     *   calibration reliability
     *   selection-aligned evidence
     *
     * Probability must therefore NOT bypass the final decision
     * architecture by becoming the primary selector here.
     *
     * This layer chooses between already-evaluated candidates.
     */
    return [...eligibleCandidates].sort((a, b) => {
      /*
       * 1. FINAL DECISION SCORE
       *
       * Primary ordering signal.
       */
      const decisionScoreDifference =
        this.safeNumber(b.decisionScore) - this.safeNumber(a.decisionScore);

      if (decisionScoreDifference !== 0) {
        return decisionScoreDifference;
      }

      /*
       * 2. RISK
       *
       * Lower dynamic risk is preferred when final decision
       * scores are effectively tied.
       */
      const riskDifference =
        this.safeNumber(a.riskScore) - this.safeNumber(b.riskScore);

      if (riskDifference !== 0) {
        return riskDifference;
      }

      /*
       * 3. CONFIDENCE
       *
       * Confidence measures trust in the probability estimate.
       *
       * It is deliberately NOT combined with probability here.
       * It is only a tie-breaker because the final decision score
       * has already incorporated both concepts independently.
       */
      const confidenceDifference =
        this.safeNumber(b.confidence) - this.safeNumber(a.confidence);

      if (confidenceDifference !== 0) {
        return confidenceDifference;
      }

      /*
       * 4. MODEL AGREEMENT
       */
      const agreementDifference =
        this.safeNumber(b.modelAgreement) - this.safeNumber(a.modelAgreement);

      if (agreementDifference !== 0) {
        return agreementDifference;
      }

      /*
       * 5. DATA QUALITY
       */
      const dataQualityDifference =
        this.safeNumber(b.dataQuality) - this.safeNumber(a.dataQuality);

      if (dataQualityDifference !== 0) {
        return dataQualityDifference;
      }

      /*
       * 6. PROBABILITY
       *
       * Probability is retained as the final deterministic
       * tie-breaker, not the primary selector.
       */
      const probabilityDifference =
        this.safeNumber(b.probability) - this.safeNumber(a.probability);

      if (probabilityDifference !== 0) {
        return probabilityDifference;
      }

      /*
       * 7. CALIBRATION RELIABILITY
       */
      return (
        this.safeNumber(b.calibrationReliability) -
        this.safeNumber(a.calibrationReliability)
      );
    })[0];
  }

  private static safeNumber(value: number | null | undefined): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }
}
