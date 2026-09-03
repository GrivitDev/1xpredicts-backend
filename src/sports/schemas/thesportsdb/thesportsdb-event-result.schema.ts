import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

export type TheSportsDbEventResultDocument =
  HydratedDocument<TheSportsDbEventResult>;

@Schema({
  timestamps: true,
  collection: 'sports_thesportsdb_event_results',
})
export class TheSportsDbEventResult {
  @Prop({
    required: true,
    index: true,
  })
  eventId!: number;

  @Prop({
    required: true,
  })
  resultId!: string;

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

export const TheSportsDbEventResultSchema = SchemaFactory.createForClass(
  TheSportsDbEventResult,
);

TheSportsDbEventResultSchema.index({
  eventId: 1,
  resultId: 1,
});
