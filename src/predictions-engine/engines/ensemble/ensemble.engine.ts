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
    const confidence = this.confidenceEngine.calculate(input);

    const modelAgreement = PredictionMathUtil.clamp(
      input.probability.modelAgreement ?? 0,
      0,
      1,
    );

    return {
      market: input.probability.market,

      selection: input.probability.selection,

      probability: PredictionMathUtil.round(
        PredictionMathUtil.clamp(input.probability.probability, 0, 1),
        6,
      ),

      confidence: ConfidenceUtil.clamp(confidence.confidence),

      modelAgreement: PredictionMathUtil.round(modelAgreement, 4),

      dataQuality: confidence.dataQuality,

      calibrationReliability: confidence.calibrationReliability,

      probabilityResult: input.probability,

      safetyResult: input.safety,
    };
  }
}
