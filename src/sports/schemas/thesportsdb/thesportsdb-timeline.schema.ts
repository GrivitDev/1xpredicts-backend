import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

export type TheSportsDbTimelineDocument = HydratedDocument<TheSportsDbTimeline>;

@Schema({
  timestamps: true,
  collection: 'sports_thesportsdb_timelines',
})
export class TheSportsDbTimeline {
  @Prop({
    required: true,
    index: true,
  })
  eventId!: number;

  @Prop({
    required: true,
  })
  timelineId!: string;

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

export const TheSportsDbTimelineSchema =
  SchemaFactory.createForClass(TheSportsDbTimeline);

TheSportsDbTimelineSchema.index({
  eventId: 1,
  timelineId: 1,
});
