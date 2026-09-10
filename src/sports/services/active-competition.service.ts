import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { CompetitionPriority } from '../enums/competition-priority.enum';
import { CompetitionRegion } from '../enums/competition-region.enum';
import { CompetitionType } from '../enums/competition-type.enum';

import {
  ActiveCompetitionStatus,
  ActiveCompetition,
} from '../interfaces/active-competition.interface';

import {
  ActiveCompetitionDocument,
  ActiveCompetition as ActiveCompetitionSchema,
} from '../schemas/active-competition.schema';

@Injectable()
export class ActiveCompetitionService {
  private readonly logger = new Logger(ActiveCompetitionService.name);

  constructor(
    @InjectModel(ActiveCompetitionSchema.name)
    private readonly activeCompetitionModel: Model<ActiveCompetitionDocument>,
  ) {}

  async upsert(
    competition: Omit<ActiveCompetition, 'status' | 'lastUpdatedAt'>,
  ): Promise<ActiveCompetitionDocument> {
    const now = new Date();

    const status = this.calculateStatus(
      competition.seasonStartDate,
      competition.seasonEndDate,
      competition.lastFixtureDate,
      competition.nextFixtureDate,
      now,
    );

    const update: Partial<ActiveCompetition> = {
      ...competition,
      competitionId: competition.competitionId.trim().toLowerCase(),
      espnLeagueSlug: competition.espnLeagueSlug.trim().toLowerCase(),
      status,
      lastUpdatedAt: now,
    };

    return this.activeCompetitionModel
      .findOneAndUpdate(
        {
          competitionId: update.competitionId,
        },
        {
          $set: update,
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        },
      )
      .exec();
  }

  async syncLeague(params: {
    competitionId: string;
    espnLeagueSlug: string;
    name: string;
    type: CompetitionType;
    region: CompetitionRegion;
    priority: CompetitionPriority;
    footballDataCode?: string;
    oddsApiSportKey?: string;
    season?: number | null;
    seasonStartDate?: Date | null;
    seasonEndDate?: Date | null;
    lastFixtureDate?: Date | null;
    nextFixtureDate?: Date | null;
    espnPayload?: Record<string, unknown>;
  }): Promise<ActiveCompetitionDocument> {
    return this.upsert({
      competitionId: params.competitionId,
      espnLeagueSlug: params.espnLeagueSlug,
      name: params.name,
      type: params.type,
      region: params.region,
      priority: params.priority,
      footballDataCode: params.footballDataCode,
      oddsApiSportKey: params.oddsApiSportKey,
      season: params.season ?? undefined,
      seasonStartDate: params.seasonStartDate ?? undefined,
      seasonEndDate: params.seasonEndDate ?? undefined,
      lastFixtureDate: params.lastFixtureDate ?? undefined,
      nextFixtureDate: params.nextFixtureDate ?? undefined,
      espnPayload: params.espnPayload,
    });
  }

  async getAll(): Promise<ActiveCompetitionDocument[]> {
    return this.activeCompetitionModel
      .find({})
      .sort({
        priority: 1,
        name: 1,
      })
      .exec();
  }

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
      .exec();
  }

  async getUpcoming(): Promise<ActiveCompetitionDocument[]> {
    return this.activeCompetitionModel
      .find({
        status: ActiveCompetitionStatus.UPCOMING,
      })
      .sort({
        priority: 1,
        nextFixtureDate: 1,
        name: 1,
      })
      .exec();
  }

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
      .exec();
  }

  async getPriorityActive(): Promise<ActiveCompetitionDocument[]> {
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
      .exec();
  }

  async getFinished(): Promise<ActiveCompetitionDocument[]> {
    return this.activeCompetitionModel
      .find({
        status: ActiveCompetitionStatus.FINISHED,
      })
      .sort({
        priority: 1,
        name: 1,
      })
      .exec();
  }

  async getByCompetitionId(
    competitionId: string,
  ): Promise<ActiveCompetitionDocument | null> {
    return this.activeCompetitionModel
      .findOne({
        competitionId: competitionId.trim().toLowerCase(),
      })
      .exec();
  }

  async getByEspnLeagueSlug(
    espnLeagueSlug: string,
  ): Promise<ActiveCompetitionDocument | null> {
    return this.activeCompetitionModel
      .findOne({
        espnLeagueSlug: espnLeagueSlug.trim().toLowerCase(),
      })
      .exec();
  }

  async updateFixtureActivity(params: {
    competitionId: string;
    lastFixtureDate?: Date | null;
    nextFixtureDate?: Date | null;
    season?: number | null;
    seasonStartDate?: Date | null;
    seasonEndDate?: Date | null;
    espnPayload?: Record<string, unknown>;
  }): Promise<ActiveCompetitionDocument | null> {
    const competition = await this.getByCompetitionId(params.competitionId);

    if (!competition) {
      return null;
    }

    const now = new Date();

    if (params.season !== undefined) {
      competition.season = params.season ?? undefined;
    }

    if (params.seasonStartDate !== undefined) {
      competition.seasonStartDate = params.seasonStartDate ?? undefined;
    }

    if (params.seasonEndDate !== undefined) {
      competition.seasonEndDate = params.seasonEndDate ?? undefined;
    }

    if (params.lastFixtureDate !== undefined) {
      competition.lastFixtureDate = params.lastFixtureDate ?? undefined;
    }

    if (params.nextFixtureDate !== undefined) {
      competition.nextFixtureDate = params.nextFixtureDate ?? undefined;
    }

    if (params.espnPayload !== undefined) {
      competition.espnPayload = params.espnPayload;
    }

    competition.status = this.calculateStatus(
      competition.seasonStartDate,
      competition.seasonEndDate,
      competition.lastFixtureDate,
      competition.nextFixtureDate,
      now,
    );

    competition.lastUpdatedAt = now;

    return competition.save();
  }

  async refreshStatuses(): Promise<number> {
    const competitions = await this.activeCompetitionModel.find({}).exec();

    const now = new Date();
    let updated = 0;

    for (const competition of competitions) {
      const nextStatus = this.calculateStatus(
        competition.seasonStartDate,
        competition.seasonEndDate,
        competition.lastFixtureDate,
        competition.nextFixtureDate,
        now,
      );

      if (competition.status === nextStatus) {
        continue;
      }

      competition.status = nextStatus;
      competition.lastUpdatedAt = now;

      await competition.save();

      updated += 1;
    }

    return updated;
  }

  async removeMissingCompetitions(
    existingCompetitionIds: string[],
  ): Promise<number> {
    if (existingCompetitionIds.length === 0) {
      return 0;
    }

    const normalizedIds = existingCompetitionIds
      .map((id) => id.trim().toLowerCase())
      .filter(Boolean);

    if (normalizedIds.length === 0) {
      return 0;
    }

    const result = await this.activeCompetitionModel
      .deleteMany({
        competitionId: {
          $nin: normalizedIds,
        },
      })
      .exec();

    return result.deletedCount ?? 0;
  }

  calculateStatus(
    seasonStartDate?: Date,
    seasonEndDate?: Date,
    lastFixtureDate?: Date,
    nextFixtureDate?: Date,
    now = new Date(),
  ): ActiveCompetitionStatus {
    if (seasonStartDate && now < new Date(seasonStartDate)) {
      return ActiveCompetitionStatus.UPCOMING;
    }

    if (seasonEndDate && now > new Date(seasonEndDate) && !nextFixtureDate) {
      return ActiveCompetitionStatus.FINISHED;
    }

    if (nextFixtureDate && new Date(nextFixtureDate) >= now) {
      return ActiveCompetitionStatus.ACTIVE;
    }

    if (
      seasonStartDate &&
      seasonEndDate &&
      now >= new Date(seasonStartDate) &&
      now <= new Date(seasonEndDate)
    ) {
      return ActiveCompetitionStatus.ACTIVE;
    }

    if (lastFixtureDate) {
      const elapsed = now.getTime() - new Date(lastFixtureDate).getTime();

      if (elapsed <= 7 * 24 * 60 * 60 * 1000) {
        return ActiveCompetitionStatus.ACTIVE;
      }
    }

    return ActiveCompetitionStatus.INACTIVE;
  }
}
