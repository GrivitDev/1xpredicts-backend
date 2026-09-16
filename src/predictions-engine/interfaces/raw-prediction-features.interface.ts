// src/predictions-engine/interfaces/raw-prediction-features.interface.ts

import { RawHeadToHeadFeatures } from './raw-head-to-head-features.interface';

import { RawStandingFeatures } from './raw-standing-features.interface';

import { RawTeamFeatures } from './raw-team-features.interface';

import { TeamComparisonFeatures } from './team-comparison-features.interface';

export interface RawPredictionFeatures {
  eventId: string;

  competitionId: string;

  season: number;

  fixtureDate: Date;

  homeTeamId: string;

  awayTeamId: string;

  homeTeamName: string;

  awayTeamName: string;

  home: RawTeamFeatures;

  away: RawTeamFeatures;

  standings: RawStandingFeatures;

  h2h: RawHeadToHeadFeatures | null;

  comparison: TeamComparisonFeatures;

  overallSampleSize: number;

  dataCompleteness: number;

  historicalDataQuality: number;

  overallDataQuality: number;

  generatedAt: Date;
}
