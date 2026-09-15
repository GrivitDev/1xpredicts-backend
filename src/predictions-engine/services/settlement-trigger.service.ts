import { Injectable, Logger } from '@nestjs/common';

import { SettlementService } from './settlement.service';

@Injectable()
export class SettlementTriggerService {
  private readonly logger = new Logger(SettlementTriggerService.name);

  constructor(private readonly settlementService: SettlementService) {}

  async onFixtureCompleted(eventId: string) {
    try {
      const result = await this.settlementService.settleEvent(eventId);

      this.logger.log(`Automatic settlement completed for ${eventId}.`);

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Automatic settlement failed for ${eventId}: ${message}`,
      );

      throw error;
    }
  }
}
