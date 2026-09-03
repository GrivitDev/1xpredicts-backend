import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

export type ApiFootballFixtureDocument = HydratedDocument<ApiFootballFixture>;

@Schema({
  timestamps: true,
  collection: 'sports_api_football_fixtures',
})
export class ApiFootballFixture {
  @Prop({
    required: true,
    unique: true,
    index: true,
  })
  fixtureId!: number;

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
    type: Date,
    index: true,
  })
  fixtureDate!: Date;

  @Prop({
    required: true,
    index: true,
  })
  statusShort!: string;

  @Prop({
    required: true,
    index: true,
  })
  homeTeamId!: number;

  @Prop({
    required: true,
    index: true,
  })
  awayTeamId!: number;

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

export const ApiFootballFixtureSchema =
  SchemaFactory.createForClass(ApiFootballFixture);

ApiFootballFixtureSchema.index({
  leagueId: 1,
  season: 1,
  fixtureDate: 1,
});

ApiFootballFixtureSchema.index({
  homeTeamId: 1,
  awayTeamId: 1,
  fixtureDate: -1,
});
