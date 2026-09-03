import { Injectable, Logger } from '@nestjs/common';

import { Cron } from '@nestjs/schedule';

@Injectable()
export class AiSchedulerService {
  private readonly logger = new Logger(AiSchedulerService.name);

  private running = false;

  // ============================================================
  // EVERY 10 MINUTES
  //
  // TEMPORARILY DISABLED
  // ============================================================

  @Cron('*/10 * * * *', {
    timeZone: 'Africa/Lagos',
  })
  processPredictions(): void {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      this.logger.debug(
        'AI prediction scheduler is disabled during the sports-data migration.',
      );
    } finally {
      this.running = false;
    }
  }
}
