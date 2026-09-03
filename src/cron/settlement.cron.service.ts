import { Injectable, Logger } from '@nestjs/common';

import { Cron } from '@nestjs/schedule';

@Injectable()
export class SettlementCronService {
  private readonly logger = new Logger(SettlementCronService.name);

  // ============================================================
  // AUTOMATIC SETTLEMENT
  //
  // TEMPORARILY DISABLED
  //
  // Settlement will be rebuilt later using the new sports
  // data architecture.
  // ============================================================

  @Cron('0 * * * *', {
    timeZone: 'Africa/Lagos',
  })
  handleAutomaticSettlement(): void {
    this.logger.debug(
      'Automatic prediction settlement is disabled during the sports-data migration.',
    );
  }
}
