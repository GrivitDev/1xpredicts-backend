import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

export type TheSportsDbEventDocument = HydratedDocument<TheSportsDbEvent>;

@Schema({
  timestamps: true,
  collection: 'sports_thesportsdb_events',
})
export class TheSportsDbEvent {
  @Prop({
    required: true,
    unique: true,
    index: true,
  })
  eventId!: number;

  @Prop({
    required: true,
    index: true,
  })
  leagueId!: number;

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
    type: Date,
    required: true,
    index: true,
  })
  eventDate!: Date;

  @Prop({
    required: true,
    index: true,
  })
  status!: string;

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

export const TheSportsDbEventSchema =
  SchemaFactory.createForClass(TheSportsDbEvent);

TheSportsDbEventSchema.index({
  leagueId: 1,
  eventDate: 1,
});

TheSportsDbEventSchema.index({
  homeTeamId: 1,
  eventDate: -1,
});

TheSportsDbEventSchema.index({
  awayTeamId: 1,
  eventDate: -1,
});
