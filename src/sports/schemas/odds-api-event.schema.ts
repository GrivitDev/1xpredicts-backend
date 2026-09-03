import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

export type OddsApiEventDocument = HydratedDocument<OddsApiEvent>;

@Schema({
  timestamps: true,
  collection: 'sports_odds_api_events',
})
export class OddsApiEvent {
  @Prop({
    required: true,
    unique: true,
    index: true,
  })
  eventId!: string;

  @Prop({
    required: true,
    index: true,
  })
  sportKey!: string;

  @Prop({
    required: true,
    index: true,
  })
  homeTeam!: string;

  @Prop({
    required: true,
    index: true,
  })
  awayTeam!: string;

  @Prop({
    required: true,
    type: Date,
    index: true,
  })
  commenceTime!: Date;

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

export const OddsApiEventSchema = SchemaFactory.createForClass(OddsApiEvent);

OddsApiEventSchema.index({
  sportKey: 1,
  commenceTime: 1,
});

OddsApiEventSchema.index({
  homeTeam: 1,
  awayTeam: 1,
  commenceTime: 1,
});
