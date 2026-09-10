import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

export type EspnMatchEventDocument = HydratedDocument<EspnMatchEvent>;

@Schema({
  timestamps: true,
  collection: 'sports_espn_match_events',
})
export class EspnMatchEvent {
  @Prop({
    required: true,
    index: true,
    trim: true,
  })
  eventId!: string;

  @Prop({
    required: true,
    index: true,
    trim: true,
    lowercase: true,
  })
  leagueId!: string;

  /**
   * ESPN event competition ID.
   *
   * This is kept separately from leagueId because ESPN
   * events can contain competition-level objects.
   */
  @Prop({
    required: true,
    index: true,
    trim: true,
  })
  competitionId!: string;

  /**
   * ESPN play/event ID.
   */
  @Prop({
    required: true,
    index: true,
    trim: true,
  })
  playId!: string;

  @Prop({
    required: false,
  })
  clock?: number;

  @Prop({
    required: false,
  })
  clockDisplay?: string;

  @Prop({
    required: false,
    index: true,
  })
  type?: string;

  @Prop({
    required: false,
  })
  text?: string;

  @Prop({
    required: false,
    index: true,
    trim: true,
  })
  teamId?: string;

  @Prop({
    required: false,
  })
  homeScore?: number;

  @Prop({
    required: false,
  })
  awayScore?: number;

  @Prop({
    required: false,
  })
  scoringPlay?: boolean;

  @Prop({
    required: false,
  })
  redCard?: boolean;

  @Prop({
    required: false,
  })
  yellowCard?: boolean;

  @Prop({
    required: false,
  })
  penaltyKick?: boolean;

  @Prop({
    required: false,
  })
  ownGoal?: boolean;

  @Prop({
    required: false,
  })
  shootout?: boolean;

  /**
   * Complete ESPN play object.
   */
  @Prop({
    type: Object,
    required: true,
  })
  payload!: Record<string, unknown>;

  @Prop({
    required: true,
    type: Date,
    index: true,
  })
  collectedAt!: Date;
}

export const EspnMatchEventSchema =
  SchemaFactory.createForClass(EspnMatchEvent);

EspnMatchEventSchema.index(
  {
    eventId: 1,
    playId: 1,
  },
  {
    unique: true,
  },
);

EspnMatchEventSchema.index({
  eventId: 1,
  clock: 1,
});
