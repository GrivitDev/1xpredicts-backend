import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import { CompetitionPriority } from '../../sports/enums/competition-priority.enum';
import { PredictionQueueStatus } from '../enums/prediction-queue-status.enum';

export type PredictionQueueDocument = HydratedDocument<PredictionQueue>;

@Schema({
  collection: 'predictions_queue',
  timestamps: true,
})
export class PredictionQueue {
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
    index: true,
    trim: true,
    lowercase: true,
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
    type: String,
    required: true,
    trim: true,
  })
  homeTeamId!: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  awayTeamId!: string;

  @Prop({
    type: String,
    enum: Object.values(CompetitionPriority),
    default: CompetitionPriority.SELECTIVE,
    index: true,
  })
  priority!: CompetitionPriority;

  @Prop({
    type: Number,
    required: true,
    default: 4,
    index: true,
  })
  priorityWeight!: number;

  @Prop({
    type: String,
    enum: Object.values(PredictionQueueStatus),
    default: PredictionQueueStatus.PENDING,
    index: true,
  })
  status!: PredictionQueueStatus;

  @Prop({
    type: Number,
    required: true,
    default: 0,
  })
  attempts!: number;

  @Prop({
    type: Number,
    required: true,
    default: 3,
  })
  maxAttempts!: number;

  @Prop({
    type: Date,
    required: true,
    default: Date.now,
    index: true,
  })
  availableAt!: Date;

  @Prop({
    type: Date,
    default: null,
    index: true,
  })
  lockedUntil!: Date | null;

  @Prop({
    type: Date,
    default: null,
  })
  startedAt!: Date | null;

  @Prop({
    type: Date,
    default: null,
  })
  completedAt!: Date | null;

  @Prop({
    type: Date,
    default: null,
  })
  failedAt!: Date | null;

  @Prop({
    type: Date,
    default: null,
  })
  lastAttemptAt!: Date | null;

  @Prop({
    type: String,
    default: null,
    trim: true,
  })
  lastErrorCode!: string | null;

  @Prop({
    type: String,
    default: null,
    trim: true,
  })
  lastErrorMessage!: string | null;
}

export const PredictionQueueSchema =
  SchemaFactory.createForClass(PredictionQueue);

PredictionQueueSchema.index({
  status: 1,
  priorityWeight: 1,
  fixtureDate: 1,
});

PredictionQueueSchema.index({
  status: 1,
  availableAt: 1,
});

PredictionQueueSchema.index({
  status: 1,
  lockedUntil: 1,
});
