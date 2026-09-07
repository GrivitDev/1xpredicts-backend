import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

import { CompetitionPriority } from '../enums/competition-priority.enum';

import { CompetitionRegion } from '../enums/competition-region.enum';

import { CompetitionType } from '../enums/competition-type.enum';

import { CollectionFrequency } from '../enums/collection-frequency.enum';

export type SupportedCompetitionDocument =
  HydratedDocument<SupportedCompetition>;

@Schema({
  _id: false,
})
export class SupportedCompetitionProviders {
  @Prop({
    type: String,
    default: null,
  })
  apiFootballName?: string | null;

  @Prop({
    type: String,
    default: null,
  })
  apiFootballCountry?: string | null;

  @Prop({
    type: Number,
    default: null,
  })
  apiFootballId?: number | null;

  @Prop({
    type: String,
    default: null,
  })
  footballDataCode?: string | null;

  @Prop({
    type: String,
    default: null,
  })
  oddsApiSportKey?: string | null;
}

@Schema({
  timestamps: true,
  collection: 'supported_competitions',
})
export class SupportedCompetition {
  @Prop({
    type: String,
    required: true,
    unique: true,
    index: true,
  })
  competitionId!: string;

  @Prop({
    type: String,
    required: true,
  })
  name!: string;

  @Prop({
    type: String,
    enum: Object.values(CompetitionType),
    required: true,
  })
  type!: CompetitionType;

  @Prop({
    type: String,
    enum: Object.values(CompetitionRegion),
    required: true,
  })
  region!: CompetitionRegion;

  @Prop({
    type: String,
    enum: Object.values(CompetitionPriority),
    required: true,
  })
  priority!: CompetitionPriority;

  @Prop({
    type: Boolean,
    default: true,
  })
  enabled!: boolean;

  @Prop({
    type: Boolean,
    default: false,
  })
  predictionEnabled!: boolean;

  @Prop({
    type: Boolean,
    default: false,
  })
  oddsEnabled!: boolean;

  @Prop({
    type: String,
    enum: Object.values(CollectionFrequency),
    required: true,
  })
  collectionFrequency!: CollectionFrequency;

  @Prop({
    type: SupportedCompetitionProviders,
    default: {},
  })
  providers!: SupportedCompetitionProviders;

  @Prop({
    type: Boolean,
    default: false,
  })
  seasonal?: boolean;

  @Prop({
    type: String,
    enum: ['MEN', 'WOMEN'],
    default: null,
  })
  gender?: 'MEN' | 'WOMEN';

  @Prop({
    type: String,
    default: null,
  })
  notes?: string | null;
}

export const SupportedCompetitionSchema =
  SchemaFactory.createForClass(SupportedCompetition);
