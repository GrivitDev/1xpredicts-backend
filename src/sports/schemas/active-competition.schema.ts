import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

import { ActiveCompetitionStatus } from '../interfaces/active-competition.interface';

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
  })
  competitionId!: string;

  @Prop({
    required: true,
    trim: true,
  })
  name!: string;

  @Prop({
    required: true,
    index: true,
  })
  type!: string;

  @Prop({
    required: true,
    index: true,
  })
  region!: string;

  @Prop({
    required: true,
    type: Number,
    index: true,
  })
  priority!: number;

  @Prop({
    type: Number,
    index: true,
  })
  apiFootballLeagueId?: number;

  @Prop({
    type: Number,
    index: true,
  })
  sportsDbLeagueId?: number;

  @Prop({
    type: String,
    index: true,
  })
  season?: string;

  @Prop({
    type: Date,
  })
  seasonStartDate?: Date;

  @Prop({
    type: Date,
  })
  seasonEndDate?: Date;

  @Prop({
    type: Date,
  })
  lastFixtureDate?: Date;

  @Prop({
    type: Date,
  })
  nextFixtureDate?: Date;

  @Prop({
    type: String,
    enum: Object.values(ActiveCompetitionStatus),
    default: ActiveCompetitionStatus.INACTIVE,
    index: true,
  })
  status!: ActiveCompetitionStatus;

  @Prop({
    type: Date,
  })
  lastUpdatedAt?: Date;
}

export const ActiveCompetitionSchema =
  SchemaFactory.createForClass(ActiveCompetition);
