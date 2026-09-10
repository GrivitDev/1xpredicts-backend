import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

import { PredictionMarket } from '../enums/prediction-market.enum';

import { PredictionRisk } from '../enums/prediction-risk.enum';

export type PredictionCalibrationDocument =
  HydratedDocument<PredictionCalibration>;

@Schema({
  timestamps: true,
  collection: 'predictions_engine_calibration',
})
export class PredictionCalibration {
  @Prop({
    required: true,
    index: true,
    enum: Object.values(PredictionMarket),
  })
  market!: PredictionMarket;

  @Prop({
    trim: true,
    index: true,
  })
  selection?: string;

  @Prop({
    required: true,
    min: 0,
    max: 100,
  })
  minimumProbability!: number;

  @Prop({
    required: true,
    min: 0,
    max: 100,
  })
  maximumProbability!: number;

  @Prop({
    required: true,
    min: 0,
    default: 0,
  })
  predictionCount!: number;

  @Prop({
    required: true,
    min: 0,
    default: 0,
  })
  settledCount!: number;

  @Prop({
    required: true,
    min: 0,
    default: 0,
  })
  correctCount!: number;

  @Prop({
    required: true,
    min: 0,
    default: 0,
  })
  incorrectCount!: number;

  @Prop({
    required: true,
    min: 0,
    max: 100,
    default: 0,
  })
  empiricalAccuracy!: number;

  @Prop({
    required: true,
    min: 0,
    default: 0,
  })
  brierScore!: number;

  @Prop({
    required: true,
    min: 0,
    max: 100,
    default: 0,
  })
  calibrationError!: number;

  @Prop({
    enum: Object.values(PredictionRisk),
  })
  risk?: PredictionRisk;

  @Prop({
    required: true,
    trim: true,
  })
  calibrationVersion!: string;

  @Prop({
    required: true,
    type: Date,
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
    minimumProbability: 1,
    maximumProbability: 1,
  },
  {
    unique: true,
  },
);
