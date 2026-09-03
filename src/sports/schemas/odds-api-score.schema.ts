import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

export type OddsApiScoreDocument = HydratedDocument<OddsApiScore>;

@Schema({
  timestamps: true,
  collection: 'sports_odds_api_scores',
})
export class OddsApiScore {
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

export const OddsApiScoreSchema = SchemaFactory.createForClass(OddsApiScore);

OddsApiScoreSchema.index({
  sportKey: 1,
  commenceTime: 1,
});
