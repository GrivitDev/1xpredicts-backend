import { Injectable } from '@nestjs/common';

import { OddsCalculator } from '../../calculators/odds.calculator';

import { PredictionSource } from '../../enums/prediction-source.enum';

import { PredictionStatus } from '../../enums/prediction-status.enum';

import { PredictionSignal } from '../../interfaces/prediction-signal.interface';

import { AiPredictionRequest } from '../../interfaces/ai-prediction.interface';

import { GroqPredictionService } from '../../services/groq-prediction.service';

@Injectable()
export class GroqPredictionEngine {
  private readonly modelVersion = 'configured';

  constructor(
    private readonly groqPredictionService: GroqPredictionService,

    private readonly oddsCalculator: OddsCalculator,
  ) {}

  async generate(request: AiPredictionRequest): Promise<PredictionSignal> {
    try {
      const result = await this.groqPredictionService.generate(request);

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

      return {
        source: PredictionSource.GROK,

        status:
          recommendations.length > 0
            ? PredictionStatus.COMPLETED
            : PredictionStatus.PARTIAL,

        generatedAt: new Date(),

        modelName: 'Groq',

        modelVersion: this.modelVersion,

        matchProbability: result.matchProbability,

        recommendations,

        dataQuality: request.dataQuality,

        errorCode: undefined,

        errorMessage: undefined,
      };
    } catch (error) {
      return {
        source: PredictionSource.GROK,

        status: PredictionStatus.FAILED,

        generatedAt: new Date(),

        modelName: 'Groq',

        modelVersion: this.modelVersion,

        recommendations: [],

        dataQuality: request.dataQuality,

        errorCode: 'GROQ_REQUEST_FAILED',

        errorMessage:
          error instanceof Error ? error.message : 'Groq request failed',
      };
    }
  }
}
