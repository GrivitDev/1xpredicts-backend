import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

import {
  ApiFootballQueueJobType,
  ApiFootballQueueStatus,
} from '../interfaces/api-football-queue.interface';

export type ApiFootballQueueDocument = HydratedDocument<ApiFootballQueue>;

@Schema({
  timestamps: true,
  collection: 'sports_api_football_queue',
})
export class ApiFootballQueue {
  @Prop({
    required: true,
    index: true,
  })
  competitionId!: string;

  @Prop({
    required: true,
    index: true,
  })
  apiFootballLeagueId!: number;

  @Prop({
    required: true,
    index: true,
  })
  season!: number;

  @Prop({
    required: true,
    index: true,
  })
  collectionDate!: string;

  @Prop({
    required: true,
    enum: Object.values(ApiFootballQueueJobType),
    index: true,
  })
  type!: ApiFootballQueueJobType;

  @Prop({
    required: true,
    type: Number,
    default: 100,
    index: true,
  })
  priority!: number;

  @Prop({
    required: true,
    enum: Object.values(ApiFootballQueueStatus),
    default: ApiFootballQueueStatus.PENDING,
    index: true,
  })
  status!: ApiFootballQueueStatus;

  @Prop({
    required: true,
    default: 0,
  })
  attempts!: number;

  @Prop({
    required: true,
    default: 3,
  })
  maxAttempts!: number;

  @Prop({
    type: Date,
    index: true,
  })
  scheduledFor?: Date;

  @Prop({
    type: Date,
    index: true,
  })
  nextAttemptAt?: Date;

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
  })
  failedAt?: Date;

  @Prop({
    type: String,
  })
  lastError?: string;
}

export const ApiFootballQueueSchema =
  SchemaFactory.createForClass(ApiFootballQueue);

ApiFootballQueueSchema.index(
  {
    competitionId: 1,
    apiFootballLeagueId: 1,
    season: 1,
    collectionDate: 1,
    type: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      status: {
        $in: [
          ApiFootballQueueStatus.PENDING,
          ApiFootballQueueStatus.PROCESSING,
        ],
      },
    },
  },
);

ApiFootballQueueSchema.index({
  collectionDate: 1,
  status: 1,
  priority: 1,
  scheduledFor: 1,
});

ApiFootballQueueSchema.index({
  status: 1,
  nextAttemptAt: 1,
});
