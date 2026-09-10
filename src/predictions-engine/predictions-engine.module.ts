import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { SportsModule } from '../sports/sports.module';

import { Prediction, PredictionSchema } from './schemas/prediction.schema';
import {
  PredictionQueue,
  PredictionQueueSchema,
} from './schemas/prediction-queue.schema';
import {
  PredictionCalibration,
  PredictionCalibrationSchema,
} from './schemas/prediction-calibration.schema';

import { PredictionsEngineController } from './controllers/predictions-engine.controller';

import { GoalModelEngine } from './engines/statistical/goal-model.engine';
import { MatchResultEngine } from './engines/statistical/match-result.engine';
import { GoalsMarketEngine } from './engines/statistical/goals-market.engine';
import { BttsMarketEngine } from './engines/statistical/btts-market.engine';
import { HalfGoalsEngine } from './engines/statistical/half-goals.engine';
import { HandicapMarketEngine } from './engines/statistical/handicap-market.engine';
import { StatisticalPredictionEngine } from './engines/statistical/statistical-prediction.engine';

import { GeminiPredictionEngine } from './engines/ai/gemini-prediction.engine';
import { GroqPredictionEngine } from './engines/ai/grok-prediction.engine';

import { FinalDecisionEngine } from './engines/final/final-decision.engine';

import { AsianHandicapMarket } from './markets/asian-handicap.market';
import { BttsGoalsMarket } from './markets/btts-goals.market';
import { BttsMarket } from './markets/btts.market';
import { CleanSheetMarket } from './markets/clean-sheet.market';
import { DoubleChanceMarket } from './markets/double-chance.market';
import { DrawNoBetMarket } from './markets/draw-no-bet.market';
import { EuropeanHandicapMarket } from './markets/european-handicap.market';
import { FirstHalfGoalsMarket } from './markets/first-half-goals.market';
import { GoalRangeMarket } from './markets/goal-range.market';
import { OverUnderMarket } from './markets/over-under.market';
import { SecondHalfGoalsMarket } from './markets/second-half-goals.market';
import { TeamTotalGoalsMarket } from './markets/team-total-goals.market';

import { CalibrationService } from './calibration/calibration.service';
import { CalibrationTrackerService } from './calibration/calibration-tracker.service';

import { ConfidenceCalculator } from './calculators/confidence.calculator';
import { JointProbabilityCalculator } from './calculators/joint-probability.calculator';
import { ProbabilityCalculator } from './calculators/probability.calculator';
import { RiskCalculator } from './calculators/risk.calculator';
import { OddsCalculator } from './calculators/odds.calculator';

import { AiPredictionPromptService } from './services/ai-prediction-prompt.service';
import { AiPredictionRequestService } from './services/ai-prediction-request.service';
import { FinalDecisionService } from './services/final-decision.service';
import { FixtureAnalysisService } from './services/fixture-analysis.service';
import { GeminiPredictionService } from './services/gemini-prediction.service';
import { GroqPredictionService } from './services/groq-prediction.service';
import { HalfGoalDistributionService } from './services/half-goal-distribution.service';
import { PredictionCombinationService } from './services/prediction-combination.service';
import { PredictionConfidenceService } from './services/prediction-confidence.service';
import { PredictionGenerationService } from './services/prediction-generation.service';
import { PredictionOddsService } from './services/prediction-odds.service';
import { PredictionProbabilityService } from './services/prediction-probability.service';
import { PredictionProcessingService } from './services/prediction-processing.service';
import { PredictionQueueService } from './services/prediction-queue.service';
import { PredictionRiskService } from './services/prediction-risk.service';
import { PredictionSaveService } from './services/prediction-save.service';
import { PredictionSchedulerService } from './services/prediction-scheduler.service';
import { PredictionSignalService } from './services/prediction-signal.service';
import { PredictionSourceOrchestratorService } from './services/prediction-source-orchestrator.service';
import { PredictionsEngineService } from './services/predictions-engine.service';
import { SignalAggregatorService } from './services/signal-aggregator.service';
import { StatisticalSignalService } from './services/statistical-signal.service';

import { PredictionQueueBuilderCron } from './schedulers/prediction-queue-builder.cron';
import { PredictionProcessingCron } from './schedulers/prediction-processing.cron';

@Module({
  imports: [
    SportsModule,

    MongooseModule.forFeature([
      {
        name: Prediction.name,
        schema: PredictionSchema,
      },
      {
        name: PredictionQueue.name,
        schema: PredictionQueueSchema,
      },
      {
        name: PredictionCalibration.name,
        schema: PredictionCalibrationSchema,
      },
    ]),
  ],

  controllers: [PredictionsEngineController],

  providers: [
    // ============================================================
    // STATISTICAL ENGINES
    // ============================================================

    GoalModelEngine,
    MatchResultEngine,
    GoalsMarketEngine,
    BttsMarketEngine,
    HalfGoalsEngine,
    HandicapMarketEngine,
    StatisticalPredictionEngine,

    // ============================================================
    // MARKETS
    // ============================================================

    AsianHandicapMarket,
    BttsGoalsMarket,
    BttsMarket,
    CleanSheetMarket,
    DoubleChanceMarket,
    DrawNoBetMarket,
    EuropeanHandicapMarket,
    FirstHalfGoalsMarket,
    GoalRangeMarket,
    OverUnderMarket,
    SecondHalfGoalsMarket,
    TeamTotalGoalsMarket,

    // ============================================================
    // AI ENGINES / SERVICES
    // ============================================================

    GeminiPredictionEngine,
    GroqPredictionEngine,

    GeminiPredictionService,
    GroqPredictionService,

    AiPredictionPromptService,
    AiPredictionRequestService,

    // ============================================================
    // FINAL DECISION
    // ============================================================

    FinalDecisionEngine,
    FinalDecisionService,

    // ============================================================
    // CALCULATORS
    // ============================================================

    ConfidenceCalculator,
    JointProbabilityCalculator,
    ProbabilityCalculator,
    RiskCalculator,
    OddsCalculator,

    // ============================================================
    // SIGNALS
    // ============================================================

    FixtureAnalysisService,
    StatisticalSignalService,
    PredictionSignalService,
    PredictionSourceOrchestratorService,
    SignalAggregatorService,

    // ============================================================
    // PREDICTION SERVICES
    // ============================================================

    PredictionProbabilityService,
    PredictionConfidenceService,
    PredictionRiskService,
    PredictionOddsService,
    PredictionCombinationService,

    HalfGoalDistributionService,

    // ============================================================
    // CALIBRATION
    // ============================================================

    CalibrationService,
    CalibrationTrackerService,

    // ============================================================
    // QUEUE / GENERATION / PROCESSING
    // ============================================================

    PredictionQueueService,
    PredictionSchedulerService,
    PredictionGenerationService,
    PredictionProcessingService,
    PredictionSaveService,

    PredictionsEngineService,

    // ============================================================
    // CRONS
    // ============================================================

    PredictionQueueBuilderCron,
    PredictionProcessingCron,
  ],

  exports: [
    PredictionGenerationService,
    PredictionSaveService,
    PredictionCombinationService,
    PredictionsEngineService,
  ],
})
export class PredictionsEngineModule {}
