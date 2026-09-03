import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

export type TheSportsDbSeasonDocument = HydratedDocument<TheSportsDbSeason>;

@Schema({
  timestamps: true,
  collection: 'sports_thesportsdb_seasons',
})
export class TheSportsDbSeason {
  @Prop({
    required: true,
    index: true,
  })
  leagueId!: number;

  @Prop({
    required: true,
    index: true,
  })
  season!: string;

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

export const TheSportsDbSeasonSchema =
  SchemaFactory.createForClass(TheSportsDbSeason);

TheSportsDbSeasonSchema.index({
  leagueId: 1,
  season: 1,
});
