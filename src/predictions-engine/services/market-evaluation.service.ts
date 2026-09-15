import { Injectable } from '@nestjs/common';

import { ENABLED_PREDICTION_MARKETS } from '../config/prediction-markets.config';
import { PREDICTION_ENGINE_CONFIG } from '../config/prediction-engine.config';

import { MarketEvaluation } from '../interfaces/market-evaluation.interface';
import { MarketModelInput } from '../interfaces/market-model-input.interface';
import { RawPredictionFeatures } from '../interfaces/raw-prediction-features.interface';
import { EnsembleResult } from '../interfaces/ensemble-result.interface';
import { MarketCandidate } from '../interfaces/market-candidate.interface';
import { ValueResult } from '../interfaces/value-result.interface';

import { CalibrationService } from '../calibration/calibration.service';

import { ProbabilityEngine } from '../engines/probability/probability.engine';
import { SafetyEngine } from '../engines/safety/safety.engine';
import { EnsembleEngine } from '../engines/ensemble/ensemble.engine';
import { FinalDecisionEngine } from '../engines/final/final-decision.engine';
import { OddsCalculationService } from '../engines/value/odds-calculation.service';
import { ValueEngine } from '../engines/value/value.engine';

@Injectable()
export class MarketEvaluationService {
  private readonly modelVersion = PREDICTION_ENGINE_CONFIG.modelVersion;

  constructor(
    private readonly calibrationService: CalibrationService,

    private readonly probabilityEngine: ProbabilityEngine,

    private readonly oddsCalculationService: OddsCalculationService,

    private readonly valueEngine: ValueEngine,

    private readonly safetyEngine: SafetyEngine,

    private readonly ensembleEngine: EnsembleEngine,

    private readonly finalDecisionEngine: FinalDecisionEngine,
  ) {}

  async evaluateMarket(
    features: RawPredictionFeatures,
    market: (typeof ENABLED_PREDICTION_MARKETS)[number]['market'],
  ): Promise<MarketEvaluation> {
    const marketConfigurations = ENABLED_PREDICTION_MARKETS.filter(
      (item) => item.market === market && item.enabled,
    );

    const candidates: EnsembleResult[] = [];

    const valueResults: ValueResult[] = [];

    for (const configuration of marketConfigurations) {
      const calibration = await this.calibrationService.getCalibration(
        configuration.market,
        configuration.selection,
        this.modelVersion,
      );

      const input: MarketModelInput = {
        features,

        market: configuration.market,

        selection: configuration.selection,

        calibrationAdjustment: calibration?.adjustment ?? 0,
      };

      const probability = this.probabilityEngine.calculate(input);

      if (
        !Number.isFinite(probability.probability) ||
        probability.probability <= 0
      ) {
        continue;
      }

      /*
       * --------------------------------------------------------
       * OUR FAIR PRICE
       * --------------------------------------------------------
       */
      const odds = this.oddsCalculationService.calculate(probability);

      /*
       * --------------------------------------------------------
       * VALUE ENGINE
       * --------------------------------------------------------
       *
       * There is deliberately no bookmaker price.
       *
       * The ValueEngine therefore records our own fair odds.
       */
      const value = this.valueEngine.calculate(
        input,
        probability.probability,
        odds.fairOdds,
      );

      valueResults.push(value);

      const safety = this.safetyEngine.calculate({
        market: input.market,

        selection: input.selection,

        probability: probability.probability,

        modelReliability: probability.modelReliability,

        dataQuality: probability.dataQuality,

        modelAgreement: probability.modelAgreement ?? 0,

        calibrationReliability: calibration?.reliabilityScore ?? 0,

        calibrationError: calibration?.calibrationError ?? 0,

        sampleSize: probability.sampleSize,
      });

      const ensemble = this.ensembleEngine.calculate({
        probability,

        safety,

        calibrationAdjustment: calibration?.adjustment ?? 0,

        calibrationReliability: calibration?.reliabilityScore ?? 0,
      });

      candidates.push(ensemble);
    }

    /*
     * --------------------------------------------------------
     * EVALUATE EVERY CANDIDATE
     * --------------------------------------------------------
     */
    const selectionCandidates: MarketCandidate[] = candidates.map(
      (candidate) => {
        const decision = this.finalDecisionEngine.decide({
          market: candidate.market,

          selection: candidate.selection,

          probability: candidate.probability,

          confidence: candidate.confidence,

          safetyScore: candidate.safetyResult.safetyScore,

          modelAgreement: candidate.modelAgreement,

          dataQuality: candidate.dataQuality,

          calibrationReliability: candidate.calibrationReliability,
        });

        return {
          market: decision.market,

          selection: decision.selection,

          probability: decision.probability,

          confidence: decision.confidence,

          safetyScore: decision.safetyScore,

          modelAgreement: decision.modelAgreement,

          dataQuality: decision.dataQuality,

          calibrationReliability: decision.calibrationReliability,

          risk: decision.risk,

          decisionScore: decision.decisionScore,

          riskScore: candidate.safetyResult.riskScore,

          eligible: decision.accepted,

          rejectionReason: decision.rejectionReason,
        };
      },
    );

    /*
     * --------------------------------------------------------
     * SELECT THE MODEL'S BEST REPRESENTATION OF THIS MARKET
     * --------------------------------------------------------
     *
     * Selection does not require the candidate to be "safe".
     *
     * We choose the candidate with the strongest overall evidence
     * and model support.
     */
    const selected = this.selectBestCandidate(selectionCandidates);

    if (!selected) {
      return {
        market,

        candidates,

        valueResults,
      };
    }

    /*
     * --------------------------------------------------------
     * FINAL DECISION
     * --------------------------------------------------------
     */
    const decision = this.finalDecisionEngine.decide({
      market: selected.market,

      selection: selected.selection,

      probability: selected.probability,

      confidence: selected.confidence,

      safetyScore: selected.safetyScore,

      modelAgreement: selected.modelAgreement,

      dataQuality: selected.dataQuality,

      calibrationReliability: selected.calibrationReliability,
    });

    return {
      market,

      candidates,

      valueResults,

      decision,
    };
  }

  private selectBestCandidate(
    candidates: MarketCandidate[],
  ): MarketCandidate | null {
    if (!candidates.length) {
      return null;
    }

    return [...candidates].sort((a, b) => {
      /*
       * Evidence agreement is the strongest selector.
       */
      if (b.modelAgreement !== a.modelAgreement) {
        return b.modelAgreement - a.modelAgreement;
      }

      /*
       * Data quality is the second strongest selector.
       */
      if (b.dataQuality !== a.dataQuality) {
        return b.dataQuality - a.dataQuality;
      }

      /*
       * Safety supports the selection but does not define whether
       * the prediction is interesting or high-probability.
       */
      if (b.safetyScore !== a.safetyScore) {
        return b.safetyScore - a.safetyScore;
      }

      /*
       * Confidence describes reliability of the probability.
       */
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }

      /*
       * Decision score is used only as the final tie-breaker.
       */
      return b.decisionScore - a.decisionScore;
    })[0];
  }
}
