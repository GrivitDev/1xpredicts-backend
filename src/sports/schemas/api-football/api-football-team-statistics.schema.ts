import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

export type ApiFootballTeamStatisticsDocument =
  HydratedDocument<ApiFootballTeamStatistics>;

@Schema({
  timestamps: true,
  collection: 'sports_api_football_team_statistics',
})
export class ApiFootballTeamStatistics {
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

export const ApiFootballTeamStatisticsSchema = SchemaFactory.createForClass(
  ApiFootballTeamStatistics,
);

ApiFootballTeamStatisticsSchema.index({
  leagueId: 1,
  season: 1,
  teamId: 1,
});
