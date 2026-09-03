import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type FootballDataStandingDocument =
  HydratedDocument<FootballDataStanding>;

@Schema({
  timestamps: true,
  collection: 'sports_football_data_standings',
})
export class FootballDataStanding {
  @Prop({
    required: true,
    index: true,
  })
  competitionId!: number;

  @Prop({
    required: true,
    index: true,
  })
  competitionCode!: string;

  @Prop({
    required: true,
    index: true,
  })
  seasonId!: number;

  @Prop({
    required: true,
  })
  stage!: string;

  @Prop({
    required: true,
  })
  type!: string;

  @Prop()
  group?: string;

  @Prop({
    type: Object,
    required: true,
  })
  payload!: Record<string, unknown>;

  @Prop({
    required: true,
    index: true,
  })
  collectedAt!: Date;
}

export const FootballDataStandingSchema =
  SchemaFactory.createForClass(FootballDataStanding);

FootballDataStandingSchema.index({
  competitionId: 1,
  seasonId: 1,
  stage: 1,
  type: 1,
  group: 1,
});
