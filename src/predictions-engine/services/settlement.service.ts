import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  EspnFixture,
  EspnFixtureDocument,
} from '../../sports/schemas/espn/espn-fixture.schema';

import {
  PredictionEnginePrediction,
  PredictionEnginePredictionDocument,
} from '../schemas/prediction.schema';

import { PredictionSettlementService } from './prediction-settlement.service';

import { PredictionRunSettlementService } from './prediction-run-settlement.service';

import { EspnSettlementUtil } from '../utils/espn-settlement.util';

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    @InjectModel(EspnFixture.name)
    private readonly fixtureModel: Model<EspnFixtureDocument>,

    @InjectModel(PredictionEnginePrediction.name)
    private readonly predictionModel: Model<PredictionEnginePredictionDocument>,

    private readonly predictionSettlementService: PredictionSettlementService,

    private readonly predictionRunSettlementService: PredictionRunSettlementService,
  ) {}

  async settleEvent(eventId: string) {
    const normalizedEventId = String(eventId).trim();

    if (!normalizedEventId) {
      throw new NotFoundException('Event ID is required.');
    }

    const fixture = await this.fixtureModel
      .findOne({
        eventId: normalizedEventId,
        completed: true,
      })
      .exec();

    if (!fixture) {
      throw new NotFoundException(
        `Completed ESPN fixture not found for ${normalizedEventId}.`,
      );
    }

    const predictionExists = await this.predictionModel.exists({
      eventId: normalizedEventId,
    });

    if (!predictionExists) {
      throw new NotFoundException(
        `No predictions found for ${normalizedEventId}.`,
      );
    }

    const score = EspnSettlementUtil.extract(fixture);

    if (!score) {
      throw new Error(
        `Unable to extract a valid final score for ${normalizedEventId}.`,
      );
    }

    const result = await this.predictionSettlementService.settleEvent(
      normalizedEventId,
      score,
    );

    const run =
      await this.predictionRunSettlementService.rebuild(normalizedEventId);

    this.logger.log(
      `Fixture settlement finished: event=${normalizedEventId} settled=${result.settled} runStatus=${run.status}`,
    );

    return {
      ...result,
      run,
    };
  }
}
