import { Injectable, Logger } from '@nestjs/common';

import { Cron } from '@nestjs/schedule';

@Injectable()
export class AiContentSchedulerService {
  private readonly logger = new Logger(AiContentSchedulerService.name);

  private running = false;

  // ============================================================
  // EVERY 15 MINUTES
  //
  // TEMPORARILY DISABLED
  // ============================================================

  @Cron('*/15 6-10 * * *', {
    timeZone: 'Africa/Lagos',
  })
  generateMorningContent(): void {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      this.logger.debug(
        'AI content scheduler is disabled during the sports-data migration.',
      );
    } finally {
      this.running = false;
    }
  }
}
