import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type FootballDataTeamDocument = HydratedDocument<FootballDataTeam>;

@Schema({
  timestamps: true,
  collection: 'sports_football_data_teams',
})
export class FootballDataTeam {
  @Prop({
    required: true,
    unique: true,
    index: true,
  })
  teamId!: number;

  @Prop({
    required: true,
    index: true,
  })
  competitionId!: number;

  @Prop({
    required: true,
    index: true,
  })
  competitionCode!: string;

  @Prop({
    required: true,
  })
  name!: string;

  @Prop({
    type: Object,
    required: true,
  })
  payload!: Record<string, unknown>;

  @Prop({
    required: true,
    index: true,
  })
  collectedAt!: Date;
}

export const FootballDataTeamSchema =
  SchemaFactory.createForClass(FootballDataTeam);
