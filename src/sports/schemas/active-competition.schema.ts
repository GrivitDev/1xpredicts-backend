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
  priority!: string;

  @Prop({
    type: String,
    index: true,
  })
  season?: string;

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
    required: true,
    enum: Object.values(ActiveCompetitionStatus),
    index: true,
  })
  status: ActiveCompetitionStatus = ActiveCompetitionStatus.UPCOMING;

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
    type: Date,
    index: true,
  })
  checkedAt!: Date;
}

export const ActiveCompetitionSchema =
  SchemaFactory.createForClass(ActiveCompetition);

ActiveCompetitionSchema.index({
  status: 1,
  priority: 1,
});

ActiveCompetitionSchema.index({
  status: 1,
  seasonStartDate: 1,
});

ActiveCompetitionSchema.index({
  status: 1,
  nextFixtureDate: 1,
});
