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

import {
  PredictionRun,
  PredictionRunSchema,
} from './schemas/prediction-run.schema';

import { PredictionTriggerService } from './services/prediction-trigger.service';
import { PredictionProcessingService } from './services/prediction-processing.service';
import { PredictionQueueService } from './services/prediction-queue.service';
import { PredictionWorkerService } from './services/prediction-worker.service';
import { PredictionEngineService } from './services/prediction-engine.service';
import { PredictionSaveService } from './services/prediction-save.service';
import { PredictionReadService } from './services/prediction-read.service';
import { PredictionRunReadService } from './services/prediction-run-read.service';
import { RawPredictionDataService } from './services/raw-prediction-data.service';
import { RawPredictionFeatureService } from './services/raw-prediction-feature.service';
import { MarketEvaluationService } from './services/market-evaluation.service';

import { CalibrationService } from './calibration/calibration.service';
import { CalibrationCalculator } from './calibration/calibration.calculator';
import { CalibrationAssessment } from './calibration/calibration.assessment';
import { CalibrationEngine } from './calibration/calibration.engine';

import { ValueEngine } from './engines/value/value.engine';
import { SafetyEngine } from './engines/safety/safety.engine';
import { ProbabilityEngine } from './engines/probability/probability.engine';
import { MarketModelRegistry } from './engines/probability/market-model.registry';

import { ResultMarketEngine } from './engines/probability/result-market.engine';
import { BttsMarketEngine } from './engines/probability/btts-market.engine';
import { GoalMarketEngine } from './engines/probability/goal-market.engine';
import { CleanSheetMarketEngine } from './engines/probability/clean-sheet-market.engine';
import { HalfMarketEngine } from './engines/probability/half-market.engine';
import { HandicapMarketEngine } from './engines/probability/handicap-market.engine';
import { FirstToScoreMarketEngine } from './engines/probability/first-to-score-market.engine';

import { EnsembleEngine } from './engines/ensemble/ensemble.engine';
import { ConfidenceEngine } from './engines/ensemble/confidence.engine';
import { FinalDecisionEngine } from './engines/final/final-decision.engine';

import { SettlementModule } from './settlement/settlement.module';

import { PredictionsEngineController } from './controllers/predictions-engine.controller';
import { PredictionsReadController } from './controllers/predictions-read.controller';
import { SettlementController } from './controllers/settlement.controller';
import { PredictionQueueWorkerService } from './services/prediction-queue-worker.service';
import {
  EspnFixture,
  EspnFixtureSchema,
} from 'src/sports/schemas/espn/espn-fixture.schema';
import {
  ActiveCompetition,
  ActiveCompetitionSchema,
} from 'src/sports/schemas/active-competition.schema';

@Module({
  imports: [
    /*
     * Sports owns all factual sports models and services.
     */
    SportsModule,

    SettlementModule,

    /*
     * Prediction-specific persistence only.
     *
     * Sports models are intentionally not registered again
     * in this module.
     */
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

      {
        name: PredictionRun.name,
        schema: PredictionRunSchema,
      },
      {
        name: EspnFixture.name,
        schema: EspnFixtureSchema,
      },

      {
        name: ActiveCompetition.name,
        schema: ActiveCompetitionSchema,
      },
    ]),
  ],

  controllers: [
    PredictionsEngineController,
    PredictionsReadController,
    SettlementController,
  ],

  providers: [
    PredictionTriggerService,
    PredictionProcessingService,
    PredictionQueueService,
    PredictionQueueWorkerService,
    PredictionWorkerService,

    PredictionEngineService,
    PredictionSaveService,

    PredictionReadService,
    PredictionRunReadService,

    RawPredictionDataService,
    RawPredictionFeatureService,

    MarketEvaluationService,

    CalibrationService,
    CalibrationCalculator,
    CalibrationAssessment,
    CalibrationEngine,

    ValueEngine,
    SafetyEngine,
    ProbabilityEngine,
    MarketModelRegistry,

    ResultMarketEngine,
    BttsMarketEngine,
    GoalMarketEngine,
    CleanSheetMarketEngine,
    HalfMarketEngine,
    HandicapMarketEngine,
    FirstToScoreMarketEngine,

    EnsembleEngine,
    ConfidenceEngine,
    FinalDecisionEngine,
  ],

  exports: [
    PredictionTriggerService,
    PredictionProcessingService,
    PredictionEngineService,

    PredictionReadService,
    PredictionRunReadService,

    CalibrationService,

    RawPredictionDataService,
    RawPredictionFeatureService,
  ],
})
export class PredictionsEngineModule {}
