// src/predictions-engine/engines/ensemble/ensemble.engine.ts

import { Injectable } from '@nestjs/common';

import { EnsembleInput } from '../../interfaces/ensemble-input.interface';
import { EnsembleResult } from '../../interfaces/ensemble-result.interface';

import { ConfidenceEngine } from './confidence.engine';

import { ConfidenceUtil } from '../../utils/confidence.util';
import { PredictionMathUtil } from '../../utils/prediction-math.util';

@Injectable()
export class EnsembleEngine {
  constructor(private readonly confidenceEngine: ConfidenceEngine) {}

  calculate(input: EnsembleInput): EnsembleResult {
    /*
     * ----------------------------------------------------------
     * SHARED PROBABILITY / COMPARISON ARCHITECTURE
     * ----------------------------------------------------------
     *
     * ProbabilityEngine has already reconciled:
     *
     *   - common score matrix
     *   - registered market model
     *   - TeamComparisonService
     *   - model agreement
     *   - calibration
     *
     * Ensemble does not create another probability model.
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

    const safetyScore = PredictionMathUtil.clamp(
      input.safety.safetyScore ?? 0,
      0,
      100,
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
     * COMPARISON EVIDENCE
     * ----------------------------------------------------------
     *
     * These signals are passed through from ProbabilityEngine.
     * Ensemble does not reconstruct TeamComparisonService logic.
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
     * CONFIDENCE ENGINE
     * ----------------------------------------------------------
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

    const baseConfidence = ConfidenceUtil.clamp(confidence.confidence);

    /*
     * ----------------------------------------------------------
     * EVIDENCE-ALIGNED CONFIDENCE
     * ----------------------------------------------------------
     *
     * Probability is preserved exactly.
     *
     * Ensemble only adjusts confidence so that a high confidence
     * value cannot survive when the combined evidence package is
     * materially weak.
     */
    const comparisonEvidence = this.calculateComparisonSupport(
      comparisonConfidence,
      directionalDifference,
      goalProductionDifference,
      goalPreventionDifference,
      evidenceCoherence,
    );

    const alignedConfidence = this.calculateEvidenceAlignedConfidence(
      baseConfidence,
      modelAgreement,
      safetyScore,
      dataQuality,
      calibrationReliability,
      comparisonEvidence,
    );

    return {
      market: input.probability.market,

      selection: input.probability.selection,

      probability: PredictionMathUtil.round(probability, 6),

      confidence: ConfidenceUtil.clamp(alignedConfidence),

      modelAgreement: PredictionMathUtil.round(modelAgreement, 4),

      dataQuality,

      calibrationReliability,

      probabilityResult: input.probability,

      safetyResult: input.safety,
    };
  }

  private calculateComparisonSupport(
    comparisonConfidence: number | null,
    directionalDifference: number | null,
    goalProductionDifference: number | null,
    goalPreventionDifference: number | null,
    evidenceCoherence: number | null,
  ): number {
    const confidence = PredictionMathUtil.clamp(
      comparisonConfidence ?? 0,
      0,
      1,
    );

    const directional =
      directionalDifference !== null
        ? Math.abs(PredictionMathUtil.clamp(directionalDifference, -1, 1))
        : 0;

    const production =
      goalProductionDifference !== null
        ? Math.abs(PredictionMathUtil.clamp(goalProductionDifference, -1, 1))
        : 0;

    const prevention =
      goalPreventionDifference !== null
        ? Math.abs(PredictionMathUtil.clamp(goalPreventionDifference, -1, 1))
        : 0;

    const goalEvidence = PredictionMathUtil.clamp(
      (production + prevention) / 2,
      0,
      1,
    );

    /*
     * When explicit coherence is unavailable, comparison
     * confidence is the neutral fallback.
     */
    const coherence = PredictionMathUtil.clamp(
      evidenceCoherence ?? confidence,
      0,
      1,
    );

    return PredictionMathUtil.clamp(
      confidence * 0.4 +
        directional * 0.1 +
        goalEvidence * 0.15 +
        coherence * 0.35,
      0,
      1,
    );
  }

  private calculateEvidenceAlignedConfidence(
    confidence: number,
    modelAgreement: number,
    safetyScore: number,
    dataQuality: number,
    calibrationReliability: number,
    comparisonEvidence: number,
  ): number {
    const support =
      modelAgreement * 0.3 +
      comparisonEvidence * 0.35 +
      (safetyScore / 100) * 0.12 +
      (dataQuality / 100) * 0.18 +
      this.calibrationSupport(calibrationReliability) * 0.05;

    /*
     * Strong evidence leaves ConfidenceEngine's result unchanged.
     */
    if (support >= 0.65) {
      return confidence;
    }

    /*
     * Weak evidence reduces confidence progressively.
     *
     * Probability itself is never changed here.
     */
    const supportRatio = PredictionMathUtil.clamp(support / 0.65, 0, 1);

    return confidence * (0.7 + supportRatio * 0.3);
  }

  private calibrationSupport(reliability: number): number {
    /*
     * No calibration history is neutral rather than destructive.
     */
    if (reliability <= 0) {
      return 0.5;
    }

    return PredictionMathUtil.clamp(reliability / 100, 0, 1);
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
