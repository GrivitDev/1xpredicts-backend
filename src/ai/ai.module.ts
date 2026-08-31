// src/ai/ai.module.ts

import { Module } from '@nestjs/common';

import { MongooseModule } from '@nestjs/mongoose';

import { GeminiModule } from './gemini/gemini.module';

import { TavilyModule } from '../tavily/tavily.module';

import { SportsModule } from '../sports/sports.module';

import { PredictionsModule } from '../predictions/predictions.module';

import { CommunityModule } from '../community/community.module';

import { UploadsModule } from '../uploads/uploads.module';

// ============================================================
// COMMUNITY AI
// ============================================================

import { AiCommunityPostService } from './community-post/ai-community-post.service';

import { AiCommunityDiscussionService } from './community-discussions/ai-community-discussion.service';

// ============================================================
// VIDEO AI
// ============================================================

import { AiVideoService } from './videos/ai-video.service';

// ============================================================
// PREDICTION AI
// ============================================================

import { AiPredictionService } from './predictions/ai-prediction.service';

import { AiPredictionDataService } from './predictions/ai-prediction-data.service';

import { AiPredictionController } from './predictions/ai-prediction.controller';

// ============================================================
// SCHEDULERS
// ============================================================

import { AiSchedulerService } from './ai-scheduler.service';

import { AiContentSchedulerService } from './ai-content-scheduler.service';

import { AiLeagueIntelligenceScheduler } from './league-intelligence/ai-league-intelligence.scheduler';

// ============================================================
// LEAGUE INTELLIGENCE
// ============================================================

import { AiLeagueIntelligenceService } from './league-intelligence/ai-league-intelligence.service';

import {
  AiLeagueIntelligence,
  AiLeagueIntelligenceSchema,
} from './league-intelligence/ai-league-intelligence.schema';

@Module({
  imports: [
    GeminiModule,

    TavilyModule,

    SportsModule,

    PredictionsModule,

    CommunityModule,

    UploadsModule,

    MongooseModule.forFeature([
      {
        name: AiLeagueIntelligence.name,

        schema: AiLeagueIntelligenceSchema,
      },
    ]),
  ],

  controllers: [AiPredictionController],

  providers: [
    AiCommunityPostService,

    AiCommunityDiscussionService,

    AiVideoService,

    AiPredictionService,

    AiPredictionDataService,

    AiSchedulerService,

    AiContentSchedulerService,

    AiLeagueIntelligenceService,

    AiLeagueIntelligenceScheduler,
  ],

  exports: [
    AiCommunityPostService,

    AiCommunityDiscussionService,

    AiVideoService,

    AiPredictionService,

    AiPredictionDataService,

    AiLeagueIntelligenceService,
  ],
})
export class AiModule {}
