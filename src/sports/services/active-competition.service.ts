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

      footballDataCode?: string;

      oddsApiSportKey?: string;

      season?: number;

      seasonStartDate?: Date;

      seasonEndDate?: Date;

      status: ActiveCompetitionStatus;

      lastFixtureDate?: Date;

      nextFixtureDate?: Date;

      apiFootballPayload?: Record<string, unknown>;
    },
  ): Promise<ActiveCompetitionDocument> {
    const competitionId = competition.id.trim().toLowerCase();

    const update: Record<string, unknown> = {
      competitionId,

      name: competition.name,

      type: competition.type,

      region: competition.region,

      priority: competition.priority,

      status: data.status,

      lastUpdatedAt: new Date(),
    };

    if (data.apiFootballLeagueId !== undefined) {
      update.apiFootballLeagueId = data.apiFootballLeagueId;
    }

    if (data.footballDataCode !== undefined) {
      update.footballDataCode = data.footballDataCode.trim().toUpperCase();
    } else if (competition.providers.footballDataCode) {
      update.footballDataCode = competition.providers.footballDataCode
        .trim()
        .toUpperCase();
    }

    if (data.oddsApiSportKey !== undefined) {
      update.oddsApiSportKey = data.oddsApiSportKey.trim();
    } else if (competition.providers.oddsApiSportKey) {
      update.oddsApiSportKey = competition.providers.oddsApiSportKey.trim();
    }

    if (data.season !== undefined) {
      update.season = data.season;
    }

    if (data.seasonStartDate !== undefined) {
      update.seasonStartDate = data.seasonStartDate;
    }

    if (data.seasonEndDate !== undefined) {
      update.seasonEndDate = data.seasonEndDate;
    }

    if (data.lastFixtureDate !== undefined) {
      update.lastFixtureDate = data.lastFixtureDate;
    }

    if (data.nextFixtureDate !== undefined) {
      update.nextFixtureDate = data.nextFixtureDate;
    }

    if (data.apiFootballPayload !== undefined) {
      update.apiFootballPayload = data.apiFootballPayload;
    }

    return this.activeCompetitionModel
      .findOneAndUpdate(
        {
          competitionId,
        },
        {
          $set: update,
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
  // STATUS
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

    if (nextFixtureDate && nextFixtureDate >= now) {
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

    if (lastFixtureDate && lastFixtureDate <= now) {
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

    if (data.lastFixtureDate !== undefined) {
      competition.lastFixtureDate = data.lastFixtureDate;
    }

    if (data.nextFixtureDate !== undefined) {
      competition.nextFixtureDate = data.nextFixtureDate;
    }

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
  // REMOVE MISSING COMPETITIONS
  // ============================================================

  async removeMissingCompetitions(
    supportedCompetitionIds: string[],
  ): Promise<number> {
    const ids = supportedCompetitionIds.map((id) => id.trim().toLowerCase());

    const result = await this.activeCompetitionModel
      .deleteMany({
        competitionId: {
          $nin: ids,
        },
      })
      .exec();

    return result.deletedCount ?? 0;
  }
}
