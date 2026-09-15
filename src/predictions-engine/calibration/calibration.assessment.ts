import { PREDICTION_ENGINE_CONFIG } from '../config/prediction-engine.config';
import {
  CalibrationAssessmentInput,
  CalibrationFailureAssessment,
} from './calibration.types';

export class CalibrationAssessment {
  assess(input: CalibrationAssessmentInput): CalibrationFailureAssessment {
    const averageConfidence = this.clamp(input.averageConfidence, 0, 98);

    const sampleSize = Math.max(Math.floor(input.sampleSize), 0);

    const calibrationError = this.clamp(input.calibrationError, 0, 1);

    const meaningfulThreshold =
      PREDICTION_ENGINE_CONFIG.calibration.meaningfulConfidenceThreshold;

    const minimumSamples =
      PREDICTION_ENGINE_CONFIG.calibration.minimumSamplesForAdjustment;

    const severeThreshold =
      PREDICTION_ENGINE_CONFIG.calibration.severeFailureThreshold;

    const criticalThreshold =
      PREDICTION_ENGINE_CONFIG.calibration.criticalFailureThreshold;

    const meaningful =
      averageConfidence >= meaningfulThreshold && calibrationError > 0;

    const severe =
      averageConfidence >= severeThreshold && calibrationError >= 0.1;

    const critical =
      averageConfidence >= criticalThreshold && calibrationError >= 0.15;

    const shouldAdjust = meaningful && sampleSize >= minimumSamples;

    let reason = 'Calibration is within the current tolerance.';

    if (critical) {
      reason = 'Critical high-confidence calibration failure detected.';
    } else if (severe) {
      reason = 'Severe high-confidence calibration failure detected.';
    } else if (meaningful) {
      reason = 'Meaningful calibration error detected.';
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
}
