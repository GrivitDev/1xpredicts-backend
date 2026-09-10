import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

export type EspnOddsDocument = HydratedDocument<EspnOdds>;

@Schema({
  timestamps: true,
  collection: 'sports_espn_odds',
})
export class EspnOdds {
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
    required: false,
    index: true,
    trim: true,
  })
  providerId?: string;

  @Prop({
    required: false,
  })
  providerName?: string;

  @Prop({
    required: false,
  })
  details?: string;

  @Prop({
    required: false,
  })
  overUnder?: number;

  @Prop({
    required: false,
  })
  spread?: number;

  @Prop({
    required: false,
  })
  homeMoneyline?: number;

  @Prop({
    required: false,
  })
  awayMoneyline?: number;

  @Prop({
    required: false,
  })
  drawMoneyline?: number;

  @Prop({
    required: false,
  })
  homeOdds?: number;

  @Prop({
    required: false,
  })
  awayOdds?: number;

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

export const EspnOddsSchema = SchemaFactory.createForClass(EspnOdds);

EspnOddsSchema.index({
  eventId: 1,
  providerId: 1,
});

EspnOddsSchema.index({
  eventId: 1,
  collectedAt: -1,
});

EspnOddsSchema.index({
  leagueId: 1,
  collectedAt: -1,
});
