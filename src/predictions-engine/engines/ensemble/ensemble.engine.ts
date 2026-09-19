// src/predictions-engine/engines/ensemble/ensemble.engine.ts

import { Injectable } from '@nestjs/common';

import { EnsembleInput } from '../../interfaces/ensemble-input.interface';
import { EnsembleResult } from '../../interfaces/ensemble-result.interface';

import { ConfidenceEngine } from './confidence.engine';

import { PredictionMathUtil } from '../../utils/prediction-math.util';

@Injectable()
export class EnsembleEngine {
  constructor(private readonly confidenceEngine: ConfidenceEngine) {}

  calculate(input: EnsembleInput): EnsembleResult {
    /*
     * ----------------------------------------------------------
     * PROBABILITY
     * ----------------------------------------------------------
     *
     * Probability has already been established by ProbabilityEngine.
     *
     * Ensemble does not alter it.
     */
    const probability = PredictionMathUtil.clamp(
      input.probability.probability,
      0,
      1,
    );

    const modelAgreement = PredictionMathUtil.clamp(
      input.probability.modelAgreement ?? 0,
      0,
      1,
    );

    const dataQuality = PredictionMathUtil.clamp(
      input.probability.dataQuality ?? 0,
      0,
      100,
    );

    const calibrationReliability = PredictionMathUtil.clamp(
      input.calibrationReliability ?? 0,
      0,
      100,
    );

    /*
     * ----------------------------------------------------------
     * SUPPORTING EVIDENCE
     * ----------------------------------------------------------
     *
     * These values are passed to ConfidenceEngine as evidence
     * information.
     *
     * They do not independently modify confidence here.
     */
    const comparisonConfidence = this.readSignal(
      input.probability,
      'comparisonConfidence',
    );

    const directionalDifference = this.readSignal(
      input.probability,
      'directionalDifference',
    );

    const goalProductionDifference = this.readSignal(
      input.probability,
      'goalProductionDifference',
    );

    const goalPreventionDifference = this.readSignal(
      input.probability,
      'goalPreventionDifference',
    );

    const evidenceCoherence = this.readSignal(
      input.probability,
      'evidenceCoherence',
    );

    /*
     * ----------------------------------------------------------
     * CONFIDENCE
     * ----------------------------------------------------------
     *
     * ConfidenceEngine is the sole authority for confidence.
     *
     * Ensemble must not:
     *
     * - recalculate confidence
     * - multiply confidence
     * - cap confidence based on probability
     * - add comparison confidence a second time
     */
    const confidence = this.confidenceEngine.calculate({
      probability: input.probability,

      safety: input.safety,

      calibrationReliability,

      calibrationError: input.calibrationError,

      sampleSize: input.probability.sampleSize,

      comparisonConfidence: comparisonConfidence ?? undefined,

      directionalDifference: directionalDifference ?? undefined,

      goalProductionDifference: goalProductionDifference ?? undefined,

      goalPreventionDifference: goalPreventionDifference ?? undefined,

      evidenceCoherence: evidenceCoherence ?? undefined,
    });

    /*
     * ----------------------------------------------------------
     * FINAL ENSEMBLE RESULT
     * ----------------------------------------------------------
     *
     * Probability is preserved.
     *
     * Confidence is taken directly from ConfidenceEngine.
     *
     * No second confidence calculation exists here.
     */
    return {
      market: input.probability.market,

      selection: input.probability.selection,

      probability: PredictionMathUtil.round(probability, 6),

      confidence: PredictionMathUtil.clamp(confidence.confidence, 0, 98),

      modelAgreement: PredictionMathUtil.round(modelAgreement, 4),

      dataQuality,

      calibrationReliability,

      probabilityResult: input.probability,

      safetyResult: input.safety,
    };
  }

  private readSignal(
    result: EnsembleInput['probability'],
    key: string,
  ): number | null {
    const signal = result.modelSignals?.[key];

    if (typeof signal === 'number' && Number.isFinite(signal)) {
      return signal;
    }

    const output = result.modelOutputs?.[key];

    if (typeof output === 'number' && Number.isFinite(output)) {
      return output;
    }

    return null;
  }
}
