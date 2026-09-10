// src/predictions-engine/schemas/prediction.schema.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

import { PredictionMarket } from '../enums/prediction-market.enum';

import { PredictionRisk } from '../enums/prediction-risk.enum';

import { PredictionSource } from '../enums/prediction-source.enum';

import { PredictionStatus } from '../enums/prediction-status.enum';

export type PredictionDocument = HydratedDocument<Prediction>;

@Schema({
  _id: false,
})
export class PredictionReason {
  @Prop({
    required: true,
    trim: true,
  })
  code!: string;

  @Prop({
    required: true,
    trim: true,
  })
  message!: string;
}

export const PredictionReasonSchema =
  SchemaFactory.createForClass(PredictionReason);

@Schema({
  _id: false,
})
export class PredictionRecommendation {
  @Prop({
    required: true,
    enum: Object.values(PredictionRisk),
  })
  risk!: PredictionRisk;

  @Prop({
    required: true,
    trim: true,
  })
  selection!: string;

  @Prop({
    required: true,
    trim: true,
  })
  label!: string;

  @Prop({
    required: true,
    min: 0,
    max: 100,
  })
  probability!: number;

  @Prop({
    required: true,
    min: 0,
    max: 100,
  })
  confidence!: number;

  @Prop({
    required: true,
    min: 0,
  })
  odds!: number;

  @Prop({
    required: true,
    min: 0,
    max: 100,
  })
  sourceAgreement!: number;

  @Prop({
    required: true,
    min: 0,
    max: 100,
  })
  dataQuality!: number;

  @Prop({
    type: [PredictionReasonSchema],
    default: [],
  })
  reasons!: PredictionReason[];
}

export const PredictionRecommendationSchema = SchemaFactory.createForClass(
  PredictionRecommendation,
);

@Schema({
  _id: false,
})
export class PredictionMarketSelection {
  @Prop({
    required: true,
    trim: true,
  })
  selection!: string;

  @Prop({
    required: true,
    trim: true,
  })
  label!: string;

  @Prop({
    required: true,
    min: 0,
    max: 100,
  })
  probability!: number;

  @Prop({
    required: true,
    min: 0,
    max: 100,
  })
  confidence!: number;

  @Prop({
    required: true,
    min: 0,
  })
  odds!: number;
}

export const PredictionMarketSelectionSchema = SchemaFactory.createForClass(
  PredictionMarketSelection,
);

@Schema({
  _id: false,
})
export class PredictionMarketResult {
  @Prop({
    required: true,
    enum: Object.values(PredictionMarket),
  })
  market!: PredictionMarket;

  @Prop({
    required: true,
    enum: Object.values(PredictionStatus),
  })
  status!: PredictionStatus;

  @Prop({
    type: [PredictionMarketSelectionSchema],
    default: [],
  })
  selections!: PredictionMarketSelection[];

  @Prop({
    type: PredictionRecommendationSchema,
    default: undefined,
  })
  low?: PredictionRecommendation;

  @Prop({
    type: PredictionRecommendationSchema,
    default: undefined,
  })
  medium?: PredictionRecommendation;

  @Prop({
    type: PredictionRecommendationSchema,
    default: undefined,
  })
  high?: PredictionRecommendation;
}

export const PredictionMarketResultSchema = SchemaFactory.createForClass(
  PredictionMarketResult,
);

@Schema({
  _id: false,
})
export class PredictionSourceSnapshot {
  @Prop({
    required: true,
    enum: Object.values(PredictionSource),
  })
  source!: PredictionSource;

  @Prop({
    required: true,
    enum: Object.values(PredictionStatus),
  })
  status!: PredictionStatus;

  @Prop({
    required: true,
  })
  available!: boolean;

  @Prop({
    trim: true,
  })
  modelName?: string;

  @Prop({
    trim: true,
  })
  modelVersion?: string;

  @Prop({
    type: Date,
  })
  startedAt?: Date;

  @Prop({
    type: Date,
  })
  completedAt?: Date;

  @Prop({
    type: Number,
    min: 0,
  })
  durationMs?: number;

  @Prop({
    min: 0,
    max: 100,
  })
  dataQuality?: number;

  @Prop({
    type: MongooseSchema.Types.Mixed,
    default: undefined,
  })
  matchProbability?: {
    home: number;
    draw: number;
    away: number;
  };

  @Prop({
    type: MongooseSchema.Types.Mixed,
    default: [],
  })
  recommendations!: unknown[];

  @Prop({
    trim: true,
  })
  errorCode?: string;

  @Prop({
    trim: true,
  })
  errorMessage?: string;
}

export const PredictionSourceSnapshotSchema = SchemaFactory.createForClass(
  PredictionSourceSnapshot,
);

@Schema({
  _id: false,
})
export class PredictionMatchProbability {
  @Prop({
    required: true,
    min: 0,
    max: 100,
  })
  home!: number;

  @Prop({
    required: true,
    min: 0,
    max: 100,
  })
  draw!: number;

  @Prop({
    required: true,
    min: 0,
    max: 100,
  })
  away!: number;

  @Prop({
    required: true,
    min: 0,
    max: 100,
  })
  confidence!: number;
}

export const PredictionMatchProbabilitySchema = SchemaFactory.createForClass(
  PredictionMatchProbability,
);

@Schema({
  _id: false,
})
export class PredictionMetadata {
  @Prop({
    required: true,
    trim: true,
  })
  engineVersion!: string;

  @Prop({
    required: true,
    trim: true,
  })
  calibrationVersion!: string;

  @Prop({
    required: true,
    type: Date,
  })
  generatedAt!: Date;

  @Prop({
    required: true,
    min: 0,
  })
  completedSources!: number;

  @Prop({
    required: true,
    min: 0,
  })
  availableSources!: number;

  @Prop({
    required: true,
    min: 0,
    max: 100,
  })
  sourceAgreement!: number;

  @Prop({
    required: true,
    min: 0,
    max: 100,
  })
  dataQuality!: number;
}

export const PredictionMetadataSchema =
  SchemaFactory.createForClass(PredictionMetadata);

@Schema({
  timestamps: true,
  collection: 'predictions_engine_predictions',
})
export class Prediction {
  @Prop({
    required: true,
    unique: true,
    index: true,
  })
  fixtureId!: number;

  @Prop({
    required: true,
    index: true,
    trim: true,
    lowercase: true,
  })
  competitionId!: string;

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
    required: true,
    type: Date,
  })
  kickoff!: Date;

  @Prop({
    required: true,
  })
  homeTeamId!: number;

  @Prop({
    required: true,
    trim: true,
  })
  homeTeamName!: string;

  @Prop({
    required: true,
  })
  awayTeamId!: number;

  @Prop({
    required: true,
    trim: true,
  })
  awayTeamName!: string;

  @Prop({
    required: true,
    enum: Object.values(PredictionStatus),
    index: true,
  })
  status!: PredictionStatus;

  @Prop({
    required: true,
    type: PredictionMatchProbabilitySchema,
  })
  matchProbability!: PredictionMatchProbability;

  @Prop({
    type: [PredictionMarketResultSchema],
    default: [],
  })
  markets!: PredictionMarketResult[];

  @Prop({
    type: [PredictionSourceSnapshotSchema],
    default: [],
  })
  sourceSnapshots!: PredictionSourceSnapshot[];

  @Prop({
    required: true,
    type: PredictionMetadataSchema,
  })
  metadata!: PredictionMetadata;

  @Prop({
    required: true,
    type: Object,
  })
  fixtureSnapshot!: Record<string, unknown>;
}

export const PredictionSchema = SchemaFactory.createForClass(Prediction);

PredictionSchema.index({
  kickoff: 1,
  status: 1,
});

PredictionSchema.index({
  competitionId: 1,
  kickoff: 1,
});

PredictionSchema.index({
  homeTeamId: 1,
  awayTeamId: 1,
  kickoff: 1,
});
