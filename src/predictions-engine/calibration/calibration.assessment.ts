// src/predictions-engine/calibration/calibration.assessment.ts

import { PREDICTION_ENGINE_CONFIG } from '../config/prediction-engine.config';

import {
  CalibrationAssessmentInput,
  CalibrationFailureAssessment,
} from './calibration.types';

export class CalibrationAssessment {
  assess(input: CalibrationAssessmentInput): CalibrationFailureAssessment {
    const averageConfidence = this.clamp(input.averageConfidence, 0, 98);

    const sampleSize = Math.max(Math.floor(input.sampleSize ?? 0), 0);

    const calibrationError = this.clamp(input.calibrationError, 0, 1);

    const evidenceSupport = this.clamp(input.evidenceSupport ?? 0, 0, 1);

    const meaningfulThreshold =
      PREDICTION_ENGINE_CONFIG.calibration.meaningfulConfidenceThreshold;

    const minimumSamples =
      PREDICTION_ENGINE_CONFIG.calibration.minimumSamplesForAdjustment;

    const severeThreshold =
      PREDICTION_ENGINE_CONFIG.calibration.severeFailureThreshold;

    const criticalThreshold =
      PREDICTION_ENGINE_CONFIG.calibration.criticalFailureThreshold;

    const highConfidenceSampleSize = Math.max(
      Math.floor(input.highConfidenceSampleSize ?? 0),
      0,
    );

    const highConfidenceGap = this.clampSigned(
      input.highConfidenceCalibrationGap ?? 0,
      -1,
      1,
    );

    const evidenceSupportedHighConfidenceSampleSize = Math.max(
      Math.floor(input.evidenceSupportedHighConfidenceSampleSize ?? 0),
      0,
    );

    const evidenceSupportedHighConfidenceGap = this.clampSigned(
      input.evidenceSupportedHighConfidenceCalibrationGap ?? 0,
      -1,
      1,
    );

    /*
     * ----------------------------------------------------------
     * SYSTEMATIC CALIBRATION TEST
     * ----------------------------------------------------------
     *
     * A prediction losing is not, by itself, calibration failure.
     *
     * The primary test is whether the aggregate observed success
     * rate is materially different from the aggregate predicted
     * probability.
     *
     * The evidence-support signal prevents a weak-data collection
     * from being treated as strong evidence of systematic model
     * bias.
     */
    const aggregateMiscalibration = calibrationError >= 0.05;

    const sufficientEvidence = evidenceSupport >= 0.5;

    const sufficientSample = sampleSize >= minimumSamples;

    /*
     * ----------------------------------------------------------
     * HIGH-CONFIDENCE VALIDATION
     * ----------------------------------------------------------
     *
     * High-confidence failures are only concerning when the
     * observed failure rate is materially worse than the failure
     * rate implied by the predicted probabilities.
     *
     * A single 80% prediction losing therefore does not establish
     * calibration failure.
     */
    const highConfidenceSystematic =
      highConfidenceSampleSize >= Math.max(5, Math.floor(minimumSamples / 2)) &&
      highConfidenceGap >= 0.05;

    /*
     * Strong-evidence high-confidence predictions provide the
     * cleanest test of whether failures are systematic rather than
     * simply associated with weak input data.
     */
    const evidenceSupportedSystematic =
      evidenceSupportedHighConfidenceSampleSize >=
        Math.max(5, Math.floor(minimumSamples / 2)) &&
      evidenceSupportedHighConfidenceGap >= 0.05;

    const systematicFailure =
      aggregateMiscalibration &&
      sufficientSample &&
      sufficientEvidence &&
      (highConfidenceSampleSize === 0 ||
        highConfidenceSystematic ||
        evidenceSupportedSystematic);

    const meaningful =
      averageConfidence >= meaningfulThreshold && systematicFailure;

    const severe =
      averageConfidence >= severeThreshold &&
      calibrationError >= 0.1 &&
      sufficientSample &&
      evidenceSupport >= 0.6 &&
      evidenceSupportedHighConfidenceSampleSize >=
        Math.max(5, minimumSamples) &&
      evidenceSupportedHighConfidenceGap >= 0.08;

    const critical =
      averageConfidence >= criticalThreshold &&
      calibrationError >= 0.15 &&
      sufficientSample &&
      evidenceSupport >= 0.7 &&
      evidenceSupportedHighConfidenceSampleSize >=
        Math.max(10, minimumSamples * 2) &&
      evidenceSupportedHighConfidenceGap >= 0.12;

    const shouldAdjust =
      meaningful && sampleSize >= minimumSamples && evidenceSupport >= 0.5;

    let reason =
      'Calibration is within the current tolerance and no systematic evidence of model miscalibration has been established.';

    if (critical) {
      reason =
        'Critical systematic calibration failure detected across sufficiently supported high-confidence predictions.';
    } else if (severe) {
      reason =
        'Severe systematic calibration failure detected across sufficiently supported high-confidence predictions.';
    } else if (meaningful) {
      reason =
        'Meaningful systematic calibration error detected after accounting for prediction evidence and expected outcome rates.';
    } else if (
      calibrationError >= 0.05 &&
      (evidenceSupport < 0.5 ||
        highConfidenceSampleSize < Math.max(5, Math.floor(minimumSamples / 2)))
    ) {
      reason =
        'Observed calibration error is present, but the available evidence or high-confidence sample is insufficient to treat it as systematic model failure.';
    }

    return {
      meaningful,
      severe,
      critical,
      shouldAdjust,
      reason,
    };
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }

  private clampSigned(value: number, minimum: number, maximum: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
