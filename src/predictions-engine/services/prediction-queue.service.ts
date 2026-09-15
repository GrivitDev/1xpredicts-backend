import { Injectable, Logger } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import {
  EspnFixture,
  EspnFixtureDocument,
} from '../../sports/schemas/espn/espn-fixture.schema';

import {
  ActiveCompetition,
  ActiveCompetitionDocument,
} from '../../sports/schemas/active-competition.schema';

import { CompetitionPriority } from '../../sports/enums/competition-priority.enum';

import {
  PredictionQueue,
  PredictionQueueDocument,
} from '../schemas/prediction-queue.schema';

import { PredictionQueueStatus } from '../enums/prediction-queue-status.enum';

import { PREDICTION_ENGINE_CONFIG } from '../config/prediction-engine.config';

@Injectable()
export class PredictionQueueService {
  private readonly logger = new Logger(PredictionQueueService.name);

  constructor(
    @InjectModel(PredictionQueue.name)
    private readonly queueModel: Model<PredictionQueueDocument>,

    @InjectModel(EspnFixture.name)
    private readonly fixtureModel: Model<EspnFixtureDocument>,

    @InjectModel(ActiveCompetition.name)
    private readonly activeCompetitionModel: Model<ActiveCompetitionDocument>,
  ) {}

  async trigger(): Promise<{
    queued: number;
    alreadyQueued: number;
    skipped: number;
    total: number;
  }> {
    const now = new Date();

    const horizon = new Date(now);

    horizon.setDate(
      horizon.getDate() + PREDICTION_ENGINE_CONFIG.queue.horizonDays,
    );

    const fixtures = await this.fixtureModel
      .find({
        fixtureDate: {
          $gte: now,
          $lte: horizon,
        },

        completed: {
          $ne: true,
        },
      })
      .select({
        eventId: 1,
        leagueId: 1,
        season: 1,
        fixtureDate: 1,
        homeTeamId: 1,
        awayTeamId: 1,
      })
      .sort({
        fixtureDate: 1,
      })
      .lean()
      .exec();

    let queued = 0;
    let alreadyQueued = 0;
    let skipped = 0;

    for (const fixture of fixtures) {
      if (!this.isValidFixture(fixture)) {
        skipped++;
        continue;
      }

      const existing = await this.queueModel
        .findOne({
          eventId: fixture.eventId,
        })
        .lean()
        .exec();

      if (
        existing?.status === PredictionQueueStatus.PENDING ||
        existing?.status === PredictionQueueStatus.PROCESSING ||
        existing?.status === PredictionQueueStatus.COMPLETED
      ) {
        alreadyQueued++;
        continue;
      }

      const competitionId = String(fixture.leagueId).trim().toLowerCase();

      const season = Number(fixture.season);

      const competition = await this.activeCompetitionModel
        .findOne({
          competitionId,
          season,
        })
        .select({
          priority: 1,
        })
        .lean()
        .exec();

      /*
       * Only competitions known to the Sports competition
       * registry enter the prediction queue.
       */
      if (!competition) {
        skipped++;
        continue;
      }

      const priority = competition.priority ?? CompetitionPriority.SELECTIVE;

      const priorityWeight = this.getPriorityWeight(priority);

      await this.queueModel
        .updateOne(
          {
            eventId: fixture.eventId,
          },
          {
            $set: {
              eventId: fixture.eventId,

              competitionId,

              season,

              fixtureDate: fixture.fixtureDate,

              homeTeamId: String(fixture.homeTeamId).trim(),

              awayTeamId: String(fixture.awayTeamId).trim(),

              priority,
              priorityWeight,

              status: PredictionQueueStatus.PENDING,

              availableAt: now,

              lockedUntil: null,
              startedAt: null,
              completedAt: null,
              failedAt: null,
              lastAttemptAt: null,

              lastErrorCode: null,
              lastErrorMessage: null,
            },

            $setOnInsert: {
              attempts: 0,

              maxAttempts: PREDICTION_ENGINE_CONFIG.queue.maxAttempts,
            },
          },
          {
            upsert: true,
          },
        )
        .exec();

      queued++;
    }

    this.logger.log(
      `Prediction queue trigger completed: total=${fixtures.length} queued=${queued} alreadyQueued=${alreadyQueued} skipped=${skipped}`,
    );

    return {
      queued,
      alreadyQueued,
      skipped,
      total: fixtures.length,
    };
  }

  async claimNext(): Promise<PredictionQueueDocument | null> {
    const now = new Date();

    const horizon = new Date(now);

    horizon.setDate(
      horizon.getDate() + PREDICTION_ENGINE_CONFIG.queue.horizonDays,
    );

    const lockUntil = new Date(
      now.getTime() + PREDICTION_ENGINE_CONFIG.queue.workerLockMinutes * 60_000,
    );

    await this.queueModel
      .updateMany(
        {
          status: PredictionQueueStatus.PROCESSING,

          lockedUntil: {
            $lt: now,
          },
        },
        {
          $set: {
            status: PredictionQueueStatus.PENDING,

            availableAt: now,

            lockedUntil: null,
          },
        },
      )
      .exec();

    return this.queueModel
      .findOneAndUpdate(
        {
          status: PredictionQueueStatus.PENDING,

          availableAt: {
            $lte: now,
          },

          fixtureDate: {
            $gte: now,
            $lte: horizon,
          },
        },
        {
          $set: {
            status: PredictionQueueStatus.PROCESSING,

            startedAt: now,

            lastAttemptAt: now,

            lockedUntil: lockUntil,
          },

          $inc: {
            attempts: 1,
          },
        },
        {
          new: true,

          sort: {
            priorityWeight: 1,
            fixtureDate: 1,
          },
        },
      )
      .exec();
  }

  async complete(eventId: string): Promise<void> {
    await this.queueModel
      .updateOne(
        {
          eventId,
        },
        {
          $set: {
            status: PredictionQueueStatus.COMPLETED,

            completedAt: new Date(),

            lockedUntil: null,

            lastErrorCode: null,

            lastErrorMessage: null,
          },
        },
      )
      .exec();
  }

  async fail(eventId: string, errorMessage: string): Promise<void> {
    const queueItem = await this.queueModel
      .findOne({
        eventId,
      })
      .exec();

    if (!queueItem) {
      return;
    }

    const now = new Date();

    const exhausted = queueItem.attempts >= queueItem.maxAttempts;

    if (exhausted) {
      await this.queueModel
        .updateOne(
          {
            eventId,
          },
          {
            $set: {
              status: PredictionQueueStatus.FAILED,

              failedAt: now,

              lockedUntil: null,

              lastErrorCode: 'MAX_ATTEMPTS_EXCEEDED',

              lastErrorMessage: this.truncateError(errorMessage),
            },
          },
        )
        .exec();

      return;
    }

    const availableAt = new Date(
      now.getTime() + PREDICTION_ENGINE_CONFIG.queue.retryDelayMinutes * 60_000,
    );

    await this.queueModel
      .updateOne(
        {
          eventId,
        },
        {
          $set: {
            status: PredictionQueueStatus.PENDING,

            availableAt,

            lockedUntil: null,

            failedAt: now,

            lastErrorCode: 'PREDICTION_FAILED',

            lastErrorMessage: this.truncateError(errorMessage),
          },
        },
      )
      .exec();
  }

  private isValidFixture(fixture: unknown): fixture is Record<string, unknown> {
    if (typeof fixture !== 'object' || fixture === null) {
      return false;
    }

    const candidate = fixture as Record<string, unknown>;

    return Boolean(
      candidate.eventId &&
      candidate.leagueId &&
      Number.isFinite(Number(candidate.season)) &&
      candidate.fixtureDate &&
      candidate.homeTeamId &&
      candidate.awayTeamId,
    );
  }

  private getPriorityWeight(priority: CompetitionPriority): number {
    switch (priority) {
      case CompetitionPriority.ELITE:
        return 1;

      case CompetitionPriority.HIGH:
        return 2;

      case CompetitionPriority.REGIONAL:
        return 3;

      case CompetitionPriority.SELECTIVE:
      default:
        return 4;
    }
  }

  private truncateError(message: string): string {
    return String(message).slice(0, 2000);
  }
}
