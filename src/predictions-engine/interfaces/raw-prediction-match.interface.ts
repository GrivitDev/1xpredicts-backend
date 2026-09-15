import { EspnFixtureDocument } from '../../sports/schemas/espn/espn-fixture.schema';

import { EspnStandingDocument } from '../../sports/schemas/espn/espn-standing.schema';

import { EspnTeamDocument } from '../../sports/schemas/espn/espn-team.schema';

import { TeamCompetitionStatsDocument } from '../../sports/schemas/team-competition-stats.schema';

import { TeamPerformanceProfileDocument } from '../../sports/schemas/team-performance-profile.schema';

import { HeadToHeadDocument } from '../../sports/schemas/head-to-head.schema';

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
