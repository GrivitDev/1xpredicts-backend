import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type FootballDataMatchDocument = HydratedDocument<FootballDataMatch>;

@Schema({
  timestamps: true,
  collection: 'sports_football_data_matches',
})
export class FootballDataMatch {
  @Prop({
    required: true,
    unique: true,
    index: true,
  })
  matchId!: number;

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
    index: true,
  })
  status!: string;

  @Prop({
    required: true,
    index: true,
  })
  utcDate!: Date;

  @Prop({
    required: true,
  })
  homeTeamId!: number;

  @Prop({
    required: true,
  })
  awayTeamId!: number;

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

export const FootballDataMatchSchema =
  SchemaFactory.createForClass(FootballDataMatch);

FootballDataMatchSchema.index({
  competitionCode: 1,
  utcDate: 1,
});

FootballDataMatchSchema.index({
  competitionId: 1,
  seasonId: 1,
  status: 1,
});
