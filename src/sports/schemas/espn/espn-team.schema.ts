import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

export type EspnTeamDocument = HydratedDocument<EspnTeam>;

@Schema({
  timestamps: true,
  collection: 'sports_espn_teams',
})
export class EspnTeam {
  /**
   * ESPN team ID.
   */
  @Prop({
    required: true,
    unique: true,
    index: true,
    trim: true,
  })
  teamId!: string;

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
    trim: true,
  })
  name!: string;

  @Prop({
    required: false,
  })
  displayName?: string;

  @Prop({
    required: false,
  })
  shortDisplayName?: string;

  @Prop({
    required: false,
    index: true,
  })
  abbreviation?: string;

  @Prop({
    required: false,
  })
  location?: string;

  @Prop({
    required: false,
  })
  logo?: string;

  @Prop({
    required: false,
  })
  color?: string;

  @Prop({
    required: false,
  })
  alternateColor?: string;

  @Prop({
    required: false,
    index: true,
  })
  active?: boolean;

  /**
   * Complete latest ESPN team object.
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

export const EspnTeamSchema = SchemaFactory.createForClass(EspnTeam);

EspnTeamSchema.index({
  leagueId: 1,
  name: 1,
});

EspnTeamSchema.index({
  abbreviation: 1,
});

EspnTeamSchema.index({
  leagueId: 1,
  active: 1,
});
