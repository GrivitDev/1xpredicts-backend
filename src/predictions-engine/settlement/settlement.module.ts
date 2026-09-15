import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  EspnFixture,
  EspnFixtureSchema,
} from '../../sports/schemas/espn/espn-fixture.schema';

import {
  PredictionEnginePrediction,
  PredictionEnginePredictionSchema,
} from '../schemas/prediction.schema';

import {
  PredictionRun,
  PredictionRunSchema,
} from '../schemas/prediction-run.schema';

import {
  PredictionCalibration,
  PredictionCalibrationSchema,
} from '../schemas/prediction-calibration.schema';

import { SettlementService } from '../services/settlement.service';

import { SettlementTriggerService } from '../services/settlement-trigger.service';

import { PredictionSettlementService } from '../services/prediction-settlement.service';

import { PredictionRunSettlementService } from '../services/prediction-run-settlement.service';

import { CalibrationService } from '../calibration/calibration.service';

import { CalibrationCalculator } from '../calibration/calibration.calculator';

import { CalibrationAssessment } from '../calibration/calibration.assessment';

import { CalibrationEngine } from '../calibration/calibration.engine';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: EspnFixture.name,
        schema: EspnFixtureSchema,
      },
      {
        name: PredictionEnginePrediction.name,
        schema: PredictionEnginePredictionSchema,
      },
      {
        name: PredictionRun.name,
        schema: PredictionRunSchema,
      },
      {
        name: PredictionCalibration.name,
        schema: PredictionCalibrationSchema,
      },
    ]),
  ],

  providers: [
    SettlementService,
    SettlementTriggerService,
    PredictionSettlementService,
    PredictionRunSettlementService,

    CalibrationService,
    CalibrationCalculator,
    CalibrationAssessment,
    CalibrationEngine,
  ],

  exports: [SettlementService, SettlementTriggerService],
})
export class SettlementModule {}
