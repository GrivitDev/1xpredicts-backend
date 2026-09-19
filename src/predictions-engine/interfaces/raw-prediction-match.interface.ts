// src/predictions-engine/interfaces/raw-prediction-match.interface.ts

import { EspnFixtureDocument } from '../../sports/schemas/espn/espn-fixture.schema';

import { EspnStandingDocument } from '../../sports/schemas/espn/espn-standing.schema';

import { EspnTeamDocument } from '../../sports/schemas/espn/espn-team.schema';

import { HeadToHeadDocument } from '../../sports/schemas/head-to-head.schema';

import { TeamCompetitionStatsDocument } from '../../sports/schemas/team-competition-stats.schema';

import { TeamPerformanceProfileDocument } from '../../sports/schemas/team-performance-profile.schema';

export interface RawPredictionMatchInput {
  fixture: EspnFixtureDocument;

  homeTeam: EspnTeamDocument | null;

  awayTeam: EspnTeamDocument | null;

  homeStanding: EspnStandingDocument | null;

  awayStanding: EspnStandingDocument | null;

  homeTeamCompetitionStats: TeamCompetitionStatsDocument | null;

  awayTeamCompetitionStats: TeamCompetitionStatsDocument | null;

  homeTeamPerformanceProfile: TeamPerformanceProfileDocument | null;

  awayTeamPerformanceProfile: TeamPerformanceProfileDocument | null;

  headToHead: HeadToHeadDocument | null;

  homeHistoricalFixtures: EspnFixtureDocument[];

  awayHistoricalFixtures: EspnFixtureDocument[];

  /*
   * Complete competition history available before the prediction
   * fixture. This is used only inside the prediction engine to
   * calculate pre-match opponent strength and schedule quality.
   *
   * No sports-module schema is changed.
   */
  competitionHistoricalFixtures: EspnFixtureDocument[];

  retrievedAt: Date;
}
