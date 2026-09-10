import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  ApplyBasicQueryCasting,
  HydratedDocument,
  ObjectId,
  StrictCondition,
} from 'mongoose';

import { CompetitionPriority } from '../../enums/competition-priority.enum';

export type EspnLeagueDocument = HydratedDocument<EspnLeague>;

@Schema({
  timestamps: true,
  collection: 'sports_espn_leagues',
})
export class EspnLeague {
  /**
   * ESPN league identifier.
   */
  @Prop({
    required: true,
    unique: true,
    index: true,
    trim: true,
  })
  leagueId!: string;

  /**
   * ESPN league slug used in provider URLs.
   *
   * Examples:
   * eng.1
   * esp.1
   * uefa.champions
   */
  @Prop({
    required: true,
    unique: true,
    index: true,
    trim: true,
    lowercase: true,
  })
  slug!: string;

  @Prop({
    required: true,
    trim: true,
  })
  name!: string;

  @Prop({
    type: String,
    trim: true,
  })
  abbreviation?: string;

  @Prop({
    type: String,
    trim: true,
  })
  country?: string;

  /**
   * Application classification.
   *
   * Null means ESPN discovered the league but it is
   * not one of our configured priority competitions.
   */
  @Prop({
    type: String,
    enum: [...Object.values(CompetitionPriority), null],
    default: null,
    index: true,
  })
  priority?: CompetitionPriority | null;

  /**
   * Convenience classification flag.
   *
   * This belongs to the ESPN catalogue only.
   * It is not used by ActiveCompetition.
   */
  @Prop({
    type: Boolean,
    default: false,
    index: true,
  })
  isPriority!: boolean;

  /**
   * Whether ESPN currently exposes the league.
   */
  @Prop({
    type: Boolean,
    default: true,
    index: true,
  })
  isActive!: boolean;

  /**
   * Current season year.
   */
  @Prop({
    type: Number,
    index: true,
  })
  season?: number;

  @Prop({
    type: Date,
    index: true,
  })
  seasonStartDate?: Date;

  @Prop({
    type: Date,
    index: true,
  })
  seasonEndDate?: Date;

  @Prop({
    type: Date,
    index: true,
  })
  lastFixtureDate?: Date;

  @Prop({
    type: Date,
    index: true,
  })
  nextFixtureDate?: Date;

  /**
   * Full ESPN league payload.
   */
  @Prop({
    type: Object,
  })
  payload?: Record<string, unknown>;

  /**
   * Last catalogue synchronization.
   */
  @Prop({
    type: Date,
    index: true,
  })
  lastSyncedAt!: Date;
  region: any;
  _id: StrictCondition<ApplyBasicQueryCasting<ObjectId>> | undefined;
}

export const EspnLeagueSchema = SchemaFactory.createForClass(EspnLeague);

EspnLeagueSchema.index({
  priority: 1,
  isPriority: 1,
  name: 1,
});

EspnLeagueSchema.index({
  isActive: 1,
  priority: 1,
  season: 1,
});

EspnLeagueSchema.index({
  lastFixtureDate: -1,
});
