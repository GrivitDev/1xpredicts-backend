import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

export type ApiFootballInjuryDocument = HydratedDocument<ApiFootballInjury>;

@Schema({
  timestamps: true,
  collection: 'sports_api_football_injuries',
})
export class ApiFootballInjury {
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
  playerId!: number;

  @Prop({
    required: true,
    index: true,
  })
  teamId!: number;

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

export const ApiFootballInjurySchema =
  SchemaFactory.createForClass(ApiFootballInjury);

ApiFootballInjurySchema.index({
  leagueId: 1,
  season: 1,
  teamId: 1,
});
