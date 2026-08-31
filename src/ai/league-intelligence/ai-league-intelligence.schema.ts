// src/ai/league-intelligence/ai-league-intelligence.schema.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

export type AiLeagueIntelligenceDocument =
  HydratedDocument<AiLeagueIntelligence>;

// ============================================================
// RESEARCH ITEM
// ============================================================

@Schema({
  _id: false,
})
export class AiLeagueResearchItem {
  @Prop({
    required: true,
  })
  title!: string;

  @Prop({
    required: true,
  })
  url!: string;

  @Prop()
  content?: string;

  @Prop()
  publishedDate?: string;

  @Prop()
  score?: number;
}

export const AiLeagueResearchItemSchema =
  SchemaFactory.createForClass(AiLeagueResearchItem);

// ============================================================
// LEAGUE INTELLIGENCE
// ============================================================

@Schema({
  timestamps: true,
  collection: 'ai_league_intelligence',
})
export class AiLeagueIntelligence {
  @Prop({
    required: true,
    index: true,
  })
  leagueCode!: string;

  @Prop({
    required: true,
  })
  leagueName!: string;

  @Prop({
    required: true,
  })
  country!: string;

  @Prop({
    required: true,
    index: true,
  })
  cacheDate!: string;

  @Prop({
    required: true,
  })
  query!: string;

  @Prop({
    type: [AiLeagueResearchItemSchema],
    default: [],
  })
  results!: AiLeagueResearchItem[];

  @Prop({
    type: [String],
    default: [],
  })
  images!: string[];

  @Prop({
    type: Date,
    required: true,
  })
  searchedAt!: Date;

  @Prop({
    type: Date,
    required: true,
  })
  expiresAt!: Date;
}

export const AiLeagueIntelligenceSchema =
  SchemaFactory.createForClass(AiLeagueIntelligence);

// ============================================================
// ONE CACHE PER LEAGUE PER DAY
// ============================================================

AiLeagueIntelligenceSchema.index(
  {
    leagueCode: 1,
    cacheDate: 1,
  },
  {
    unique: true,
  },
);

// ============================================================
// 24-HOUR TTL CACHE
// ============================================================

AiLeagueIntelligenceSchema.index(
  {
    expiresAt: 1,
  },
  {
    expireAfterSeconds: 0,
  },
);
