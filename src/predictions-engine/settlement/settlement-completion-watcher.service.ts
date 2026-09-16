// src/predictions-engine/settlement/settlement-completion-watcher.service.ts

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  EspnFixture,
  EspnFixtureDocument,
} from '../../sports/schemas/espn/espn-fixture.schema';

import {
  PredictionEnginePrediction,
  PredictionEnginePredictionDocument,
} from '../schemas/prediction.schema';

import { PredictionStatus } from '../enums/prediction-status.enum';

import { SettlementTriggerService } from './settlement-trigger.service';

@Injectable()
export class SettlementCompletionWatcherService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(SettlementCompletionWatcherService.name);

  private readonly POLL_INTERVAL_MS = 5000;

  private polling = false;
  private timer?: NodeJS.Timeout;
  private destroyed = false;

  constructor(
    @InjectModel(EspnFixture.name)
    private readonly espnFixtureModel: Model<EspnFixtureDocument>,

    @InjectModel(PredictionEnginePrediction.name)
    private readonly predictionModel: Model<PredictionEnginePredictionDocument>,

    private readonly settlementTriggerService: SettlementTriggerService,
  ) {}

  onModuleInit(): void {
    this.logger.log('Settlement completion watcher initialized');

    this.scheduleNextPoll(0);
  }

  onModuleDestroy(): void {
    this.destroyed = true;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  private scheduleNextPoll(delay = this.POLL_INTERVAL_MS): void {
    if (this.destroyed) {
      return;
    }

    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      void this.poll();
    }, delay);
  }

  private async poll(): Promise<void> {
    if (this.destroyed) {
      return;
    }

    if (this.polling) {
      this.scheduleNextPoll();
      return;
    }

    this.polling = true;

    try {
      await this.settleCompletedFixtures();
    } catch (error) {
      this.logger.error(
        `Settlement completion polling failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      this.polling = false;
      this.scheduleNextPoll();
    }
  }

  private async settleCompletedFixtures(): Promise<void> {
    /*
     * Only fixtures that:
     *
     * 1. are already canonical ESPN completed fixtures
     * 2. still have ACTIVE/PENDING predictions
     *
     * are considered.
     *
     * This keeps settlement entirely inside the predictions
     * module and does not create a SportsModule dependency.
     */

    const activeStatuses = [PredictionStatus.ACTIVE, PredictionStatus.PENDING];

    const pendingEventIds = await this.predictionModel
      .distinct('eventId', {
        status: {
          $in: activeStatuses,
        },
      })
      .exec();

    if (pendingEventIds.length === 0) {
      return;
    }

    const completedFixtures = await this.espnFixtureModel
      .find({
        eventId: {
          $in: pendingEventIds,
        },
        completed: true,
      })
      .select({
        eventId: 1,
        completed: 1,
        fixtureDate: 1,
      })
      .sort({
        fixtureDate: 1,
      })
      .lean()
      .exec();

    if (completedFixtures.length === 0) {
      return;
    }

    for (const fixture of completedFixtures) {
      const eventId = String(fixture.eventId ?? '').trim();

      if (!eventId) {
        continue;
      }

      try {
        await this.settlementTriggerService.onFixtureCompleted(eventId);
      } catch (error) {
        this.logger.error(
          `Settlement trigger failed for completed fixture ${eventId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }
}
