import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

export type OddsApiSportDocument = HydratedDocument<OddsApiSport>;

@Schema({
  timestamps: true,
  collection: 'sports_odds_api_sports',
})
export class OddsApiSport {
  @Prop({
    required: true,
    unique: true,
    index: true,
  })
  sportKey!: string;

  @Prop({
    required: true,
  })
  title!: string;

  @Prop({
    required: true,
    index: true,
  })
  active!: boolean;

  @Prop({
    required: true,
  })
  hasOutrights!: boolean;

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

export const OddsApiSportSchema = SchemaFactory.createForClass(OddsApiSport);
