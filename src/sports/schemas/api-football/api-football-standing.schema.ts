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
  })
  rank!: number;

  /**
   * Complete latest API-Football standing row.
   */
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

/**
 * One current standing record per:
 *
 * competition + season + team
 */
ApiFootballStandingSchema.index(
  {
    leagueId: 1,
    season: 1,
    teamId: 1,
  },
  {
    unique: true,
  },
);

ApiFootballStandingSchema.index({
  leagueId: 1,
  season: 1,
  rank: 1,
});

ApiFootballStandingSchema.index({
  teamId: 1,
  collectedAt: -1,
});
