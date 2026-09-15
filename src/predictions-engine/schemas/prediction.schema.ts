import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

import { PredictionMarket } from '../enums/prediction-market.enum';
import { PredictionRisk } from '../enums/prediction-risk.enum';
import { PredictionSource } from '../enums/prediction-source.enum';
import { PredictionStatus } from '../enums/prediction-status.enum';
import { SettlementStatus } from '../enums/settlement-status.enum';

export type PredictionEnginePredictionDocument =
  HydratedDocument<PredictionEnginePrediction>;

// ============================================================
// PREDICTION TEAM
// ============================================================

@Schema({
  _id: false,
})
export class PredictionTeam {
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

export const PredictionTeamSchema =
  SchemaFactory.createForClass(PredictionTeam);

// ============================================================
// PREDICTION SETTLEMENT
// ============================================================

@Schema({
  _id: false,
})
export class PredictionSettlement {
  @Prop({
    type: String,
    enum: Object.values(SettlementStatus),
    required: true,
    default: SettlementStatus.PENDING,
  })
  status!: SettlementStatus;

  @Prop({
    type: Boolean,
    default: null,
  })
  actualOutcome!: boolean | null;

  @Prop({
    type: MongooseSchema.Types.Mixed,
    default: null,
  })
  actualValue!: unknown;

  @Prop({
    type: String,
    default: null,
    trim: true,
  })
  resultLabel!: string | null;

  @Prop({
    type: Number,
    default: null,
  })
  finalHomeScore!: number | null;

  @Prop({
    type: Number,
    default: null,
  })
  finalAwayScore!: number | null;

  @Prop({
    type: Number,
    default: null,
  })
  halfTimeHomeScore!: number | null;

  @Prop({
    type: Number,
    default: null,
  })
  halfTimeAwayScore!: number | null;

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

  @Prop({
    type: Date,
    default: null,
  })
  settledAt!: Date | null;
}

export const PredictionSettlementSchema =
  SchemaFactory.createForClass(PredictionSettlement);

// ============================================================
// PREDICTION ENGINE PREDICTION
// ============================================================

@Schema({
  collection: 'prediction_engine_predictions',
  timestamps: true,
})
export class PredictionEnginePrediction {
  @Prop({
    type: String,
    required: true,
    trim: true,
    index: true,
  })
  eventId!: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
    lowercase: true,
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
    type: PredictionTeamSchema,
    required: true,
  })
  homeTeam!: PredictionTeam;

  @Prop({
    type: PredictionTeamSchema,
    required: true,
  })
  awayTeam!: PredictionTeam;

  @Prop({
    type: String,
    enum: Object.values(PredictionMarket),
    required: true,
    index: true,
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
    type: Number,
    required: true,
    min: 0,
    max: 100,
  })
  safetyScore!: number;

  @Prop({
    type: Number,
    required: true,
    min: 0,
    max: 1,
  })
  modelAgreement!: number;

  @Prop({
    type: Number,
    required: true,
    min: 0,
    max: 100,
  })
  dataQuality!: number;

  @Prop({
    type: Number,
    required: true,
    min: 0,
    max: 100,
  })
  calibrationReliability!: number;

  @Prop({
    type: String,
    enum: Object.values(PredictionRisk),
    required: true,
  })
  risk!: PredictionRisk;

  @Prop({
    type: Number,
    required: true,
    min: 0,
    max: 1,
  })
  decisionScore!: number;

  @Prop({
    type: String,
    enum: Object.values(PredictionSource),
    required: true,
  })
  source!: PredictionSource;

  @Prop({
    type: String,
    required: true,
    index: true,
  })
  modelVersion!: string;

  @Prop({
    type: String,
    enum: Object.values(PredictionStatus),
    required: true,
    default: PredictionStatus.ACTIVE,
    index: true,
  })
  status!: PredictionStatus;

  @Prop({
    type: Boolean,
    default: null,
  })
  actualOutcome!: boolean | null;

  @Prop({
    type: Date,
    default: null,
  })
  settledAt!: Date | null;

  @Prop({
    type: PredictionSettlementSchema,
    required: true,
    default: () => ({
      status: SettlementStatus.PENDING,
      actualOutcome: null,
      actualValue: null,
      resultLabel: null,
      finalHomeScore: null,
      finalAwayScore: null,
      halfTimeHomeScore: null,
      halfTimeAwayScore: null,
      source: 'ESPN_FIXTURE',
      settlementVersion: 'settlement-v2',
      settledAt: null,
    }),
  })
  settlement!: PredictionSettlement;

  @Prop({
    type: MongooseSchema.Types.Mixed,
    default: {},
  })
  metadata!: Record<string, unknown>;

  @Prop({
    type: Date,
    required: true,
    default: Date.now,
    index: true,
  })
  generatedAt!: Date;
}

export const PredictionEnginePredictionSchema = SchemaFactory.createForClass(
  PredictionEnginePrediction,
);

// ============================================================
// INDEXES
// ============================================================

PredictionEnginePredictionSchema.index(
  {
    eventId: 1,
    market: 1,
    selection: 1,
  },
  {
    unique: true,
  },
);

PredictionEnginePredictionSchema.index({
  eventId: 1,
  status: 1,
});

PredictionEnginePredictionSchema.index({
  market: 1,
  selection: 1,
  modelVersion: 1,
  status: 1,
});

PredictionEnginePredictionSchema.index({
  risk: 1,
  status: 1,
});

PredictionEnginePredictionSchema.index({
  confidence: -1,
  probability: -1,
});

PredictionEnginePredictionSchema.index({
  fixtureDate: 1,
  status: 1,
});
