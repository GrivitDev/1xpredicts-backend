// src/ai/predictions/ai-prediction.controller.ts

import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

import { RolesGuard } from '../../common/guards/roles.guard';

import { Roles } from '../../common/decorators/roles.decorator';

import { AiPredictionDataService } from './ai-prediction-data.service';

import { AiPredictionService } from './ai-prediction.service';

import { PredictionMarket } from '../../predictions/constants/prediction-markets';

interface AnalyzePredictionBody {
  requestedMarkets?: PredictionMarket[];

  additionalNews?: string[];

  additionalContext?: string;
}

@Controller('ai/predictions')
export class AiPredictionController {
  constructor(
    private readonly aiPredictionDataService: AiPredictionDataService,

    private readonly aiPredictionService: AiPredictionService,
  ) {}

  // ==========================================================
  // ANALYZE ONE MATCH
  // ==========================================================

  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('analyze/:matchId')
  async analyzeMatch(
    @Param('matchId')
    matchId: string,

    @Body()
    body: AnalyzePredictionBody,
  ) {
    const match = await this.aiPredictionDataService.buildMatchInput(matchId);

    if (Array.isArray(body?.additionalNews)) {
      match.additionalNews = body.additionalNews
        .filter((item) => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);
    }

    if (typeof body?.additionalContext === 'string') {
      match.additionalContext = body.additionalContext.trim();
    }

    const prediction = await this.aiPredictionService.generatePrediction({
      match,

      requestedMarkets: body?.requestedMarkets,

      includeReasoning: true,
    });

    return {
      success: true,

      data: prediction,
    };
  }
}
