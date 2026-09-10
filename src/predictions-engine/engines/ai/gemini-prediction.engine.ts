import { Injectable } from '@nestjs/common';

import { OddsCalculator } from '../../calculators/odds.calculator';

import { PredictionSource } from '../../enums/prediction-source.enum';

import { PredictionStatus } from '../../enums/prediction-status.enum';

import { PredictionSignal } from '../../interfaces/prediction-signal.interface';

import { AiPredictionRequest } from '../../interfaces/ai-prediction.interface';

import { GeminiPredictionService } from '../../services/gemini-prediction.service';

@Injectable()
export class GeminiPredictionEngine {
  private readonly modelVersion = 'configured';

  constructor(
    private readonly geminiPredictionService: GeminiPredictionService,

    private readonly oddsCalculator: OddsCalculator,
  ) {}

  async generate(request: AiPredictionRequest): Promise<PredictionSignal> {
    try {
      const result = await this.geminiPredictionService.generate(request);

      const completedAt = new Date();

      const recommendations = result.recommendations.map((recommendation) => ({
        market: recommendation.market,

        selection: recommendation.selection,

        probability: recommendation.probability,

        confidence: recommendation.confidence,

        odds: this.oddsCalculator.percentageToFairOdds(
          recommendation.probability,
        ),

        reasonCodes: recommendation.reasonCodes,
      }));

      const modelName = 'Gemini';

      return {
        source: PredictionSource.GEMINI,

        status:
          recommendations.length > 0
            ? PredictionStatus.COMPLETED
            : PredictionStatus.PARTIAL,

        generatedAt: completedAt,

        modelName,

        modelVersion: this.modelVersion,

        matchProbability: result.matchProbability,

        recommendations,

        dataQuality: request.dataQuality,

        errorCode: undefined,

        errorMessage: undefined,
      };
    } catch (error) {
      const completedAt = new Date();

      return {
        source: PredictionSource.GEMINI,

        status: PredictionStatus.FAILED,

        generatedAt: completedAt,

        modelName: 'Gemini',

        modelVersion: this.modelVersion,

        recommendations: [],

        dataQuality: request.dataQuality,

        errorCode: 'GEMINI_REQUEST_FAILED',

        errorMessage:
          error instanceof Error ? error.message : 'Gemini request failed',
      };
    }
  }
}
