import { Injectable, Logger } from '@nestjs/common';

import { PredictionTriggerResult } from '../interfaces/prediction-trigger-result.interface';

import { PredictionQueueService } from './prediction-queue.service';

import { PredictionWorkerService } from './prediction-worker.service';

@Injectable()
export class PredictionTriggerService {
  private readonly logger = new Logger(PredictionTriggerService.name);

  constructor(
    private readonly predictionQueueService: PredictionQueueService,

    private readonly predictionWorkerService: PredictionWorkerService,
  ) {}

  async trigger(): Promise<PredictionTriggerResult> {
    const queueResult = await this.predictionQueueService.trigger();

    if (queueResult.total <= 0) {
      return {
        ...queueResult,
        workerStarted: false,
      };
    }

    const workerStarted = await this.predictionWorkerService.start();

    this.logger.log(
      `Prediction trigger completed: queued=${queueResult.queued} alreadyQueued=${queueResult.alreadyQueued} skipped=${queueResult.skipped} workerStarted=${workerStarted}`,
    );

    return {
      ...queueResult,
      workerStarted,
    };
  }
}
