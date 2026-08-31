// src/predictions/schemas/prediction.schema.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

export type PredictionDocument = HydratedDocument<Prediction>;

@Schema({
  timestamps: true,
})
export class Prediction {
  @Prop({
    required: true,
  })
  matchId!: string;

  @Prop({
    required: true,
  })
  leagueCode!: string;

  @Prop({
    type: {
      code: String,

      name: String,

      country: String,

      emblem: String,
    },

    _id: false,
  })
  league?: {
    code: string;

    name: string;

    country: string;

    emblem?: string;
  };

  @Prop({
    required: true,
  })
  homeTeam!: string;

  @Prop({
    required: true,
  })
  awayTeam!: string;

  @Prop()
  homeTeamBadge?: string;

  @Prop()
  awayTeamBadge?: string;

  // ==========================================================
  // RESULT PREDICTION
  // ==========================================================

  @Prop({
    required: true,
    enum: ['HOME', 'DRAW', 'AWAY'],
  })
  prediction!: 'HOME' | 'DRAW' | 'AWAY';

  @Prop({
    type: {
      home: Number,

      draw: Number,

      away: Number,
    },

    required: true,

    _id: false,
  })
  probabilities!: {
    home: number;

    draw: number;

    away: number;
  };

  // ==========================================================
  // MARKETS
  // ==========================================================

  @Prop({
    type: [
      {
        market: {
          type: String,
          required: true,
        },

        selection: {
          type: String,
          default: '',
        },

        playerId: {
          type: String,
        },

        playerName: {
          type: String,
        },
      },
    ],

    default: [],
  })
  markets!: {
    market: string;

    selection?: string;

    playerId?: string;

    playerName?: string;
  }[];

  // ==========================================================
  // CONFIDENCE
  // ==========================================================

  @Prop({
    required: true,

    min: 1,

    max: 100,
  })
  confidence!: number;

  // ==========================================================
  // ACCESS
  // ==========================================================

  @Prop({
    required: true,

    enum: ['free', 'regular', 'vip'],
  })
  accessType!: 'free' | 'regular' | 'vip';

  // ==========================================================
  // PRICING
  // ==========================================================

  @Prop({
    required: true,

    default: 0,
  })
  price!: number;

  @Prop({
    required: true,

    default: 0,
  })
  priceNGN!: number;

  @Prop({
    required: true,

    default: 0,
  })
  priceUSD!: number;

  // ==========================================================
  // MATCH
  // ==========================================================

  @Prop({
    required: true,
  })
  matchDate!: string;

  @Prop({
    required: true,
  })
  kickoffTimestamp!: number;

  // ==========================================================
  // SETTLEMENT
  // ==========================================================

  @Prop({
    enum: ['pending', 'won', 'lost', 'void'],

    default: 'pending',
  })
  status!: 'pending' | 'won' | 'lost' | 'void';

  @Prop({
    default: false,
  })
  settled!: boolean;

  @Prop({
    default: false,
  })
  deleted!: boolean;

  @Prop({
    type: Date,

    default: null,
  })
  settledAt!: Date;
}

export const PredictionSchema = SchemaFactory.createForClass(Prediction);

PredictionSchema.index(
  {
    matchId: 1,
  },
  {
    unique: true,
  },
);
