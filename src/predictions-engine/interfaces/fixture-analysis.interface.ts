// src/predictions-engine/interfaces/fixture-analysis.interface.ts

import { TeamCompetitionStatsDocument } from '../../sports/schemas/team-competition-stats.schema';

import { HeadToHeadDocument } from '../../sports/schemas/head-to-head.schema';

import { SportsOddsSnapshotDocument } from '../../sports/schemas/sports-odds-snapshot.schema';

export interface FixtureAnalysisTeam {
  teamId: number;

  teamName: string;

  isHome: boolean;
}

export interface FixtureAnalysisFixture {
  fixtureId: number;

  competitionId: string;

  leagueId: number;

  season: number;

  kickoff: Date;

  status: string;

  homeTeam: FixtureAnalysisTeam;

  awayTeam: FixtureAnalysisTeam;

  payload: Record<string, unknown>;
}

export interface FixtureAnalysis {
  fixture: FixtureAnalysisFixture;

  homeTeamStats: TeamCompetitionStatsDocument | null;

  awayTeamStats: TeamCompetitionStatsDocument | null;

  headToHead: HeadToHeadDocument | null;

  odds: SportsOddsSnapshotDocument | null;

  dataQuality: number;

  analyzedAt: Date;
}
