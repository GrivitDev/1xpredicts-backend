import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

export type ApiFootballLeagueDocument = HydratedDocument<ApiFootballLeague>;

@Schema({
  _id: false,
})
export class ApiFootballLeagueSeason {
  @Prop({
    type: Number,
  })
  year?: number;

  @Prop({
    type: String,
    default: null,
  })
  start?: string | null;

  @Prop({
    type: String,
    default: null,
  })
  end?: string | null;

  @Prop({
    type: Boolean,
    default: false,
  })
  current?: boolean;
}

@Schema({
  timestamps: true,
  collection: 'api_football_leagues',
})
export class ApiFootballLeague {
  @Prop({
    type: Number,
    required: true,
    unique: true,
    index: true,
  })
  apiFootballLeagueId!: number;

  @Prop({
    type: String,
    required: true,
    index: true,
  })
  name!: string;

  @Prop({
    type: String,
    default: null,
    index: true,
  })
  type?: string | null;

  @Prop({
    type: String,
    default: null,
  })
  logo?: string | null;

  @Prop({
    type: String,
    default: null,
    index: true,
  })
  country?: string | null;

  @Prop({
    type: String,
    default: null,
  })
  countryCode?: string | null;

  @Prop({
    type: String,
    default: null,
  })
  countryFlag?: string | null;

  @Prop({
    type: [ApiFootballLeagueSeason],
    default: [],
  })
  seasons!: ApiFootballLeagueSeason[];

  @Prop({
    type: Date,
    default: Date.now,
    index: true,
  })
  lastSyncedAt!: Date;
}

export const ApiFootballLeagueSchema =
  SchemaFactory.createForClass(ApiFootballLeague);
