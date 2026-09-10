import { Injectable, NotFoundException } from '@nestjs/common';

import { FixtureAnalysisService } from './fixture-analysis.service';

import { PredictionSourceOrchestratorService } from './prediction-source-orchestrator.service';

import { FinalDecisionService } from './final-decision.service';

import { FinalMarketDecision } from '../interfaces/final-decision-result.interface';

@Injectable()
export class PredictionsEngineService {
  constructor(
    private readonly fixtureAnalysisService: FixtureAnalysisService,

    private readonly predictionSourceOrchestratorService: PredictionSourceOrchestratorService,

    private readonly finalDecisionService: FinalDecisionService,
  ) {}

  async generate(fixtureId: number): Promise<FinalMarketDecision[]> {
    const fixtureAnalysis = await this.fixtureAnalysisService.build(fixtureId);

    if (!fixtureAnalysis) {
      throw new NotFoundException(`Fixture ${fixtureId} could not be analysed`);
    }

    const sourceRun =
      await this.predictionSourceOrchestratorService.run(fixtureAnalysis);

    return this.finalDecisionService.decide([
      sourceRun.statistical,
      sourceRun.grok,
      sourceRun.gemini,
    ]);
  }
}
