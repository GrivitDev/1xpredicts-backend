import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

import { YoutubeHighlightStatus } from '../interfaces/youtube-highlight.interface';

export type YoutubeHighlightDocument = HydratedDocument<YoutubeHighlight>;

@Schema({
  timestamps: true,
  collection: 'sports_youtube_highlights',
})
export class YoutubeHighlight {
  @Prop({
    required: true,
    unique: true,
    index: true,
  })
  fixtureId!: string;

  @Prop({
    index: true,
  })
  competitionId?: string;

  @Prop({
    required: true,
  })
  homeTeam!: string;

  @Prop({
    required: true,
  })
  awayTeam!: string;

  @Prop({
    required: true,
    enum: Object.values(YoutubeHighlightStatus),
    default: YoutubeHighlightStatus.PENDING,
    index: true,
  })
  status!: YoutubeHighlightStatus;

  @Prop({
    required: true,
    default: 0,
    min: 0,
  })
  retryCount!: number;

  @Prop({
    type: Date,
    index: true,
  })
  searchedAt?: Date;

  @Prop({
    type: Date,
    index: true,
  })
  nextRetryAt?: Date;

  @Prop({
    index: true,
  })
  videoId?: string;

  @Prop()
  videoUrl?: string;

  @Prop()
  title?: string;

  @Prop()
  channelId?: string;

  @Prop()
  channelTitle?: string;

  @Prop({
    type: Date,
  })
  publishedAt?: Date;

  @Prop()
  thumbnailUrl?: string;

  @Prop()
  error?: string;
}

export const YoutubeHighlightSchema =
  SchemaFactory.createForClass(YoutubeHighlight);

YoutubeHighlightSchema.index({
  status: 1,
  nextRetryAt: 1,
  createdAt: 1,
});

YoutubeHighlightSchema.index({
  competitionId: 1,
  status: 1,
});

YoutubeHighlightSchema.index({
  fixtureId: 1,
});
