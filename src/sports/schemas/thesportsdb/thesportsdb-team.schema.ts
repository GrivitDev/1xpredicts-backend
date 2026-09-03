import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

export type TheSportsDbTeamDocument = HydratedDocument<TheSportsDbTeam>;

@Schema({
  timestamps: true,
  collection: 'sports_thesportsdb_teams',
})
export class TheSportsDbTeam {
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
  leagueId!: number;

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

export const TheSportsDbTeamSchema =
  SchemaFactory.createForClass(TheSportsDbTeam);

TheSportsDbTeamSchema.index({
  leagueId: 1,
  name: 1,
});
