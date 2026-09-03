import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

export type TheSportsDbPlayerDocument = HydratedDocument<TheSportsDbPlayer>;

@Schema({
  timestamps: true,
  collection: 'sports_thesportsdb_players',
})
export class TheSportsDbPlayer {
  @Prop({
    required: true,
    unique: true,
    index: true,
  })
  playerId!: number;

  @Prop({
    required: true,
    index: true,
  })
  teamId!: number;

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

export const TheSportsDbPlayerSchema =
  SchemaFactory.createForClass(TheSportsDbPlayer);

TheSportsDbPlayerSchema.index({
  teamId: 1,
  name: 1,
});
