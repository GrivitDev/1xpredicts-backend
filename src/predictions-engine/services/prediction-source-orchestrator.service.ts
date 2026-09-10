// src/predictions-engine/services/prediction-source-orchestrator.service.ts

import { Injectable, Logger } from '@nestjs/common';

import { FixtureAnalysis } from '../interfaces/fixture-analysis.interface';

import { PredictionSignal } from '../interfaces/prediction-signal.interface';

import { PredictionSourceRun } from '../interfaces/prediction-source-run.interface';

import { PredictionStatus } from '../enums/prediction-status.enum';

import { PredictionSource } from '../enums/prediction-source.enum';

import { AiPredictionRequestService } from './ai-prediction-request.service';

import { GeminiPredictionEngine } from '../engines/ai/gemini-prediction.engine';

import { GroqPredictionEngine } from '../engines/ai/grok-prediction.engine';

import { StatisticalPredictionEngine } from '../engines/statistical/statistical-prediction.engine';

import { StatisticalSignalService } from './statistical-signal.service';

@Injectable()
export class PredictionSourceOrchestratorService {
  private readonly logger = new Logger(
    PredictionSourceOrchestratorService.name,
  );

  constructor(
    private readonly statisticalPredictionEngine: StatisticalPredictionEngine,

    private readonly statisticalSignalService: StatisticalSignalService,

    private readonly aiPredictionRequestService: AiPredictionRequestService,

    private readonly groqPredictionEngine: GroqPredictionEngine,

    private readonly geminiPredictionEngine: GeminiPredictionEngine,
  ) {}

  async run(fixtureAnalysis: FixtureAnalysis): Promise<PredictionSourceRun> {
    const request = this.aiPredictionRequestService.build(fixtureAnalysis);

    const [statistical, groq, gemini] = await Promise.all([
      this.runStatistical(fixtureAnalysis),
      this.runGroq(request),
      this.runGemini(request),
    ]);

    const signals = [statistical, groq, gemini];

    const successfulSources = signals.filter(
      (signal) =>
        signal.status === PredictionStatus.COMPLETED ||
        signal.status === PredictionStatus.PARTIAL,
    ).length;

    return {
      statistical,
      grok: groq,
      gemini,
      completedAt: new Date(),
      successfulSources,
      attemptedSources: signals.length,
    };
  }

  private async runStatistical(
    fixtureAnalysis: FixtureAnalysis,
  ): Promise<PredictionSignal> {
    try {
      const output =
        await this.statisticalPredictionEngine.generate(fixtureAnalysis);

      return this.statisticalSignalService.build(output);
    } catch (error) {
      this.logger.error(
        `Statistical prediction failed for fixture ${fixtureAnalysis.fixture.fixtureId}`,
        error instanceof Error ? error.stack : String(error),
      );

      return {
        source: PredictionSource.STATISTICAL,
        status: PredictionStatus.FAILED,
        generatedAt: new Date(),
        modelName: 'statistical',
        modelVersion: 'unknown',
        recommendations: [],
      } satisfies PredictionSignal;
    }
  }

  private async runGroq(
    request: ReturnType<AiPredictionRequestService['build']>,
  ): Promise<PredictionSignal> {
    return this.groqPredictionEngine.generate(request);
  }

  private async runGemini(
    request: ReturnType<AiPredictionRequestService['build']>,
  ): Promise<PredictionSignal> {
    return this.geminiPredictionEngine.generate(request);
  }
}
