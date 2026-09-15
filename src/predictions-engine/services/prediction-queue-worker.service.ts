import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { PREDICTION_ENGINE_CONFIG } from '../config/prediction-engine.config';

import { PredictionQueueService } from './prediction-queue.service';
import { PredictionWorkerService } from './prediction-worker.service';

@Injectable()
export class PredictionQueueWorkerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PredictionQueueWorkerService.name);

  private running = false;

  private timer?: NodeJS.Timeout;

  constructor(
    private readonly predictionQueueService: PredictionQueueService,
    private readonly predictionWorkerService: PredictionWorkerService,
  ) {}

  onModuleInit(): void {
    this.logger.log(
      `Prediction queue watcher initialized: interval=${PREDICTION_ENGINE_CONFIG.queue.workerPollIntervalMs}ms`,
    );

    this.scheduleNextCheck(0);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  private scheduleNextCheck(delay: number): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      void this.check();
    }, delay);
  }

  private async check(): Promise<void> {
    if (this.running) {
      this.scheduleNextCheck(
        PREDICTION_ENGINE_CONFIG.queue.workerPollIntervalMs,
      );

      return;
    }

    this.running = true;

    try {
      const result = await this.predictionQueueService.trigger();

      if (result.total > 0) {
        await this.predictionWorkerService.start();
      }
    } catch (error) {
      this.logger.error(
        `Prediction queue watcher failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.running = false;

      this.scheduleNextCheck(
        PREDICTION_ENGINE_CONFIG.queue.workerPollIntervalMs,
      );
    }
  }
}
