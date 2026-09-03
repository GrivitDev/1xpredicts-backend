import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

export type ApiFootballStandingDocument = HydratedDocument<ApiFootballStanding>;

@Schema({
  timestamps: true,
  collection: 'sports_api_football_standings',
})
export class ApiFootballStanding {
  @Prop({
    required: true,
    index: true,
  })
  leagueId!: number;

  @Prop({
    required: true,
    index: true,
  })
  season!: number;

  @Prop({
    required: true,
    index: true,
  })
  teamId!: number;

  @Prop({
    required: true,
    index: true,
  })
  rank!: number;

  @Prop({
    type: Object,
    required: true,
  })
  payload!: Record<string, unknown>;

  @Prop({
    required: true,
    type: Date,
    index: true,
  })
  collectedAt!: Date;
}

export const ApiFootballStandingSchema =
  SchemaFactory.createForClass(ApiFootballStanding);

ApiFootballStandingSchema.index({
  leagueId: 1,
  season: 1,
  rank: 1,
});
