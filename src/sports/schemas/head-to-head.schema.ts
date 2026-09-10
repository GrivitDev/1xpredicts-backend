import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

export type HeadToHeadDocument = HydratedDocument<HeadToHead>;

@Schema({
  _id: false,
})
export class HeadToHeadMeeting {
  @Prop({
    required: true,
    trim: true,
  })
  fixtureId!: string;

  @Prop({
    required: true,
    trim: true,
    lowercase: true,
  })
  competitionId!: string;

  @Prop({
    required: true,
  })
  season!: number;

  @Prop({
    required: true,
  })
  date!: Date;

  @Prop({
    required: true,
    trim: true,
  })
  homeTeamId!: string;

  @Prop({
    required: true,
  })
  homeTeamName!: string;

  @Prop({
    required: true,
    trim: true,
  })
  awayTeamId!: string;

  @Prop({
    required: true,
  })
  awayTeamName!: string;

  @Prop({
    required: true,
  })
  homeGoals!: number;

  @Prop({
    required: true,
  })
  awayGoals!: number;
}

export const HeadToHeadMeetingSchema =
  SchemaFactory.createForClass(HeadToHeadMeeting);

@Schema({
  timestamps: true,
  collection: 'sports_head_to_head',
})
export class HeadToHead {
  @Prop({
    required: true,
    unique: true,
    index: true,
  })
  pairKey!: string;

  @Prop({
    required: true,
    index: true,
    trim: true,
  })
  teamAId!: string;

  @Prop({
    required: true,
  })
  teamAName!: string;

  @Prop({
    required: true,
    index: true,
    trim: true,
  })
  teamBId!: string;

  @Prop({
    required: true,
  })
  teamBName!: string;

  @Prop({
    required: true,
    default: 0,
  })
  totalMeetings!: number;

  @Prop({
    required: true,
    default: 0,
  })
  teamAWins!: number;

  @Prop({
    required: true,
    default: 0,
  })
  draws!: number;

  @Prop({
    required: true,
    default: 0,
  })
  teamBWins!: number;

  @Prop({
    required: true,
    default: 0,
  })
  teamAGoals!: number;

  @Prop({
    required: true,
    default: 0,
  })
  teamBGoals!: number;

  @Prop({
    type: [HeadToHeadMeetingSchema],
    default: [],
  })
  meetings!: HeadToHeadMeeting[];

  @Prop({
    type: Date,
    default: null,
  })
  lastMeetingAt?: Date | null;

  @Prop()
  calculatedAt?: Date;
}

export const HeadToHeadSchema = SchemaFactory.createForClass(HeadToHead);

HeadToHeadSchema.index({
  teamAId: 1,
  teamBId: 1,
});

HeadToHeadSchema.index({
  lastMeetingAt: -1,
});
