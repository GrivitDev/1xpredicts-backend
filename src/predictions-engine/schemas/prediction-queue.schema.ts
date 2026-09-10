import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

import { PredictionQueueStatus } from '../enums/prediction-queue-status.enum';

export type PredictionQueueDocument = HydratedDocument<PredictionQueue>;

@Schema({
  timestamps: true,
  collection: 'predictions_engine_queue',
})
export class PredictionQueue {
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
  })
  season!: number;

  @Prop({
    required: true,
    type: Date,
    index: true,
  })
  kickoff!: Date;

  @Prop({
    required: true,
    trim: true,
  })
  homeTeamName!: string;

  @Prop({
    required: true,
    trim: true,
  })
  awayTeamName!: string;

  @Prop({
    required: true,
    enum: Object.values(PredictionQueueStatus),
    index: true,
  })
  status!: PredictionQueueStatus;

  @Prop({
    required: true,
    min: 0,
    default: 0,
  })
  priority!: number;

  @Prop({
    required: true,
    min: 0,
    default: 0,
  })
  attempts!: number;

  @Prop({
    required: true,
    min: 0,
    default: 3,
  })
  maxAttempts!: number;

  @Prop({
    type: Date,
    index: true,
  })
  lockedUntil?: Date;

  @Prop({
    type: Date,
  })
  startedAt?: Date;

  @Prop({
    type: Date,
  })
  completedAt?: Date;

  @Prop({
    type: Date,
    index: true,
  })
  lastAttemptAt?: Date;

  @Prop({
    trim: true,
  })
  lastErrorCode?: string;

  @Prop({
    trim: true,
  })
  lastErrorMessage?: string;
}

export const PredictionQueueSchema =
  SchemaFactory.createForClass(PredictionQueue);

PredictionQueueSchema.index({
  status: 1,
  priority: -1,
  kickoff: 1,
});

PredictionQueueSchema.index({
  status: 1,
  lockedUntil: 1,
});
