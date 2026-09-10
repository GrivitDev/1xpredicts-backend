import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { PredictionSchedulerService } from '../services/prediction-scheduler.service';

@Injectable()
export class PredictionProcessingCron {
  private readonly logger = new Logger(PredictionProcessingCron.name);

  constructor(
    private readonly predictionSchedulerService: PredictionSchedulerService,
  ) {}

  /**
   * Processes queued predictions every 5 minutes from 06:00 through 23:55.
   *
   * No new prediction processing is started between 00:00 and 05:59.
   */
  @Cron('0 */5 6-23 * * *')
  async processPredictions(): Promise<void> {
    try {
      const processed = await this.predictionSchedulerService.processQueue(10);

      if (processed > 0) {
        this.logger.log(
          `Prediction processing cycle completed: ${processed} fixture(s) processed.`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown prediction processing error';

      this.logger.error(`Prediction processing cycle failed: ${message}`);
    }
  }
}
