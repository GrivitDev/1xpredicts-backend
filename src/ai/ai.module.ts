// src/ai/ai.module.ts

import { Module } from '@nestjs/common';

import { GeminiModule } from './gemini/gemini.module';

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
// IMAGE AI
// ============================================================

import { AiImageService } from './images/ai-image.service';

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

@Module({
  imports: [
    GeminiModule,

    SportsModule,

    PredictionsModule,

    CommunityModule,

    UploadsModule,
  ],

  controllers: [AiPredictionController],

  providers: [
    AiCommunityPostService,
    AiCommunityDiscussionService,

    AiImageService,

    AiVideoService,

    AiPredictionService,
    AiPredictionDataService,

    AiSchedulerService,
    AiContentSchedulerService,
  ],

  exports: [
    AiCommunityPostService,
    AiCommunityDiscussionService,

    AiImageService,

    AiVideoService,

    AiPredictionService,
    AiPredictionDataService,
  ],
})
export class AiModule {}
