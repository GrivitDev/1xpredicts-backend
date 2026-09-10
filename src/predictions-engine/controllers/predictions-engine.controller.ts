import { Controller, Get, Param, Post, Query } from '@nestjs/common';

import { PredictionGenerationService } from '../services/prediction-generation.service';
import { PredictionSaveService } from '../services/prediction-save.service';

@Controller('predictions-engine')
export class PredictionsEngineController {
  constructor(
    private readonly predictionGenerationService: PredictionGenerationService,
    private readonly predictionSaveService: PredictionSaveService,
  ) {}

  @Post(':fixtureId/generate')
  async generate(
    @Param('fixtureId') fixtureId: string,
    @Query('forceRefresh') forceRefresh?: string,
  ) {
    return this.predictionGenerationService.generate(fixtureId, {
      forceRefresh: forceRefresh === 'true',
    });
  }

  @Get('fixture/:fixtureId')
  async getByFixture(@Param('fixtureId') fixtureId: string) {
    return this.predictionSaveService.findByFixture(fixtureId);
  }

  @Get(':predictionId')
  async getById(@Param('predictionId') predictionId: string) {
    return this.predictionSaveService.findById(predictionId);
  }
}
