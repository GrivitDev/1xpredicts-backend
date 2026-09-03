import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

export type ApiFootballPredictionDocument =
  HydratedDocument<ApiFootballPrediction>;

@Schema({
  timestamps: true,
  collection: 'sports_api_football_predictions',
})
export class ApiFootballPrediction {
  @Prop({
    required: true,
    unique: true,
    index: true,
  })
  fixtureId!: number;

  @Prop({
    required: true,
    index: true,
  })
  leagueId!: number;

  @Prop({
    required: true,
    index: true,
  })
  season!: number;

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

export const ApiFootballPredictionSchema = SchemaFactory.createForClass(
  ApiFootballPrediction,
);
