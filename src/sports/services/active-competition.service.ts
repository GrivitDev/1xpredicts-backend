import { Injectable, Logger } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import {
  ActiveCompetition,
  ActiveCompetitionDocument,
} from '../schemas/active-competition.schema';

import { ActiveCompetitionStatus } from '../interfaces/active-competition.interface';

import { SupportedCompetitionConfig } from '../interfaces/supported-competition-config.interface';

@Injectable()
export class ActiveCompetitionService {
  private readonly logger = new Logger(ActiveCompetitionService.name);

  constructor(
    @InjectModel(ActiveCompetition.name)
    private readonly activeCompetitionModel: Model<ActiveCompetitionDocument>,
  ) {}

  // ============================================================
  // CREATE / UPDATE
  // ============================================================

  async upsert(
    competition: SupportedCompetitionConfig,
    data: {
      apiFootballLeagueId?: number;
      season?: string;
      seasonStartDate?: Date;
      seasonEndDate?: Date;
      status: ActiveCompetitionStatus;
      lastFixtureDate?: Date;
      nextFixtureDate?: Date;
    },
  ): Promise<ActiveCompetitionDocument> {
    return this.activeCompetitionModel
      .findOneAndUpdate(
        {
          competitionId: competition.id,
        },
        {
          $set: {
            competitionId: competition.id,

            name: competition.name,

            type: competition.type,

            region: competition.region,

            priority: competition.priority,

            apiFootballLeagueId: data.apiFootballLeagueId,

            season: data.season,

            seasonStartDate: data.seasonStartDate,

            seasonEndDate: data.seasonEndDate,

            status: data.status,

            lastFixtureDate: data.lastFixtureDate,

            nextFixtureDate: data.nextFixtureDate,

            lastUpdatedAt: new Date(),
          },
        },
        {
          upsert: true,
          returnDocument: 'after',
          setDefaultsOnInsert: true,
        },
      )
      .exec();
  }

  // ============================================================
  // GET ALL
  // ============================================================

  async getAll(): Promise<ActiveCompetitionDocument[]> {
    return this.activeCompetitionModel
      .find()
      .sort({
        priority: 1,
        name: 1,
      })
      .lean()
      .exec();
  }

  // ============================================================
  // ACTIVE
  // ============================================================

  async getActive(): Promise<ActiveCompetitionDocument[]> {
    return this.activeCompetitionModel
      .find({
        status: ActiveCompetitionStatus.ACTIVE,
      })
      .sort({
        priority: 1,
        nextFixtureDate: 1,
        name: 1,
      })
      .lean()
      .exec();
  }

  // ============================================================
  // UPCOMING
  // ============================================================

  async getUpcoming(): Promise<ActiveCompetitionDocument[]> {
    return this.activeCompetitionModel
      .find({
        status: ActiveCompetitionStatus.UPCOMING,
      })
      .sort({
        seasonStartDate: 1,
        name: 1,
      })
      .lean()
      .exec();
  }

  // ============================================================
  // ACTIVE OR UPCOMING
  // ============================================================

  async getActiveOrUpcoming(): Promise<ActiveCompetitionDocument[]> {
    return this.activeCompetitionModel
      .find({
        status: {
          $in: [
            ActiveCompetitionStatus.ACTIVE,
            ActiveCompetitionStatus.UPCOMING,
          ],
        },
      })
      .sort({
        priority: 1,
        nextFixtureDate: 1,
        name: 1,
      })
      .lean()
      .exec();
  }

  // ============================================================
  // FINISHED
  // ============================================================

  async getFinished(): Promise<ActiveCompetitionDocument[]> {
    return this.activeCompetitionModel
      .find({
        status: ActiveCompetitionStatus.FINISHED,
      })
      .sort({
        seasonEndDate: -1,
        name: 1,
      })
      .lean()
      .exec();
  }

  // ============================================================
  // BY ID
  // ============================================================

  async getByCompetitionId(
    competitionId: string,
  ): Promise<ActiveCompetitionDocument | null> {
    return this.activeCompetitionModel
      .findOne({
        competitionId: competitionId.trim().toLowerCase(),
      })
      .lean()
      .exec();
  }

  // ============================================================
  // STATUS CALCULATION
  // ============================================================

  calculateStatus(
    seasonStartDate?: Date,
    seasonEndDate?: Date,
    lastFixtureDate?: Date,
    nextFixtureDate?: Date,
    now = new Date(),
  ): ActiveCompetitionStatus {
    if (seasonStartDate && now < seasonStartDate) {
      return ActiveCompetitionStatus.UPCOMING;
    }

    if (seasonEndDate && now > seasonEndDate && !nextFixtureDate) {
      return ActiveCompetitionStatus.FINISHED;
    }

    if (nextFixtureDate || lastFixtureDate) {
      return ActiveCompetitionStatus.ACTIVE;
    }

    if (
      seasonStartDate &&
      seasonEndDate &&
      now >= seasonStartDate &&
      now <= seasonEndDate
    ) {
      return ActiveCompetitionStatus.ACTIVE;
    }

    return ActiveCompetitionStatus.INACTIVE;
  }

  // ============================================================
  // REFRESH STATUSES
  // ============================================================

  async refreshStatuses(): Promise<void> {
    const competitions = await this.activeCompetitionModel.find().exec();

    const now = new Date();

    for (const competition of competitions) {
      const status = this.calculateStatus(
        competition.seasonStartDate,
        competition.seasonEndDate,
        competition.lastFixtureDate,
        competition.nextFixtureDate,
        now,
      );

      if (competition.status !== status) {
        competition.status = status;

        competition.lastUpdatedAt = now;

        await competition.save();
      }
    }

    this.logger.log(`Refreshed ${competitions.length} competition statuses`);
  }

  // ============================================================
  // UPDATE FIXTURE ACTIVITY
  // ============================================================

  async updateFixtureActivity(
    competitionId: string,
    data: {
      lastFixtureDate?: Date;
      nextFixtureDate?: Date;
    },
  ): Promise<void> {
    const competition = await this.activeCompetitionModel
      .findOne({
        competitionId: competitionId.trim().toLowerCase(),
      })
      .exec();

    if (!competition) {
      return;
    }

    const now = new Date();

    competition.lastFixtureDate =
      data.lastFixtureDate ?? competition.lastFixtureDate;

    competition.nextFixtureDate =
      data.nextFixtureDate ?? competition.nextFixtureDate;

    competition.status = this.calculateStatus(
      competition.seasonStartDate,
      competition.seasonEndDate,
      competition.lastFixtureDate,
      competition.nextFixtureDate,
      now,
    );

    competition.lastUpdatedAt = now;

    await competition.save();
  }

  // ============================================================
  // MARK INACTIVE
  // ============================================================

  async markInactive(competitionId: string): Promise<void> {
    await this.activeCompetitionModel
      .updateOne(
        {
          competitionId: competitionId.trim().toLowerCase(),
        },
        {
          $set: {
            status: ActiveCompetitionStatus.INACTIVE,
            lastUpdatedAt: new Date(),
          },
        },
      )
      .exec();
  }

  // ============================================================
  // MARK FINISHED
  // ============================================================

  async markFinished(competitionId: string): Promise<void> {
    await this.activeCompetitionModel
      .updateOne(
        {
          competitionId: competitionId.trim().toLowerCase(),
        },
        {
          $set: {
            status: ActiveCompetitionStatus.FINISHED,
            lastUpdatedAt: new Date(),
          },
        },
      )
      .exec();
  }

  // ============================================================
  // CLEAR REGISTRY
  // ============================================================

  async removeMissingCompetitions(
    supportedCompetitionIds: string[],
  ): Promise<number> {
    const result = await this.activeCompetitionModel
      .deleteMany({
        competitionId: {
          $nin: supportedCompetitionIds.map((id) => id.trim().toLowerCase()),
        },
      })
      .exec();

    return result.deletedCount ?? 0;
  }
}
