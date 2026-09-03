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
    index: true,
  })
  apiFootballLeagueId?: number;

  @Prop({
    index: true,
  })
  season?: number;

  @Prop({
    index: true,
  })
  apiFootballTeamId?: number;

  @Prop({
    index: true,
  })
  apiFootballFixtureId?: number;

  @Prop({
    required: true,
    enum: Object.values(ApiFootballQueueJobType),
    index: true,
  })
  type!: ApiFootballQueueJobType;

  @Prop({
    required: true,
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
    type: Date,
    index: true,
  })
  scheduledFor!: Date;

  @Prop({
    type: Date,
    index: true,
  })
  processedAt?: Date;

  @Prop()
  error?: string;
}

export const ApiFootballQueueSchema =
  SchemaFactory.createForClass(ApiFootballQueue);

ApiFootballQueueSchema.index({
  status: 1,
  priority: 1,
  scheduledFor: 1,
});

ApiFootballQueueSchema.index({
  type: 1,
  competitionId: 1,
  apiFootballLeagueId: 1,
  season: 1,
  apiFootballTeamId: 1,
  apiFootballFixtureId: 1,
  status: 1,
});
