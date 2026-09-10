import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

export type EspnLiveMatchDocument = HydratedDocument<EspnLiveMatch>;

@Schema({
  timestamps: true,
  collection: 'sports_espn_live_matches',
})
export class EspnLiveMatch {
  /**
   * ESPN event ID.
   */
  @Prop({
    required: true,
    unique: true,
    index: true,
    trim: true,
  })
  eventId!: string;

  /**
   * ESPN league slug.
   */
  @Prop({
    required: true,
    index: true,
    trim: true,
    lowercase: true,
  })
  leagueId!: string;

  @Prop({
    required: true,
    index: true,
  })
  season!: number;

  @Prop({
    required: true,
    type: Date,
    index: true,
  })
  matchDate!: Date;

  @Prop({
    required: true,
    index: true,
  })
  status!: string;

  @Prop({
    required: false,
  })
  statusDetail?: string;

  @Prop({
    required: false,
  })
  statusShortDetail?: string;

  @Prop({
    required: false,
  })
  period?: number;

  @Prop({
    required: false,
  })
  displayClock?: string;

  @Prop({
    required: false,
    trim: true,
  })
  homeTeamId?: string;

  @Prop({
    required: false,
  })
  homeTeamName?: string;

  @Prop({
    required: false,
  })
  homeTeamLogo?: string;

  @Prop({
    required: false,
  })
  homeScore?: number;

  @Prop({
    required: false,
    trim: true,
  })
  awayTeamId?: string;

  @Prop({
    required: false,
  })
  awayTeamName?: string;

  @Prop({
    required: false,
  })
  awayTeamLogo?: string;

  @Prop({
    required: false,
  })
  awayScore?: number;

  @Prop({
    required: false,
  })
  venueName?: string;

  /**
   * Complete latest ESPN live event object.
   */
  @Prop({
    type: Object,
    required: true,
  })
  payload!: Record<string, unknown>;

  /**
   * Last time this live match was collected from ESPN.
   */
  @Prop({
    required: true,
    type: Date,
    index: true,
  })
  collectedAt!: Date;
}

export const EspnLiveMatchSchema = SchemaFactory.createForClass(EspnLiveMatch);

EspnLiveMatchSchema.index({
  leagueId: 1,
  matchDate: 1,
});

EspnLiveMatchSchema.index({
  status: 1,
  matchDate: 1,
});

EspnLiveMatchSchema.index({
  collectedAt: -1,
});
