import { Injectable, Logger } from '@nestjs/common';

import { PredictionQueueService } from './prediction-queue.service';
import { PredictionGenerationService } from './prediction-generation.service';

@Injectable()
export class PredictionProcessingService {
  private readonly logger = new Logger(PredictionProcessingService.name);

  constructor(
    private readonly predictionQueueService: PredictionQueueService,
    private readonly predictionGenerationService: PredictionGenerationService,
  ) {}

  async process(limit = 10): Promise<number> {
    const jobs = await this.predictionQueueService.claimNext(limit);

    if (!jobs.length) {
      return 0;
    }

    let processed = 0;

    for (const job of jobs) {
      try {
        await this.predictionGenerationService.generate(String(job.fixtureId));

        await this.predictionQueueService.markCompleted(job.id);

        processed += 1;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Prediction processing failed';

        this.logger.error(
          `Prediction failed for fixture ${job.fixtureId}: ${message}`,
        );

        await this.predictionQueueService.markFailed(job.id, message);
      }
    }

    return processed;
  }
}
