import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

import { CompetitionPriority } from '../enums/competition-priority.enum';

import { ActiveCompetitionStatus } from '../interfaces/active-competition.interface';

import { CompetitionRegion } from '../enums/competition-region.enum';

import { CompetitionType } from '../enums/competition-type.enum';

export type ActiveCompetitionDocument = HydratedDocument<ActiveCompetition>;

@Schema({
  timestamps: true,
  collection: 'sports_active_competitions',
})
export class ActiveCompetition {
  @Prop({
    required: true,
    unique: true,
    index: true,
    trim: true,
    lowercase: true,
  })
  competitionId!: string;

  @Prop({
    required: true,
    trim: true,
  })
  name!: string;

  @Prop({
    required: true,
    type: String,
    enum: Object.values(CompetitionType),
    index: true,
  })
  type!: CompetitionType;

  @Prop({
    required: true,
    type: String,
    enum: Object.values(CompetitionRegion),
    index: true,
  })
  region!: CompetitionRegion;

  @Prop({
    required: true,
    type: String,
    enum: Object.values(CompetitionPriority),
    index: true,
  })
  priority!: CompetitionPriority;

  @Prop({
    type: Number,
    index: true,
  })
  apiFootballLeagueId?: number;

  @Prop({
    type: String,
    trim: true,
    uppercase: true,
    index: true,
  })
  footballDataCode?: string;

  @Prop({
    type: String,
    trim: true,
    index: true,
  })
  oddsApiSportKey?: string;

  @Prop({
    type: Number,
    index: true,
  })
  season?: number;

  @Prop({
    type: Date,
    index: true,
  })
  seasonStartDate?: Date;

  @Prop({
    type: Date,
    index: true,
  })
  seasonEndDate?: Date;

  @Prop({
    type: Date,
    index: true,
  })
  lastFixtureDate?: Date;

  @Prop({
    type: Date,
    index: true,
  })
  nextFixtureDate?: Date;

  @Prop({
    required: true,
    type: String,
    enum: Object.values(ActiveCompetitionStatus),
    default: ActiveCompetitionStatus.INACTIVE,
    index: true,
  })
  status!: ActiveCompetitionStatus;

  /**
   * Complete latest API-Football league discovery record.
   */
  @Prop({
    type: Object,
  })
  apiFootballPayload?: Record<string, unknown>;

  @Prop({
    required: true,
    type: Date,
    index: true,
  })
  lastUpdatedAt!: Date;
}

export const ActiveCompetitionSchema =
  SchemaFactory.createForClass(ActiveCompetition);

ActiveCompetitionSchema.index({
  status: 1,
  priority: 1,
  nextFixtureDate: 1,
});

ActiveCompetitionSchema.index({
  apiFootballLeagueId: 1,
  season: 1,
});
