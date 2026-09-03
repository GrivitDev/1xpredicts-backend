import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

export type SportsOddsSnapshotDocument = HydratedDocument<SportsOddsSnapshot>;

@Schema({
  timestamps: true,
  collection: 'sports_odds_snapshots',
})
export class SportsOddsSnapshot {
  @Prop({
    required: true,
    index: true,
  })
  eventId!: string;

  @Prop({
    required: true,
    index: true,
  })
  sportKey!: string;

  @Prop({
    required: true,
  })
  homeTeam!: string;

  @Prop({
    required: true,
  })
  awayTeam!: string;

  @Prop({
    required: true,
    type: Date,
    index: true,
  })
  commenceTime!: Date;

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

export const SportsOddsSnapshotSchema =
  SchemaFactory.createForClass(SportsOddsSnapshot);

SportsOddsSnapshotSchema.index({
  eventId: 1,
  collectedAt: -1,
});

SportsOddsSnapshotSchema.index({
  sportKey: 1,
  commenceTime: 1,
});
