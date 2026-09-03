import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type FootballDataCompetitionDocument =
  HydratedDocument<FootballDataCompetition>;

@Schema({
  timestamps: true,
  collection: 'sports_football_data_competitions',
})
export class FootballDataCompetition {
  @Prop({
    required: true,
    unique: true,
    index: true,
  })
  competitionId!: number;

  @Prop({
    required: true,
    index: true,
  })
  code!: string;

  @Prop({
    required: true,
  })
  name!: string;

  @Prop()
  type?: string;

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

export const FootballDataCompetitionSchema = SchemaFactory.createForClass(
  FootballDataCompetition,
);
