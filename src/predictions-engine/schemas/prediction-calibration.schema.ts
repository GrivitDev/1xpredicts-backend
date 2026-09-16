// src/predictions-engine/schemas/prediction-calibration.schema.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PredictionCalibrationDocument =
  HydratedDocument<PredictionCalibration>;

@Schema({
  collection: 'predictions_calibration',
  timestamps: true,
})
export class PredictionCalibration {
  @Prop({
    type: String,
    required: true,
    index: true,
    trim: true,
  })
  market!: string;

  @Prop({
    type: String,
    default: null,
    index: true,
    trim: true,
  })
  selection!: string | null;

  @Prop({
    type: String,
    required: true,
    index: true,
    trim: true,
  })
  modelVersion!: string;

  @Prop({
    type: Number,
    required: true,
    default: 0,
    min: 0,
  })
  sampleSize!: number;

  @Prop({
    type: Number,
    required: true,
    default: 0,
    min: 0,
  })
  wins!: number;

  @Prop({
    type: Number,
    required: true,
    default: 0,
    min: 0,
  })
  losses!: number;

  @Prop({
    type: Number,
    required: true,
    default: 0,
    min: 0,
    max: 1,
  })
  averageProbability!: number;

  @Prop({
    type: Number,
    required: true,
    default: 0,
    min: 0,
    max: 1,
  })
  actualSuccessRate!: number;

  @Prop({
    type: Number,
    required: true,
    default: 0,
    min: 0,
    max: 1,
  })
  calibrationError!: number;

  @Prop({
    type: Number,
    required: true,
    default: 0,
    min: -0.1,
    max: 0.1,
  })
  adjustment!: number;

  @Prop({
    type: Number,
    required: true,
    default: 0,
    min: 0,
    max: 1,
  })
  reliabilityScore!: number;

  @Prop({
    type: Number,
    required: true,
    default: 0,
    min: 0,
    max: 98,
  })
  averageConfidence!: number;

  @Prop({
    type: Boolean,
    required: true,
    default: false,
  })
  shouldAdjust!: boolean;

  @Prop({
    type: Date,
    required: true,
    default: Date.now,
    index: true,
  })
  calculatedAt!: Date;
}

export const PredictionCalibrationSchema = SchemaFactory.createForClass(
  PredictionCalibration,
);

PredictionCalibrationSchema.index(
  {
    market: 1,
    selection: 1,
    modelVersion: 1,
  },
  {
    unique: true,
  },
);

PredictionCalibrationSchema.index({
  market: 1,
  modelVersion: 1,
});
