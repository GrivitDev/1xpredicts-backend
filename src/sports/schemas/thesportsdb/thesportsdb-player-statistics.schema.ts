import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

export type TheSportsDbPlayerStatisticsDocument =
  HydratedDocument<TheSportsDbPlayerStatistics>;

@Schema({
  timestamps: true,
  collection: 'sports_thesportsdb_player_statistics',
})
export class TheSportsDbPlayerStatistics {
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
    index: true,
  })
  collectedAt!: Date;
}

export const TheSportsDbPlayerStatisticsSchema = SchemaFactory.createForClass(
  TheSportsDbPlayerStatistics,
);

TheSportsDbPlayerStatisticsSchema.index({
  playerId: 1,
  teamId: 1,
});
