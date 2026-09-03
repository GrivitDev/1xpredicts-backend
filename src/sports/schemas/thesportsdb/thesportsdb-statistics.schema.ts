import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

export type TheSportsDbStatisticsDocument =
  HydratedDocument<TheSportsDbStatistics>;

@Schema({
  timestamps: true,
  collection: 'sports_thesportsdb_statistics',
})
export class TheSportsDbStatistics {
  @Prop({
    required: true,
    unique: true,
    index: true,
  })
  eventId!: number;

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

export const TheSportsDbStatisticsSchema = SchemaFactory.createForClass(
  TheSportsDbStatistics,
);
