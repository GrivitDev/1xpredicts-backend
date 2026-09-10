import { Injectable, Logger } from '@nestjs/common';

import { PredictionQueueService } from './prediction-queue.service';
import { PredictionProcessingService } from './prediction-processing.service';

@Injectable()
export class PredictionSchedulerService {
  private readonly logger = new Logger(PredictionSchedulerService.name);

  constructor(
    private readonly predictionQueueService: PredictionQueueService,
    private readonly predictionProcessingService: PredictionProcessingService,
  ) {}

  async buildQueue(
    fixtures: Array<{
      fixtureId: string;
      kickoffAt: Date;
    }>,
  ): Promise<number> {
    let queued = 0;

    for (const fixture of fixtures) {
      const result = await this.predictionQueueService.enqueue(
        Number(fixture.fixtureId),
        fixture.kickoffAt,
      );

      if (result) {
        queued += 1;
      }
    }

    return queued;
  }

  async processQueue(limit = 10): Promise<number> {
    return this.predictionProcessingService.process(limit);
  }

  async recoverInterruptedJobs(): Promise<void> {
    await this.predictionQueueService.resetProcessingJobs();
  }
}
