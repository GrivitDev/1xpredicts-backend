import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

import { PredictionMarket } from '../enums/prediction-market.enum';
import { SettlementStatus } from '../enums/settlement-status.enum';

export type PredictionRunDocument = HydratedDocument<PredictionRun>;

@Schema({
  _id: false,
})
export class PredictionRunTeam {
  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  id!: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  name!: string;
}

export const PredictionRunTeamSchema =
  SchemaFactory.createForClass(PredictionRunTeam);

@Schema({
  _id: false,
})
export class PredictionRunItem {
  @Prop({
    type: String,
    enum: Object.values(PredictionMarket),
    required: true,
  })
  market!: PredictionMarket;

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  selection!: string;

  @Prop({
    type: Number,
    required: true,
    min: 0,
    max: 1,
  })
  probability!: number;

  @Prop({
    type: Number,
    required: true,
    min: 0,
    max: 98,
  })
  confidence!: number;

  @Prop({
    type: String,
    required: true,
  })
  predictionId!: string;
}

export const PredictionRunItemSchema =
  SchemaFactory.createForClass(PredictionRunItem);

@Schema({
  _id: false,
})
export class PredictionRunSettlement {
  @Prop({
    type: String,
    enum: Object.values(SettlementStatus),
    required: true,
    default: SettlementStatus.PENDING,
  })
  status!: SettlementStatus;

  @Prop({
    type: Number,
    required: true,
    default: 0,
  })
  total!: number;

  @Prop({
    type: Number,
    required: true,
    default: 0,
  })
  settled!: number;

  @Prop({
    type: Number,
    required: true,
    default: 0,
  })
  won!: number;

  @Prop({
    type: Number,
    required: true,
    default: 0,
  })
  lost!: number;

  @Prop({
    type: Number,
    required: true,
    default: 0,
  })
  void!: number;

  @Prop({
    type: Date,
    default: null,
  })
  settledAt!: Date | null;

  @Prop({
    type: String,
    required: true,
    default: 'ESPN_FIXTURE',
  })
  source!: string;

  @Prop({
    type: String,
    required: true,
    default: 'settlement-v2',
  })
  settlementVersion!: string;
}

export const PredictionRunSettlementSchema = SchemaFactory.createForClass(
  PredictionRunSettlement,
);

@Schema({
  collection: 'prediction_runs',
  timestamps: true,
})
export class PredictionRun {
  @Prop({
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true,
  })
  eventId!: string;

  @Prop({
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true,
  })
  competitionId!: string;

  @Prop({
    type: Number,
    required: true,
    index: true,
  })
  season!: number;

  @Prop({
    type: Date,
    required: true,
    index: true,
  })
  fixtureDate!: Date;

  @Prop({
    type: PredictionRunTeamSchema,
    required: true,
  })
  homeTeam!: PredictionRunTeam;

  @Prop({
    type: PredictionRunTeamSchema,
    required: true,
  })
  awayTeam!: PredictionRunTeam;

  @Prop({
    type: String,
    required: true,
  })
  source!: string;

  @Prop({
    type: String,
    required: true,
    index: true,
  })
  modelVersion!: string;

  @Prop({
    type: [PredictionRunItemSchema],
    default: [],
  })
  predictions!: PredictionRunItem[];

  @Prop({
    type: PredictionRunSettlementSchema,
    required: true,
    default: () => ({
      status: SettlementStatus.PENDING,
      total: 0,
      settled: 0,
      won: 0,
      lost: 0,
      void: 0,
      settledAt: null,
      source: 'ESPN_FIXTURE',
      settlementVersion: 'settlement-v2',
    }),
  })
  settlement!: PredictionRunSettlement;

  @Prop({
    type: Date,
    required: true,
    default: Date.now,
    index: true,
  })
  generatedAt!: Date;
}

export const PredictionRunSchema = SchemaFactory.createForClass(PredictionRun);

PredictionRunSchema.index({
  fixtureDate: -1,
  generatedAt: -1,
});

PredictionRunSchema.index({
  'settlement.status': 1,
});
