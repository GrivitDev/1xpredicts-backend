// src/predictions-engine/services/settlement-trigger.service.ts

import { Injectable, Logger } from '@nestjs/common';

import { SettlementService } from './settlement.service';

@Injectable()
export class SettlementTriggerService {
  private readonly logger = new Logger(SettlementTriggerService.name);

  constructor(private readonly settlementService: SettlementService) {}

  async onFixtureCompleted(eventId: string) {
    const normalizedEventId = String(eventId).trim();

    if (!normalizedEventId) {
      throw new Error('Settlement trigger requires an event ID.');
    }

    try {
      const result =
        await this.settlementService.settleEvent(normalizedEventId);

      this.logger.log(
        `Automatic settlement completed for ${normalizedEventId}: ` +
          `settled=${result.settled} won=${result.won} ` +
          `lost=${result.lost} void=${result.void} ` +
          `pending=${result.pending}`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Automatic settlement failed for ${normalizedEventId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );

      throw error;
    }
  }
}
