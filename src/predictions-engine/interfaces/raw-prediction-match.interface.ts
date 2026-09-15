import {
  EspnFixture,
  EspnFixtureDocument,
} from '../../sports/schemas/espn/espn-fixture.schema';

import {
  EspnStanding,
  EspnStandingDocument,
} from '../../sports/schemas/espn/espn-standing.schema';

import {
  EspnTeam,
  EspnTeamDocument,
} from '../../sports/schemas/espn/espn-team.schema';

import {
  TeamCompetitionStats,
  TeamCompetitionStatsDocument,
} from '../../sports/schemas/team-competition-stats.schema';

import {
  TeamPerformanceProfile,
  TeamPerformanceProfileDocument,
} from '../../sports/schemas/team-performance-profile.schema';

import {
  HeadToHead,
  HeadToHeadDocument,
} from '../../sports/schemas/head-to-head.schema';

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

  retrievedAt: Date;
}
