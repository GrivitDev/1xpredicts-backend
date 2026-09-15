import { Injectable } from '@nestjs/common';

import { PredictionTriggerResult } from '../interfaces/prediction-trigger-result.interface';

import { PredictionTriggerService } from './prediction-trigger.service';

@Injectable()
export class PredictionProcessingService {
  constructor(
    private readonly predictionTriggerService: PredictionTriggerService,
  ) {}

  async trigger(): Promise<PredictionTriggerResult> {
    return this.predictionTriggerService.trigger();
  }
}
