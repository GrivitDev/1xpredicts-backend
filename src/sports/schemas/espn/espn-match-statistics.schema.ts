import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

export type EspnMatchStatisticsDocument = HydratedDocument<EspnMatchStatistics>;

@Schema({
  timestamps: true,
  collection: 'sports_espn_match_statistics',
})
export class EspnMatchStatistics {
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

  @Prop({
    required: true,
    index: true,
    trim: true,
  })
  competitionId!: string;

  @Prop({
    required: true,
    index: true,
    trim: true,
  })
  teamId!: string;

  @Prop({
    required: false,
  })
  possession?: number;

  @Prop({
    required: false,
  })
  shots?: number;

  @Prop({
    required: false,
  })
  shotsOnTarget?: number;

  @Prop({
    required: false,
  })
  corners?: number;

  @Prop({
    required: false,
  })
  fouls?: number;

  @Prop({
    required: false,
  })
  offsides?: number;

  @Prop({
    required: false,
  })
  yellowCards?: number;

  @Prop({
    required: false,
  })
  redCards?: number;

  @Prop({
    required: false,
  })
  saves?: number;

  /**
   * Complete ESPN statistics payload.
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

export const EspnMatchStatisticsSchema =
  SchemaFactory.createForClass(EspnMatchStatistics);

EspnMatchStatisticsSchema.index(
  {
    eventId: 1,
    teamId: 1,
  },
  {
    unique: true,
  },
);

EspnMatchStatisticsSchema.index({
  teamId: 1,
  collectedAt: -1,
});

EspnMatchStatisticsSchema.index({
  leagueId: 1,
  teamId: 1,
});
