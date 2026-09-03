import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

export type TheSportsDbLineupDocument = HydratedDocument<TheSportsDbLineup>;

@Schema({
  timestamps: true,
  collection: 'sports_thesportsdb_lineups',
})
export class TheSportsDbLineup {
  @Prop({
    required: true,
    index: true,
  })
  eventId!: number;

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

export const TheSportsDbLineupSchema =
  SchemaFactory.createForClass(TheSportsDbLineup);

TheSportsDbLineupSchema.index({
  eventId: 1,
  teamId: 1,
});
