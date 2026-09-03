import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

export type TheSportsDbVenueDocument = HydratedDocument<TheSportsDbVenue>;

@Schema({
  timestamps: true,
  collection: 'sports_thesportsdb_venues',
})
export class TheSportsDbVenue {
  @Prop({
    required: true,
    unique: true,
    index: true,
  })
  venueId!: number;

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

export const TheSportsDbVenueSchema =
  SchemaFactory.createForClass(TheSportsDbVenue);
