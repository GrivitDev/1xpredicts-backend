import { Injectable, Logger } from '@nestjs/common';

import { PredictionQueueService } from './prediction-queue.service';
import { PredictionEngineService } from './prediction-engine.service';
import { PredictionSaveService } from './prediction-save.service';

@Injectable()
export class PredictionWorkerService {
  private readonly logger = new Logger(PredictionWorkerService.name);

  private running = false;

  constructor(
    private readonly queueService: PredictionQueueService,
    private readonly predictionEngineService: PredictionEngineService,
    private readonly predictionSaveService: PredictionSaveService,
  ) {}

  async start(): Promise<boolean> {
    if (this.running) {
      return false;
    }

    this.running = true;

    try {
      await this.drainQueue();
      return true;
    } finally {
      this.running = false;
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  private async drainQueue(): Promise<void> {
    while (true) {
      const item = await this.queueService.claimNext();

      if (!item) {
        break;
      }

      try {
        const result = await this.predictionEngineService.generate(
          item.eventId,
        );

        if (!result) {
          throw new Error(`Match-derived data not found for ${item.eventId}`);
        }

        await this.predictionSaveService.saveMany(
          result.run,
          result.predictions,
        );

        await this.queueService.complete(item.eventId);

        this.logger.debug(`Prediction completed: ${item.eventId}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        await this.queueService.fail(item.eventId, message);

        this.logger.error(`Prediction failed for ${item.eventId}: ${message}`);
      }
    }

    this.logger.debug('Prediction queue is empty. Worker is idle.');
  }
}
